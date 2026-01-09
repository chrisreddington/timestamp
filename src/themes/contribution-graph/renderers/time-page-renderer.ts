/**
 * Canvas-based Time Page Renderer for Contribution Graph theme.
 *
 * Renders countdown using a single `<canvas>` element with:
 * - 30fps throttled animation (sufficient for ambient effects)
 * - Dirty-rect updates (only repaint changed squares)
 * - Single GPU layer for efficient compositing
 */

import type { CelebrationOptions } from '@core/types';
import { cancelAll, createResourceTracker } from '@themes/shared/resources';
import type {
    AnimationStateContext,
    AnimationStateGetter,
    MountContext,
    ResourceTracker,
    TimePageRenderer,
    TimeRemaining,
} from '@themes/shared/types';

import { getActivityPhase } from '../config';
import {
    type AmbientState,
    createAmbientState,
    invalidateAmbientCache,
    manageAmbientActivity,
    setPhase,
    startAmbient,
    stopAmbient,
    updateAmbientAnimations,
} from '../utils/canvas/ambient';
import { clearCelebrationMessage, renderCelebrationMessage } from '../utils/canvas/celebration';
import { clearDigits, updateDigits } from '../utils/canvas/digits';
import { type CanvasRenderer, createCanvasRenderer } from '../utils/canvas/renderer';
import {
    type CanvasGridState,
    createCanvasGridState,
    markFullRepaint,
    resetSquares,
} from '../utils/canvas/state';
import { buildWall, clearWall, unbuildWall } from '../utils/canvas/wall-build';
import { formatCountdown } from '../utils/grid';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Target frame rate for animation (30fps is sufficient for ambient effects). */
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// =============================================================================
// STATE
// =============================================================================

interface CanvasTimePageState {
  container: HTMLElement | null;
  renderer: CanvasRenderer | null;
  grid: CanvasGridState | null;
  ambient: AmbientState;
  getAnimationState: AnimationStateGetter;
  lastTime: TimeRemaining | null;
  completionMessage: string;
  
  // Animation loop
  animationFrameId: number | null;
  lastFrameTime: number;
  lastTickTime: number;
  isAnimating: boolean;
  
  // Celebration state
  celebrationAbortController: AbortController | null;
  messageIndices: Set<number>;
  
  // Resource tracking
  resourceTracker: ResourceTracker;
  resizeObserver: ResizeObserver | null;
  colorModeListener: ((e: MediaQueryListEvent) => void) | null;
}

function createState(): CanvasTimePageState {
  return {
    container: null,
    renderer: null,
    grid: null,
    ambient: createAmbientState(),
    getAnimationState: () => ({ shouldAnimate: true, prefersReducedMotion: false }),
    lastTime: null,
    completionMessage: '',
    animationFrameId: null,
    lastFrameTime: 0,
    lastTickTime: 0,
    isAnimating: false,
    celebrationAbortController: null,
    messageIndices: new Set(),
    resourceTracker: createResourceTracker(),
    resizeObserver: null,
    colorModeListener: null,
  };
}

// =============================================================================
// ANIMATION LOOP
// =============================================================================

/**
 * Start the animation loop (30fps throttled).
 */
function startAnimationLoop(state: CanvasTimePageState): void {
  if (state.isAnimating) return;
  state.isAnimating = true;
  state.lastFrameTime = performance.now();
  state.lastTickTime = performance.now();

  function animate(now: number): void {
    if (!state.isAnimating || !state.renderer || !state.grid) {
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

    // Check animation state
    const { shouldAnimate, prefersReducedMotion } = state.getAnimationState();

    if (shouldAnimate && !prefersReducedMotion) {
      // Continuously manage ambient activity for organic feel
      manageAmbientActivity(state.grid, state.ambient, now);

      // Update ambient animations
      updateAmbientAnimations(state.grid, state.ambient, now);
      
      // Mark all digit/wall/message squares as dirty for pulse animation
      // This ensures they re-render with updated opacity every frame
      for (let i = 0; i < state.grid.squares.length; i++) {
        const square = state.grid.squares[i];
        if (square.isDigit || square.isWall || square.isMessage) {
          state.grid.dirtySquares.add(i);
        }
      }
    }

    // Render (only if dirty)
    state.renderer.render(state.grid, state.ambient, now);

    state.animationFrameId = requestAnimationFrame(animate);
  }

  state.animationFrameId = requestAnimationFrame(animate);
}

/**
 * Setup mouse event listeners for hover effects.
 */
function setupMouseListeners(state: CanvasTimePageState): void {
  if (!state.renderer || !state.grid) return;

  const handleMouseMove = (e: MouseEvent) => {
    if (state.renderer && state.grid) {
      state.renderer.onMouseMove(state.grid, e.clientX, e.clientY);
    }
  };

  const handleMouseLeave = () => {
    if (state.renderer && state.grid) {
      state.renderer.onMouseLeave(state.grid);
    }
  };

  state.renderer.canvas.addEventListener('mousemove', handleMouseMove);
  state.renderer.canvas.addEventListener('mouseleave', handleMouseLeave);

  // Store for cleanup
  state.resourceTracker.listeners.push({
    remove: () => {
      if (state.renderer) {
        state.renderer.canvas.removeEventListener('mousemove', handleMouseMove);
        state.renderer.canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
    },
  });
}

/**
 * Stop the animation loop.
 */
function stopAnimationLoop(state: CanvasTimePageState): void {
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
function setupCanvas(state: CanvasTimePageState, container: HTMLElement): void {
  // Create renderer
  state.renderer = createCanvasRenderer();

  // Create grid state
  const rect = container.getBoundingClientRect();
  state.grid = createCanvasGridState(rect.width, rect.height);

  // Resize canvas
  state.renderer.resize(state.grid);

  // Mount canvas
  container.appendChild(state.renderer.canvas);

  // Setup resize observer
  state.resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry && state.renderer && state.grid) {
      const { width, height } = entry.contentRect;
      
      // Store previous state
      const wasInCelebration = state.messageIndices.size > 0;
      const previousMessage = state.completionMessage;
      const wasAmbientRunning = state.ambient.isRunning;
      
      // Recreate grid state with new dimensions
      state.grid = createCanvasGridState(width, height);
      state.renderer.resize(state.grid);
      
      // CRITICAL: Invalidate ambient cache BEFORE rendering digits
      // Old cache has indices for different grid dimensions
      invalidateAmbientCache(state.ambient);
      
      // Restore celebration message if present
      if (wasInCelebration && previousMessage) {
        state.messageIndices = renderCelebrationMessage(state.grid, previousMessage);
      }
      // Otherwise re-render digits if we have time data
      else if (state.lastTime) {
        const lines = formatCountdown(
          state.lastTime.days,
          state.lastTime.hours,
          state.lastTime.minutes,
          state.lastTime.seconds,
          state.grid.cols
        );
        // updateDigits sets digitBounds which ambient will use
        updateDigits(state.grid, lines);
        
        // Restore ambient state if it was running
        // This happens AFTER digits are rendered so bounding box is set
        if (wasAmbientRunning) {
          startAmbient(state.ambient);
        }
      }
      
      markFullRepaint(state.grid);
      
      // Render immediately to avoid blank screen during resize
      state.renderer.render(state.grid, state.ambient, performance.now());
    }
  });
  state.resizeObserver.observe(container);

  // Setup color mode listeners
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  state.colorModeListener = () => {
    if (state.renderer && state.grid) {
      state.renderer.setColorMode('system');
      markFullRepaint(state.grid);
    }
  };
  mediaQuery.addEventListener('change', state.colorModeListener);

  // Listen for color mode toggle changes
  const handleColorModeChange = () => {
    updateColorMode(state);
  };
  document.addEventListener('color-mode-change', handleColorModeChange);
  
  // Store listener for cleanup
  state.resourceTracker.listeners.push({
    remove: () => {
      document.removeEventListener('color-mode-change', handleColorModeChange);
    },
  });
}

/**
 * Update color mode from data attribute.
 */
function updateColorMode(state: CanvasTimePageState): void {
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

/**
 * Create a canvas-based Contribution Graph time page renderer.
 */
export function createCanvasTimePageRenderer(_targetDate: Date): TimePageRenderer {
  const state = createState();

  return {
    mount(targetContainer: HTMLElement, context?: MountContext): void {
      state.container = targetContainer;
      
      if (context?.getAnimationState) {
        state.getAnimationState = context.getAnimationState;
      }

      setupCanvas(state, targetContainer);
      updateColorMode(state);

      // Setup mouse listeners for hover effects
      setupMouseListeners(state);

      // Start ambient activity
      startAmbient(state.ambient);
      startAnimationLoop(state);
    },

    updateTime(time: TimeRemaining): void {
      if (!state.grid) return;

      state.lastTime = time;

      // Update activity phase
      const totalMs = time.total;
      const newPhase = getActivityPhase(totalMs);
      if (newPhase !== state.ambient.phase) {
        setPhase(state.ambient, newPhase);
      }

      // Update digits
      const lines = formatCountdown(time.days, time.hours, time.minutes, time.seconds, state.grid.cols);
      updateDigits(state.grid, lines);
    },

    onAnimationStateChange(context: AnimationStateContext): void {
      // Update animation state from context
      state.getAnimationState = () => context;

      const { shouldAnimate, prefersReducedMotion } = context;

      if (shouldAnimate && !prefersReducedMotion) {
        startAmbient(state.ambient);
        startAnimationLoop(state);
      } else {
        if (state.grid) {
          stopAmbient(state.ambient, state.grid);
        }
      }
    },

    onCounting(): void {
      if (!state.grid) return;

      // Abort any ongoing celebration animations (wall build/unbuild)
      if (state.celebrationAbortController) {
        state.celebrationAbortController.abort();
        state.celebrationAbortController = null;
      }

      // Reset to counting state
      resetSquares(state.grid);
      state.completionMessage = '';
      state.messageIndices.clear();
      
      // Clear any wall remnants immediately
      clearWall(state.grid);
      clearCelebrationMessage(state.grid);
      clearDigits(state.grid);
      
      // Re-render current time if we have it
      if (state.lastTime) {
        const lines = formatCountdown(
          state.lastTime.days,
          state.lastTime.hours,
          state.lastTime.minutes,
          state.lastTime.seconds,
          state.grid.cols
        );
        updateDigits(state.grid, lines);
      }
      
      // Restart ambient
      startAmbient(state.ambient);
      setPhase(state.ambient, 'calm');
      
      // Force full repaint to ensure clean state
      markFullRepaint(state.grid);
    },

    onCelebrating(options?: CelebrationOptions): void {
      if (!state.grid) return;

      const message = options?.message?.forTextContent ?? options?.fullMessage ?? '';
      state.completionMessage = message;

      // Cancel any ongoing celebration
      if (state.celebrationAbortController) {
        state.celebrationAbortController.abort();
      }
      state.celebrationAbortController = new AbortController();

      const { shouldAnimate } = state.getAnimationState();

      if (shouldAnimate) {
        // Animated celebration: digits and ambient STAY visible
        // Wall progressively covers them during build
        // DON'T stop ambient or clear digits - let wall animation handle that

        (async () => {
          try {
            // Build wall (covers digits and ambient as it builds)
            await buildWall(state.grid!, state.celebrationAbortController!.signal);
            
            // Wall fully built - now clean up covered states and stop ambient
            if (state.grid) {
              stopAmbient(state.ambient, state.grid);
              clearDigits(state.grid);
            }
            
            // Render message (but DON'T set digitBounds yet - we want ambient everywhere during unbuild)
            state.messageIndices = renderCelebrationMessage(state.grid!, message);
            // Temporarily clear digitBounds so ambient can fill ALL non-wall/non-message squares during unbuild
            const tempDigitBounds = state.grid!.digitBounds;
            state.grid!.digitBounds = null;
            
            // Start ambient - it will fill ANY square that isn't wall or message during unbuild
            startAmbient(state.ambient);
            
            // Unbuild wall (reveals message and ambient progressively)
            await unbuildWall(state.grid!, state.celebrationAbortController!.signal);
            
            // Restore digitBounds after unbuild to prevent ambient from entering message area
            if (state.grid) {
              state.grid.digitBounds = tempDigitBounds;
            }
          } catch (err) {
            // Aborted - cleanup
            if (state.grid) {
              clearWall(state.grid);
              clearCelebrationMessage(state.grid);
            }
          }
        })();
      } else {
        // Static celebration: just show message
        stopAmbient(state.ambient, state.grid);
        clearDigits(state.grid);
        state.messageIndices = renderCelebrationMessage(state.grid, message);
      }
    },

    onCelebrated(options?: CelebrationOptions): void {
      if (!state.grid) return;

      const message = options?.message?.forTextContent ?? options?.fullMessage ?? '';
      state.completionMessage = message;

      // Cancel any ongoing celebration
      if (state.celebrationAbortController) {
        state.celebrationAbortController.abort();
        state.celebrationAbortController = null;
      }

      clearDigits(state.grid);
      clearWall(state.grid);
      stopAmbient(state.ambient, state.grid);
      state.messageIndices = renderCelebrationMessage(state.grid, message);
    },

    async destroy(): Promise<void> {
      stopAnimationLoop(state);
      
      // Cancel ongoing celebration
      if (state.celebrationAbortController) {
        state.celebrationAbortController.abort();
        state.celebrationAbortController = null;
      }
      
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

      state.grid = null;
      state.container = null;

      // Use shared cleanup utility for proper resource cleanup
      cancelAll(state.resourceTracker);
    },

    updateContainer(newContainer: HTMLElement): void {
      // Clean up old
      if (state.resizeObserver && state.container) {
        state.resizeObserver.unobserve(state.container);
      }
      if (state.renderer?.canvas.parentElement) {
        state.renderer.canvas.remove();
      }

      // Setup new
      state.container = newContainer;
      if (state.renderer && state.grid) {
        newContainer.appendChild(state.renderer.canvas);
        
        const rect = newContainer.getBoundingClientRect();
        state.grid = createCanvasGridState(rect.width, rect.height);
        state.renderer.resize(state.grid);
        
        if (state.resizeObserver) {
          state.resizeObserver.observe(newContainer);
        }
      }
    },

    getResourceTracker(): ResourceTracker {
      return state.resourceTracker;
    },
  };
}
