/**
 * Ring Theme - Landing Page Renderer
 *
 * Provides ambient background animation for landing page preview.
 * This is Ring's UNIQUE visual style - not shared with other themes.
 *
 * PURE RENDERER - does not compute or cache animation state.
 * The controller provides a getAnimationState getter via MountContext.
 * Always call the getter to get current state - never cache the values.
 *
 * Lifecycle Hooks (managed by LandingPageController):
 * - onAnimationStateChange(): Notifies state changed - re-query getter
 */

import {
  createResourceTracker,
  DEFAULT_ANIMATION_STATE,
  safeSetInterval,
  shouldEnableAnimations,
} from '@themes/shared';
import type {
  AnimationStateContext,
  AnimationStateGetter,
  LandingPageRenderer,
  MountContext,
  ResourceTracker,
} from '@themes/shared/types';

/** Animation interval in milliseconds. */
const ANIMATION_TICK_INTERVAL_MS = 500;

/** Reduced motion opacity for static display. */
const REDUCED_MOTION_OPACITY = 0.6;

/**
 * Creates a Ring landing page renderer.
 * Renders ambient background visual elements for the landing page preview.
 *
 * @param _container - The container element (not used until mount is called)
 * @returns A renderer for managing the background lifecycle
 */
export function ringLandingPageRenderer(_container: HTMLElement): LandingPageRenderer {
  let wrapper: HTMLElement | null = null;
  let elements: HTMLElement[] = [];
  let isDestroyed = false;
  const resourceTracker: ResourceTracker = createResourceTracker();

  // Animation state getter from controller - call to get current state
  let getAnimationState: AnimationStateGetter = () => DEFAULT_ANIMATION_STATE;

  function clearAllAnimations(): void {
    elements.forEach((el) => {
      el.style.animation = '';
      el.style.opacity = String(REDUCED_MOTION_OPACITY);
    });
  }

  function restoreAnimations(): void {
    elements.forEach((el) => {
      el.style.opacity = '';
      // TODO: Re-apply your animation styles here
    });
  }

  function startAnimationTick(): void {
    if (!shouldEnableAnimations(getAnimationState) || isDestroyed) return;

    safeSetInterval(() => {
      if (!shouldEnableAnimations(getAnimationState) || isDestroyed) return;
      // TODO: Add your animation tick logic here
    }, ANIMATION_TICK_INTERVAL_MS, resourceTracker);
  }

  function updateAnimationState(): void {
    if (shouldEnableAnimations(getAnimationState) && !isDestroyed) {
      restoreAnimations();
      startAnimationTick();
      if (wrapper) {
        wrapper.classList.remove('is-paused');
      }
    } else {
      clearAllAnimations();
      if (wrapper) {
        wrapper.classList.add('is-paused');
      }
    }
  }

  return {
    mount(targetContainer: HTMLElement, context?: MountContext): void {
      if (isDestroyed || wrapper) return;

      // Store the getter from controller
      if (context?.getAnimationState) {
        getAnimationState = context.getAnimationState;
      }

      // Clear container using DOM methods (not innerHTML)
      while (targetContainer.firstChild) {
        targetContainer.removeChild(targetContainer.firstChild);
      }
      elements = [];

      // Create wrapper element
      wrapper = document.createElement('div');
      wrapper.className = 'landing-theme-background--ring';
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.style.position = 'absolute';
      wrapper.style.inset = '0';
      wrapper.style.overflow = 'hidden';
      targetContainer.appendChild(wrapper);

      // TODO: Add your background elements here using document.createElement()
      // Example:
      // const element = document.createElement('div');
      // element.className = 'my-background-element';
      // wrapper.appendChild(element);
      // elements.push(element);

      if (shouldEnableAnimations(getAnimationState)) {
        startAnimationTick();
      }
    },

    setSize(_width: number, _height: number): void {
      // Handle viewport resize if needed
    },

    onAnimationStateChange(_context: AnimationStateContext): void {
      // Controller notifies us state changed - re-query getter and update
      updateAnimationState();
    },

    destroy(): void {
      isDestroyed = true;

      // Clear all tracked resources (intervals, timeouts, RAFs)
      resourceTracker.intervals.forEach(clearInterval);
      resourceTracker.intervals.length = 0;

      clearAllAnimations();

      if (wrapper?.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
        wrapper = null;
      }

      elements = [];
    },

    getElementCount(): { total: number; animated: number } {
      const animatedCount = shouldEnableAnimations(getAnimationState) && !isDestroyed ? elements.length : 0;
      return {
        total: elements.length,
        animated: animatedCount,
      };
    },
  };
}
