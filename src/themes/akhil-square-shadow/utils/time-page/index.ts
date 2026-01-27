/**
 * Time Page Animation Helpers
 *
 * Animation and state management for the Sun & Moon Shadow theme.
 * Handles celestial body orbits and shadow calculations.
 */

import { safeRequestAnimationFrame, shouldEnableAnimations } from '@themes/shared';
import type { AnimationStateGetter, ResourceTracker } from '@themes/shared/types';

import { ORBIT_DURATION_MS } from '../../config';
import type { CelestialBody, ThemeElements } from '../ui/ui-builder';
import {
  applyShadow,
  calculateArcPosition,
  setDayNightMode,
  showCelebration,
  showCountdown,
  updateMoonPosition,
  updateSunPosition,
} from '../ui/ui-builder';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Target frame interval for throttling (33ms = ~30fps). */
export const TARGET_FRAME_INTERVAL_MS = 33;

/** Day/night cycle duration (half of full orbit). */
export const HALF_CYCLE_MS = ORBIT_DURATION_MS / 2;

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * Theme animation phase.
 *
 * - 'idle': No animation running (paused or reduced motion)
 * - 'orbiting': Sun/moon actively orbiting
 * - 'celebrating': Playing celebration animation
 */
export type AnimationPhase = 'idle' | 'orbiting' | 'celebrating';

/**
 * Renderer state object.
 */
export interface RendererState {
  container: HTMLElement | null;
  elements: ThemeElements | null;
  resourceTracker: ResourceTracker;
  getAnimationState: AnimationStateGetter;

  // Animation state
  animationPhase: AnimationPhase;
  orbitStartTime: number;
  lastFrameTime: number;
  currentBody: CelestialBody;
  celebrationProgress: number;
}

// =============================================================================
// STATE HELPERS
// =============================================================================

/** Check if renderer is ready (has container and elements). */
export function isRendererReady(state: RendererState): boolean {
  return state.container !== null && state.elements !== null;
}

// =============================================================================
// ORBIT CALCULATIONS
// =============================================================================

/**
 * Calculate current orbit progress and active celestial body.
 *
 * @param elapsedMs - Milliseconds since animation start
 * @returns Progress (0-1) and which body is active
 */
export function calculateOrbitState(elapsedMs: number): {
  progress: number;
  activeBody: CelestialBody;
  isNight: boolean;
} {
  // Full cycle = sun journey + moon journey
  const cyclePosition = elapsedMs % ORBIT_DURATION_MS;
  const halfCycle = ORBIT_DURATION_MS / 2;

  if (cyclePosition < halfCycle) {
    // First half: sun is up (day)
    return {
      progress: cyclePosition / halfCycle,
      activeBody: 'sun',
      isNight: false,
    };
  } else {
    // Second half: moon is up (night)
    return {
      progress: (cyclePosition - halfCycle) / halfCycle,
      activeBody: 'moon',
      isNight: true,
    };
  }
}

/**
 * Get current light source position based on orbit state.
 *
 * @param progress - Orbit progress (0-1)
 * @param activeBody - Sun or moon
 * @returns X, Y position as percentages
 */
export function getLightSourcePosition(
  progress: number,
  activeBody: CelestialBody
): { x: number; y: number } {
  if (activeBody === 'sun') {
    // Sun moves from left (180°) to right (0°)
    return calculateArcPosition(progress, 180, 0, 40, 35);
  } else {
    // Moon moves from right (0°) to left (180°)
    return calculateArcPosition(progress, 0, 180, 40, 35);
  }
}

// =============================================================================
// ANIMATION FUNCTIONS
// =============================================================================

/**
 * Start the orbital animation loop.
 *
 * Sun and moon orbit the sky, casting shadows on the countdown.
 */
export function startOrbitAnimation(state: RendererState): void {
  if (state.animationPhase === 'orbiting') return;

  state.animationPhase = 'orbiting';
  state.orbitStartTime = performance.now();
  state.lastFrameTime = performance.now();

  function animate(currentTime: number): void {
    if (state.animationPhase !== 'orbiting' || !isRendererReady(state)) return;

    // Check if animations should run
    if (!shouldEnableAnimations(state.getAnimationState)) {
      state.animationPhase = 'idle';
      // Set static position (sun at noon)
      updateSunPosition(state.elements!, 0.5);
      setDayNightMode(state.elements!, false);
      applyShadow(state.elements!, 50, 45, 'sun');
      return;
    }

    // Throttle to ~30fps
    const elapsed = currentTime - state.lastFrameTime;
    if (elapsed < TARGET_FRAME_INTERVAL_MS) {
      safeRequestAnimationFrame(animate, state.resourceTracker);
      return;
    }
    state.lastFrameTime = currentTime;

    // Calculate orbit state
    const totalElapsed = currentTime - state.orbitStartTime;
    const { progress, activeBody, isNight } = calculateOrbitState(totalElapsed);

    // Update celestial body positions
    if (activeBody === 'sun') {
      updateSunPosition(state.elements!, progress);
      // Moon at opposite position (setting or rising)
      updateMoonPosition(state.elements!, progress < 0.5 ? 0 : 1);
    } else {
      updateMoonPosition(state.elements!, progress);
      // Sun at opposite position
      updateSunPosition(state.elements!, progress < 0.5 ? 1 : 0);
    }

    // Update day/night mode
    setDayNightMode(state.elements!, isNight);

    // Get light position and apply shadow
    const lightPos = getLightSourcePosition(progress, activeBody);
    applyShadow(state.elements!, lightPos.x, lightPos.y, activeBody);

    state.currentBody = activeBody;

    // Continue animation
    safeRequestAnimationFrame(animate, state.resourceTracker);
  }

  safeRequestAnimationFrame(animate, state.resourceTracker);
}

/** Stop the orbital animation. */
export function stopOrbitAnimation(state: RendererState): void {
  if (state.animationPhase !== 'orbiting') return;
  state.animationPhase = 'idle';
}

/**
 * Start celebration animation.
 *
 * Sun and moon both appear and pulse during celebration.
 */
export function startCelebrationLoop(state: RendererState): void {
  if (state.animationPhase !== 'celebrating' || !isRendererReady(state)) return;

  let lastFrame = performance.now();
  const CELEBRATION_SPEED = 0.01;

  function animateCelebration(currentTime: number): void {
    if (state.animationPhase !== 'celebrating' || !isRendererReady(state)) return;

    if (!shouldEnableAnimations(state.getAnimationState)) {
      return;
    }

    // Throttle to ~30fps
    const elapsed = currentTime - lastFrame;
    if (elapsed < TARGET_FRAME_INTERVAL_MS) {
      safeRequestAnimationFrame(animateCelebration, state.resourceTracker);
      return;
    }
    lastFrame = currentTime;

    // Pulse effect - sun and moon move slightly
    state.celebrationProgress = (state.celebrationProgress + CELEBRATION_SPEED) % 1;
    const pulse = Math.sin(state.celebrationProgress * Math.PI * 2) * 0.1;

    // Position both celestial bodies in the sky
    updateSunPosition(state.elements!, 0.25 + pulse);
    updateMoonPosition(state.elements!, 0.75 - pulse);

    // Apply golden celebration shadow
    applyShadow(state.elements!, 50, 30, 'sun');

    safeRequestAnimationFrame(animateCelebration, state.resourceTracker);
  }

  safeRequestAnimationFrame(animateCelebration, state.resourceTracker);
}

/**
 * Handle animation state changes from orchestrator.
 */
export function handleAnimationStateChange(state: RendererState): void {
  if (!isRendererReady(state)) return;

  if (shouldEnableAnimations(state.getAnimationState)) {
    if (state.animationPhase === 'idle') {
      startOrbitAnimation(state);
    } else if (state.animationPhase === 'celebrating') {
      startCelebrationLoop(state);
    }
  } else {
    if (state.animationPhase === 'orbiting') {
      state.animationPhase = 'idle';
    }
  }
}

// =============================================================================
// LIFECYCLE HELPERS
// =============================================================================

/**
 * Reset UI to counting state.
 */
export function resetToCounting(state: RendererState): void {
  if (!isRendererReady(state)) return;

  state.animationPhase = 'idle';
  state.celebrationProgress = 0;

  showCountdown(state.elements!);

  if (shouldEnableAnimations(state.getAnimationState)) {
    startOrbitAnimation(state);
  }
}

/**
 * Switch to celebrating state with animation.
 */
export function startCelebrating(state: RendererState, message: string): void {
  if (!isRendererReady(state)) return;

  stopOrbitAnimation(state);
  state.animationPhase = 'celebrating';
  state.celebrationProgress = 0;

  // Show both sun and moon during celebration
  state.elements!.sun.classList.remove('is-hidden');
  state.elements!.moon.classList.remove('is-hidden');
  state.elements!.stars.classList.add('is-visible');

  showCelebration(state.elements!, message);

  if (shouldEnableAnimations(state.getAnimationState)) {
    startCelebrationLoop(state);
  }
}

/**
 * Show static celebration (no animation).
 */
export function showStaticCelebration(state: RendererState, message: string): void {
  if (!isRendererReady(state)) return;

  stopOrbitAnimation(state);
  state.animationPhase = 'idle';

  // Show both celestial bodies
  state.elements!.sun.classList.remove('is-hidden');
  state.elements!.moon.classList.remove('is-hidden');

  showCelebration(state.elements!, message);
}

// =============================================================================
// CLEANUP
// =============================================================================

/** Clear container and reset state. */
export function clearContainer(state: RendererState): void {
  if (state.container) {
    while (state.container.firstChild) {
      state.container.removeChild(state.container.firstChild);
    }
    state.container = null;
  }
  state.elements = null;
  state.animationPhase = 'idle';
}
