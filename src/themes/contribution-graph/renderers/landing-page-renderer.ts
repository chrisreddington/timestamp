/**
 * Canvas-based Landing Page Renderer for Contribution Graph theme.
 *
 * Renders an animated background using a single `<canvas>` element with:
 * - Viewport-sized canvas for fixed-position background coverage
 * - Exclusion zone support (to avoid animating behind landing card)
 * - Ambient activity only (no digits/celebration)
 * - Simplified state (always "calm" phase)
 */

import type { AnimationStateContext, LandingPageRenderer, MountContext } from '@core/types';

import {
  type AmbientState,
  createAmbientState,
  manageAmbientActivity,
  startAmbient,
  stopAmbient,
  updateAmbientAnimations,
} from '../utils/canvas/ambient';
import { type CanvasRenderer, createCanvasRenderer } from '../utils/canvas/renderer';
import {
  type CanvasGridState,
  createCanvasGridState,
  markFullRepaint,
} from '../utils/canvas/state';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Target frame rate for animation (30fps is sufficient for ambient effects). */
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/** Margin around exclusion element in grid squares. */
const EXCLUSION_MARGIN = 2;

// =============================================================================
// STATE
// =============================================================================

interface LandingPageState {
  container: HTMLElement | null;
  renderer: CanvasRenderer | null;
  grid: CanvasGridState | null;
  ambient: AmbientState;
  exclusionElement: HTMLElement | null;

  // Animation loop
  animationFrameId: number | null;
  lastFrameTime: number;
  isAnimating: boolean;
  isDestroyed: boolean;

  // Animation state
  shouldAnimate: boolean;
  prefersReducedMotion: boolean;

  // Resize observer
  resizeObserver: ResizeObserver | null;
  colorModeListener: ((e: MediaQueryListEvent) => void) | null;
}

function createState(): LandingPageState {
  return {
    container: null,
    renderer: null,
    grid: null,
    ambient: createAmbientState(),
    exclusionElement: null,
    animationFrameId: null,
    lastFrameTime: 0,
    isAnimating: false,
    isDestroyed: false,
    shouldAnimate: true,
    prefersReducedMotion: false,
    resizeObserver: null,
    colorModeListener: null,
  };
}

// =============================================================================
// EXCLUSION ZONE
// =============================================================================

/**
 * Calculate exclusion zone in grid coordinates.
 * Prevents ambient animations behind UI elements like landing card.
 */
function calculateExclusionBounds(
  exclusionElement: HTMLElement,
  grid: CanvasGridState,
  canvasRect: DOMRect
): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  const elementRect = exclusionElement.getBoundingClientRect();

  // Element not visible
  if (elementRect.width === 0 || elementRect.height === 0) {
    return null;
  }

  const cellSize = grid.squareSize + grid.gap;

  // Calculate relative positions
  const relativeLeft = elementRect.left - canvasRect.left;
  const relativeTop = elementRect.top - canvasRect.top;
  const relativeRight = elementRect.right - canvasRect.left;
  const relativeBottom = elementRect.bottom - canvasRect.top;

  // Convert to grid coordinates with margin
  const minCol = Math.max(0, Math.floor(relativeLeft / cellSize) - EXCLUSION_MARGIN);
  const maxCol = Math.min(grid.cols - 1, Math.ceil(relativeRight / cellSize) + EXCLUSION_MARGIN);
  const minRow = Math.max(0, Math.floor(relativeTop / cellSize) - EXCLUSION_MARGIN);
  const maxRow = Math.min(grid.rows - 1, Math.ceil(relativeBottom / cellSize) + EXCLUSION_MARGIN);

  if (minCol > maxCol || minRow > maxRow) {
    return null;
  }

  return { minCol, maxCol, minRow, maxRow };
}

/**
 * Update exclusion zone (digitBounds) based on exclusion element position.
 */
function updateExclusionZone(state: LandingPageState): void {
  if (!state.grid || !state.renderer || !state.exclusionElement) {
    if (state.grid) state.grid.digitBounds = null;
    return;
  }

  const canvasRect = state.renderer.canvas.getBoundingClientRect();
  state.grid.digitBounds = calculateExclusionBounds(
    state.exclusionElement,
    state.grid,
    canvasRect
  );
}

// =============================================================================
// VIEWPORT DIMENSIONS
// =============================================================================

/**
 * Get viewport dimensions for fixed-position background coverage.
 * 
 * The landing page background uses `position: fixed` with `height: 100vh`,
 * so the canvas should fill the viewport, not the scrollable document height.
 */
function getViewportDimensions(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

// =============================================================================
// ANIMATION LOOP
// =============================================================================

/**
 * Start the animation loop (30fps throttled).
 */
function startAnimationLoop(state: LandingPageState): void {
  if (state.isAnimating || state.isDestroyed) return;
  state.isAnimating = true;
  state.lastFrameTime = performance.now();

  function animate(now: number): void {
    if (!state.isAnimating || !state.renderer || !state.grid || state.isDestroyed) {
      state.animationFrameId = null;
      return;
    }

    // Throttle to target FPS
    const elapsed = now - state.lastFrameTime;
    if (elapsed < FRAME_INTERVAL) {
      state.animationFrameId = requestAnimationFrame(animate);
      return;
    }
    state.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    if (state.shouldAnimate && !state.prefersReducedMotion) {
      // Manage ambient activity
      manageAmbientActivity(state.grid, state.ambient, now);
      updateAmbientAnimations(state.grid, state.ambient, now);
    }

    // Render (only if dirty)
    state.renderer.render(state.grid, state.ambient, now);

    state.animationFrameId = requestAnimationFrame(animate);
  }

  state.animationFrameId = requestAnimationFrame(animate);
}

/**
 * Stop the animation loop.
 */
function stopAnimationLoop(state: LandingPageState): void {
  state.isAnimating = false;
  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
}

// =============================================================================
// SETUP
// =============================================================================

/**
 * Setup canvas and mount to container.
 */
function setupCanvas(state: LandingPageState, container: HTMLElement, initialColorMode?: 'dark' | 'light'): void {
  // Create renderer
  state.renderer = createCanvasRenderer();

  // Use viewport dimensions for fixed-position background coverage
  const { width, height } = getViewportDimensions();

  // Create grid state
  state.grid = createCanvasGridState(width, height);

  // Resize canvas
  state.renderer.resize(state.grid);

  // Set initial color mode if provided from context
  if (initialColorMode) {
    state.renderer.setColorMode(initialColorMode);
  } else {
    // Fallback: derive from data attribute if context didn't provide it
    updateColorMode(state);
  }

  // Mount canvas
  container.appendChild(state.renderer.canvas);

  // Setup resize observer
  state.resizeObserver = new ResizeObserver(() => {
    if (state.renderer && state.grid && !state.isDestroyed) {
      const { width, height } = getViewportDimensions();

      state.grid = createCanvasGridState(width, height);
      state.renderer.resize(state.grid);
      updateExclusionZone(state);
      markFullRepaint(state.grid);
      state.renderer.render(state.grid, state.ambient, performance.now());
    }
  });
  state.resizeObserver.observe(container);

  // Setup color mode listener
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  state.colorModeListener = () => {
    if (state.renderer && state.grid) {
      state.renderer.setColorMode('system');
      markFullRepaint(state.grid);
    }
  };
  mediaQuery.addEventListener('change', state.colorModeListener);

  // Listen for color mode toggle changes
  document.addEventListener('color-mode-change', () => updateColorMode(state));
}

/**
 * Update color mode from data attribute.
 */
function updateColorMode(state: LandingPageState): void {
  if (!state.renderer || !state.grid) return;

  const colorMode = document.documentElement.dataset.colorMode;
  if (colorMode === 'dark' || colorMode === 'light') {
    state.renderer.setColorMode(colorMode);
  } else {
    state.renderer.setColorMode('system');
  }
  markFullRepaint(state.grid);
}

// =============================================================================
// RENDERER FACTORY
// =============================================================================

/** Create a canvas-based Contribution Graph landing page renderer. */
export function contributionGraphLandingPageRenderer(_container: HTMLElement): LandingPageRenderer {
  const state = createState();

  return {
    mount(container: HTMLElement, context?: MountContext): void {
      if (state.isDestroyed) return;

      state.container = container;
      container.replaceChildren();
      container.classList.add('landing-theme-background--contribution-graph');
      container.setAttribute('aria-hidden', 'true');

      // Get exclusion element from context
      if (context?.exclusionElement) {
        state.exclusionElement = context.exclusionElement;
      }

      // Get animation state from context
      if (context?.getAnimationState) {
        const animState = context.getAnimationState();
        state.shouldAnimate = animState.shouldAnimate;
        state.prefersReducedMotion = animState.prefersReducedMotion;
      }

      // Setup canvas with initial color mode from context (if provided)
      setupCanvas(state, container, context?.colorMode);
      updateExclusionZone(state);

      // Start ambient activity (always calm phase for landing)
      startAmbient(state.ambient);
      startAnimationLoop(state);
    },

    setSize(_width: number, _height: number): void {
      if (state.isDestroyed || !state.container || !state.renderer || !state.grid) return;

      const { width, height } = getViewportDimensions();

      state.grid = createCanvasGridState(width, height);
      state.renderer.resize(state.grid);
      updateExclusionZone(state);
      markFullRepaint(state.grid);
    },

    onAnimationStateChange(context: AnimationStateContext): void {
      if (state.isDestroyed) return;

      state.shouldAnimate = context.shouldAnimate;
      state.prefersReducedMotion = context.prefersReducedMotion;

      if (context.shouldAnimate && !context.prefersReducedMotion) {
        startAmbient(state.ambient);
        startAnimationLoop(state);
      } else {
        if (state.grid) {
          stopAmbient(state.ambient, state.grid);
        }
      }
    },

    destroy(): void {
      state.isDestroyed = true;
      stopAnimationLoop(state);

      if (state.grid) {
        stopAmbient(state.ambient, state.grid);
      }

      if (state.resizeObserver) {
        state.resizeObserver.disconnect();
        state.resizeObserver = null;
      }

      if (state.colorModeListener) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.removeEventListener('change', state.colorModeListener);
        state.colorModeListener = null;
      }

      if (state.renderer) {
        state.renderer.destroy();
        state.renderer = null;
      }

      if (state.container) {
        state.container.classList.remove('landing-theme-background--contribution-graph');
        state.container.replaceChildren();
        state.container = null;
      }

      state.grid = null;
    },

    getElementCount(): { total: number; animated: number } {
      return {
        total: state.grid?.squares.length ?? 0,
        animated: state.ambient.animations.size,
      };
    },
  };
}
