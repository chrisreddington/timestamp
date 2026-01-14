/**
 * Landing Page Background Manager
 * Manages LandingPageRenderer lifecycle, visibility-based pause/resume,
 * reduced-motion handling, and viewport resize handling with debouncing.
 */

import {
  createPageController,
  type PageController as ReducedMotionController,
} from '@app/orchestrator/controllers';
import { getResolvedColorMode } from '@core/preferences/color-mode';
import type { LandingPageRenderer, ThemeId } from '@core/types';
import { getLandingPageRendererFactory } from '@themes/registry';

import { cancelAll, createResourceTracker, type ResourceTracker, safeSetTimeout } from '@/core/resource-tracking';

/** Debounce delay for resize events in milliseconds */
const RESIZE_DEBOUNCE_MS = 150;

/**
 * State managed by the background manager.
 */
export interface BackgroundManagerState {
  /** Current theme landing page renderer instance (null if not rendered) */
  renderer: LandingPageRenderer | null;
  /** DOM container for rendering background */
  container: HTMLElement | null;
  /** Element to exclude from ambient animations (e.g., landing page card) */
  exclusionElement: HTMLElement | null;
  /** Visibility change event handler reference for cleanup */
  visibilityHandler: (() => void) | null;
  /** Window resize event handler reference for cleanup */
  resizeHandler: (() => void) | null;
  /** Cleanup handles for managing timeouts */
  resourceTracker: ResourceTracker;
  /** Promise tracking current background render operation */
  renderPromise: Promise<void>;
  /** True if destroy() has been called (prevents in-flight renders) */
  isDestroyed: boolean;
  /** Controller for reduced-motion subscription (unified lifecycle) */
  reducedMotionController: ReducedMotionController | null;
  /** Tracks if page is currently visible */
  pageVisible: boolean;
}

/** Options for initializing the background manager. */
export interface BackgroundManagerInitOptions {
  /** Element to exclude from ambient animations (e.g., landing page card). */
  exclusionElement?: HTMLElement;
}

/**
 * Controller interface for managing the landing page background.
 */
export interface BackgroundManagerController {
  /** Set container and attach event listeners */
  initialize(container: HTMLElement, options?: BackgroundManagerInitOptions): void;
  /** Load and render theme background, destroying previous if exists */
  render(theme: ThemeId): Promise<void>;
  /** Promise resolving when current render completes */
  waitForReady(): Promise<void>;
  /** Clean up renderer, listeners, and DOM elements */
  destroy(): void;
  /** Get current landing page renderer (testing utility) */
  getRenderer(): LandingPageRenderer | null;
}

/**
 * Create background manager for the landing page.
 * @returns Controller with initialize, render, waitForReady, destroy, and getRenderer methods
 */
export function createBackgroundManager(): BackgroundManagerController {
  const state: BackgroundManagerState = {
    renderer: null,
    container: null,
    exclusionElement: null,
    visibilityHandler: null,
    resizeHandler: null,
    resourceTracker: createResourceTracker(),
    renderPromise: Promise.resolve(),
    isDestroyed: false,
    reducedMotionController: null,
    pageVisible: true,
  };

  // Create reduced-motion controller that will notify the current renderer
  const reducedMotionController = createPageController({
    getCurrentRenderer: () => state.renderer,
    removeAttributeOnDestroy: false,
  });

  state.reducedMotionController = reducedMotionController;

  /**
   * Handle visibility changes to pause/resume animations.
   */
  function handleVisibilityChange(): void {
    if (!state.renderer) return;
    const visible = !document.hidden;
    state.pageVisible = visible;
    
    // Call unified hook with full context
    const prefersReducedMotion = reducedMotionController.isReducedMotionActive();
    state.renderer.onAnimationStateChange({
      shouldAnimate: visible && !prefersReducedMotion,
      prefersReducedMotion,
      reason: 'page-hidden',
    });
  }

  /**
   * Handle window resize with debouncing.
   */
  function handleResize(): void {
    // Clear existing timeout to restart debounce window
    cancelAll(state.resourceTracker);

    // Debounce resize events to avoid thrashing
    safeSetTimeout(() => {
      if (state.renderer) {
        state.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    }, RESIZE_DEBOUNCE_MS, state.resourceTracker);
  }

  /**
   * Setup event listeners for visibility and resize.
   */
  function setupEventListeners(): void {
    // PERF: Pause animations when tab hidden to save CPU/battery
    state.visibilityHandler = handleVisibilityChange;
    document.addEventListener('visibilitychange', state.visibilityHandler);

    // PERF: Debounce resize events to avoid excessive reflow calculations
    state.resizeHandler = handleResize;
    window.addEventListener('resize', state.resizeHandler);
  }

  /**
   * Remove event listeners.
   */
  function removeEventListeners(): void {
    if (state.visibilityHandler) {
      document.removeEventListener('visibilitychange', state.visibilityHandler);
      state.visibilityHandler = null;
    }

    if (state.resizeHandler) {
      window.removeEventListener('resize', state.resizeHandler);
      state.resizeHandler = null;
    }

    cancelAll(state.resourceTracker);
  }

  return {
    initialize(container: HTMLElement, options?: BackgroundManagerInitOptions): void {
      state.container = container;
      state.exclusionElement = options?.exclusionElement ?? null;
      setupEventListeners();
      // Initialize reduced-motion controller (subscribes to preference changes)
      reducedMotionController.init();
    },

    async render(theme: ThemeId): Promise<void> {
      if (!state.container || state.isDestroyed) return;

      // NOTE: Create render promise for waitForReady() method and testing coordination
      state.renderPromise = (async () => {
        // CRITICAL: Check again after async to handle race conditions
        if (state.isDestroyed || !state.container) return;

        // PERF: Destroy previous renderer to prevent memory leaks
        if (state.renderer) {
          state.renderer.destroy();
          state.renderer = null;
        }

        // CRITICAL: Check again before DOM operations
        if (state.isDestroyed || !state.container) return;

        // Clear container and update class
        state.container.innerHTML = '';
        state.container.className = `landing-theme-background landing-theme-background--${theme}`;
        state.container.setAttribute('data-theme-id', theme);

        // Create new landing page renderer using factory from registry
        const factory = await getLandingPageRendererFactory(theme);

        // CRITICAL: Check again after async factory load
        if (state.isDestroyed || !state.container) return;

        state.renderer = factory(state.container);
        if (state.renderer) {
          // Pass MountContext with current reduced-motion state, exclusion element, and color mode
          const baseMountContext = reducedMotionController.getMountContext();
          const colorMode = getResolvedColorMode();
          const mountContext = {
            ...baseMountContext,
            exclusionElement: state.exclusionElement ?? undefined,
            colorMode,
          };
          state.renderer.mount(state.container, mountContext);
        }
      })();

      return state.renderPromise;
    },

    waitForReady(): Promise<void> {
      return state.renderPromise;
    },

    destroy(): void {
      // CRITICAL: Mark as destroyed to prevent in-flight renders
      state.isDestroyed = true;

      // Destroy landing page renderer
      if (state.renderer) {
        state.renderer.destroy();
        state.renderer = null;
      }

      // Clean up reduced-motion controller subscription
      reducedMotionController.destroy();

      // Remove event listeners
      removeEventListeners();

      // Clear container reference
      state.container = null;
    },

    getRenderer(): LandingPageRenderer | null {
      return state.renderer;
    },
  };
}
