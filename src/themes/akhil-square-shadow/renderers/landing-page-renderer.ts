/**
 * Sun & Moon Shadow Theme - Landing Page Renderer
 *
 * Provides ambient sky background with moving sun/moon for landing page preview.
 * Creates a peaceful day/night atmosphere that complements the main theme.
 *
 * PURE RENDERER - does not compute or cache animation state.
 * The controller provides a getAnimationState getter via MountContext.
 * Always call the getter to get current state - never cache the values.
 *
 * Lifecycle Hooks (managed by LandingPageController):
 * - onAnimationStateChange(): Notifies state changed - re-query getter
 */

import {
  cancelAll,
  createResourceTracker,
  DEFAULT_ANIMATION_STATE,
  safeRequestAnimationFrame,
  shouldEnableAnimations,
} from '@themes/shared';
import type {
  AnimationStateContext,
  AnimationStateGetter,
  LandingPageRenderer,
  MountContext,
  ResourceTracker,
} from '@themes/shared/types';

/** Orbit cycle duration for landing page (slower than main theme). */
const LANDING_ORBIT_DURATION_MS = 120000; // 2 minutes for full cycle

/** Target frame interval for throttling. */
const TARGET_FRAME_INTERVAL_MS = 50; // 20fps for landing (less demanding)

/**
 * Creates a Sun & Moon Shadow landing page renderer.
 * Renders ambient sky background with orbiting celestial body.
 *
 * @param _container - The container element (not used until mount is called)
 * @returns A renderer for managing the background lifecycle
 */
export function akhilSquareShadowLandingPageRenderer(_container: HTMLElement): LandingPageRenderer {
  let wrapper: HTMLElement | null = null;
  let sun: HTMLElement | null = null;
  let moon: HTMLElement | null = null;
  let stars: HTMLElement | null = null;
  let isDestroyed = false;
  let isAnimating = false;
  let orbitStartTime = 0;
  let lastFrameTime = 0;
  const resourceTracker: ResourceTracker = createResourceTracker();

  // Animation state getter from controller
  let getAnimationState: AnimationStateGetter = () => DEFAULT_ANIMATION_STATE;

  // Change detection state for DOM updates
  let lastVisibleBody: 'sun' | 'moon' | null = null;
  let lastStarOpacity: string | null = null;

  /** Calculate celestial body position on arc. */
  function calculatePosition(progress: number, isLeftToRight: boolean): { x: number; y: number } {
    const startAngle = isLeftToRight ? 180 : 0;
    const endAngle = isLeftToRight ? 0 : 180;
    const angle = startAngle + (endAngle - startAngle) * progress;
    const radians = (angle * Math.PI) / 180;

    const centerX = 50;
    const centerY = 85;
    const radiusX = 40;
    const radiusY = 30;

    return {
      x: centerX + Math.cos(radians) * radiusX,
      y: centerY - Math.sin(radians) * radiusY,
    };
  }

  /** Update celestial positions based on elapsed time. */
  function updatePositions(currentTime: number): void {
    if (!wrapper || !sun || !moon || !stars) return;

    const elapsed = currentTime - orbitStartTime;
    const cyclePosition = elapsed % LANDING_ORBIT_DURATION_MS;
    const halfCycle = LANDING_ORBIT_DURATION_MS / 2;

    const isDay = cyclePosition < halfCycle;
    const progress = isDay
      ? cyclePosition / halfCycle
      : (cyclePosition - halfCycle) / halfCycle;

    // Update sky background (only if state changed)
    if ((isDay && wrapper.classList.contains('is-night')) || 
        (!isDay && !wrapper.classList.contains('is-night'))) {
      wrapper.classList.toggle('is-night', !isDay);
    }

    // Change detection: Only update DOM if visible body changed
    const visibleBody = isDay ? 'sun' : 'moon';
    if (visibleBody !== lastVisibleBody) {
      lastVisibleBody = visibleBody;
      sun.style.opacity = isDay ? '1' : '0';
      moon.style.opacity = isDay ? '0' : '1';
      const starsOpacity = isDay ? '0' : '0.6';
      if (starsOpacity !== lastStarOpacity) {
        lastStarOpacity = starsOpacity;
        stars.style.opacity = starsOpacity;
      }
    }

    // Update position (always needed as body orbits)
    if (isDay) {
      const sunPos = calculatePosition(progress, true);
      sun.style.left = `${sunPos.x}%`;
      sun.style.top = `${sunPos.y}%`;
    } else {
      const moonPos = calculatePosition(progress, false);
      moon.style.left = `${moonPos.x}%`;
      moon.style.top = `${moonPos.y}%`;
    }
  }

  /** Animation loop. */
  function animate(currentTime: number): void {
    if (!isAnimating || isDestroyed) return;
    if (!shouldEnableAnimations(getAnimationState)) {
      isAnimating = false;
      return;
    }

    // Throttle to target frame rate
    const elapsed = currentTime - lastFrameTime;
    if (elapsed >= TARGET_FRAME_INTERVAL_MS) {
      lastFrameTime = currentTime;
      updatePositions(currentTime);
    }

    safeRequestAnimationFrame(animate, resourceTracker);
  }

  /** Start animation loop. */
  function startAnimation(): void {
    if (isAnimating || isDestroyed) return;
    isAnimating = true;
    orbitStartTime = performance.now();
    lastFrameTime = performance.now();
    safeRequestAnimationFrame(animate, resourceTracker);
  }

  /** Stop animation and show static state. */
  function stopAnimation(): void {
    isAnimating = false;
    // Show sun at noon position
    if (sun) {
      sun.style.left = '50%';
      sun.style.top = '55%';
      sun.style.opacity = '0.7';
    }
    if (moon) {
      moon.style.opacity = '0';
    }
    if (stars) {
      stars.style.opacity = '0';
    }
    if (wrapper) {
      wrapper.classList.remove('is-night');
      wrapper.classList.add('is-paused');
    }
  }

  /** Create star elements. */
  function createStars(container: HTMLElement): HTMLElement {
    const starsEl = document.createElement('div');
    starsEl.className = 'landing-stars';

    // Create random stars
    for (let i = 0; i < 30; i++) {
      const star = document.createElement('div');
      star.className = 'landing-star';
      star.style.width = `${1 + Math.random() * 2}px`;
      star.style.height = `${1 + Math.random() * 2}px`;
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 50}%`;
      star.style.opacity = String(0.3 + Math.random() * 0.7);
      starsEl.appendChild(star);
    }

    container.appendChild(starsEl);
    return starsEl;
  }

  /** Create sun element. */
  function createSun(container: HTMLElement): HTMLElement {
    const sunEl = document.createElement('div');
    sunEl.className = 'landing-sun';
    container.appendChild(sunEl);
    return sunEl;
  }

  /** Create moon element. */
  function createMoon(container: HTMLElement): HTMLElement {
    const moonEl = document.createElement('div');
    moonEl.className = 'landing-moon';
    container.appendChild(moonEl);
    return moonEl;
  }

  return {
    mount(targetContainer: HTMLElement, context?: MountContext): void {
      if (isDestroyed || wrapper) return;

      // Store the getter from controller
      if (context?.getAnimationState) {
        getAnimationState = context.getAnimationState;
      }

      // Clear container and add theme class
      targetContainer.replaceChildren();
      targetContainer.classList.add('landing-theme-background--akhil-square-shadow');
      targetContainer.setAttribute('aria-hidden', 'true');

      // Use targetContainer as wrapper (it's already fixed positioned by base CSS)
      wrapper = targetContainer;

      // Create celestial elements
      stars = createStars(wrapper);
      sun = createSun(wrapper);
      moon = createMoon(wrapper);

      // Start animation if allowed
      if (shouldEnableAnimations(getAnimationState)) {
        startAnimation();
      } else {
        stopAnimation();
      }
    },

    setSize(_width: number, _height: number): void {
      // No size-dependent updates needed
    },

    onAnimationStateChange(_context: AnimationStateContext): void {
      if (shouldEnableAnimations(getAnimationState) && !isDestroyed) {
        wrapper?.classList.remove('is-paused');
        startAnimation();
      } else {
        stopAnimation();
      }
    },

    destroy(): void {
      isDestroyed = true;
      isAnimating = false;

      // Clear tracked resources
      cancelAll(resourceTracker);

      // Clear child elements (container is managed by parent, just clear its contents)
      if (wrapper) {
        wrapper.replaceChildren();
        wrapper.classList.remove('is-night', 'is-paused');
        wrapper = null;
      }

      sun = null;
      moon = null;
      stars = null;
    },

    getElementCount(): { total: number; animated: number } {
      const total = stars ? 32 : 0; // 30 stars + sun + moon
      const animatedCount = isAnimating && !isDestroyed ? total : 0;
      return { total, animated: animatedCount };
    },
  };
}
