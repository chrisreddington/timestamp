/**
 * Unified Page Controller - manages reduced-motion lifecycle for all page renderers.
 */

import type { AnimationStateContext, MountContext } from '@core/types';
import { reducedMotionManager } from '@core/utils/accessibility';

/** Interface for renderers that can receive animation state notifications. */
export interface AnimationStateAwareRenderer {
  onAnimationStateChange(context: AnimationStateContext): void;
}

/** Options for creating a page controller. */
export interface PageControllerOptions<TRenderer extends AnimationStateAwareRenderer> {
  /** Function that returns the currently active renderer. */
  getCurrentRenderer: () => TRenderer | null;
  /** Whether to remove data-reduced-motion attribute on destroy. */
  removeAttributeOnDestroy: boolean;
}

/** Page controller interface for managing animation state lifecycle. */
export interface PageController {
  /** Initialize and start listening for reduced-motion changes. */
  init(): void;
  /** Get current MountContext for renderer mounting. */
  getMountContext(): MountContext;
  /** Check if reduced motion is currently active. */
  isReducedMotionActive(): boolean;
  /** Clean up subscriptions and resources. */
  destroy(): void;
}

/**
 * Create a page controller instance.
 * 
 * Manages reduced-motion and visibility lifecycle for page renderers. Subscribes to
 * prefers-reduced-motion changes and notifies renderers via onAnimationStateChange.
 * 
 * @param options - Configuration options with the following properties:
 *   - getCurrentRenderer: Function returning current active renderer
 *   - removeAttributeOnDestroy: Whether to remove data-reduced-motion attribute on destroy
 *     - true: TimePageController owns the countdown view lifecycle
 *     - false: LandingPageController shares attribute with TimePageController
 * @returns PageController instance with init/getMountContext/destroy lifecycle
 * 
 * @example
 * ```typescript
 * // Time page (removes attribute on destroy)
 * const controller = createPageController({
 *   getCurrentRenderer: () => currentThemeRenderer,
 *   removeAttributeOnDestroy: true
 * });
 * 
 * // Landing page (preserves attribute for shared lifecycle)
 * const controller = createPageController({
 *   getCurrentRenderer: () => landingRenderer,
 *   removeAttributeOnDestroy: false
 * });
 * ```
 */
export function createPageController<TRenderer extends AnimationStateAwareRenderer>(
  options: PageControllerOptions<TRenderer>
): PageController {
  const { getCurrentRenderer, removeAttributeOnDestroy } = options;

  let unsubscribe: (() => void) | null = null;
  let visibilityChangeHandler: (() => void) | null = null;

  function updateAttribute(active: boolean): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(
        'data-reduced-motion',
        active ? 'true' : 'false'
      );
    }
  }

  function removeAttribute(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
  }

  // NOTE: Guards against undefined renderer during theme transitions
  function notifyRenderer(prefersReducedMotion: boolean): void {
    const renderer = getCurrentRenderer();
    if (!renderer) return;
    
    // Call unified hook with full context
    const context: AnimationStateContext = {
      shouldAnimate: !prefersReducedMotion,
      prefersReducedMotion,
      reason: 'reduced-motion',
    };
    renderer.onAnimationStateChange(context);
  }

  function handleReducedMotionChange(active: boolean): void {
    updateAttribute(active);
    notifyRenderer(active);
  }

  function handleVisibilityChange(): void {
    const isHidden = document.visibilityState === 'hidden';
    const renderer = getCurrentRenderer();
    
    const prefersReducedMotion = reducedMotionManager.isActive();
    const shouldAnimate = !isHidden && !prefersReducedMotion;
    
    // PERF: Update attribute to pause CSS animations when tab is hidden
    // This stops GPU compositing work for background tabs
    updateAttribute(!shouldAnimate);
    
    if (!renderer) return;

    const context: AnimationStateContext = {
      shouldAnimate,
      prefersReducedMotion,
      reason: 'page-hidden',
    };
    renderer.onAnimationStateChange(context);
  }

  function setupVisibilityListener(): void {
    if (visibilityChangeHandler) return;

    visibilityChangeHandler = handleVisibilityChange;
    document.addEventListener('visibilitychange', visibilityChangeHandler);
  }

  function removeVisibilityListener(): void {
    if (visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      visibilityChangeHandler = null;
    }
  }

  return {
    init(): void {
      const initialActive = reducedMotionManager.isActive();
      updateAttribute(initialActive);
      unsubscribe = reducedMotionManager.subscribe(handleReducedMotionChange);
      setupVisibilityListener();
    },

    getMountContext(): MountContext {
      return {
        getAnimationState: (): AnimationStateContext => {
          const prefersReducedMotion = reducedMotionManager.isActive();
          return {
            shouldAnimate: !prefersReducedMotion,
            prefersReducedMotion,
          };
        },
        // NOTE: colorMode is intentionally not included here for time page controller
        // The landing page background-manager adds it separately after resolving the color mode
      };
    },

    isReducedMotionActive(): boolean {
      return reducedMotionManager.isActive();
    },

    destroy(): void {
      unsubscribe?.();
      unsubscribe = null;
      removeVisibilityListener();

      if (removeAttributeOnDestroy) {
        removeAttribute();
      }
    },
  };
}
