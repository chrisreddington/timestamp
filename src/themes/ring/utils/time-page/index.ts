/**
 * Time Page Helpers
 *
 * Animation and state management helpers for the ring time page renderer.
 * Extracted from renderer to keep factory clean and helpers testable.
 */

import { safeRequestAnimationFrame, shouldEnableAnimations } from '@themes/shared';
import type { AnimationStateGetter, ResourceTracker } from '@themes/shared/types';

import type { IntensityLevel, ThemeElements } from '../ui/ui-builder';
import {
  showCelebration,
  showCountdown,
  startCelebrationAnimation,
  stopCelebrationAnimation,
  updatePulsingRing,
} from '../ui/ui-builder';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Intensity levels for ring animation based on time remaining.
 * Each level has a speed multiplier and visual intensity (0-1).
 */
export const INTENSITY_LEVELS = {
  CALM: { speedMultiplier: 1, intensity: 0.3, threshold: 60 },      // >60s
  BUILDING: { speedMultiplier: 1.5, intensity: 0.5, threshold: 30 }, // 30-60s
  INTENSE: { speedMultiplier: 2.5, intensity: 0.7, threshold: 10 },  // 10-30s
  FINALE: { speedMultiplier: 4, intensity: 1.0, threshold: 0 },      // <10s
} as const;

/** Base pulse speed (lower = faster). */
export const BASE_PULSE_SPEED = 0.002;

/** Target frame interval for throttling (33ms = ~30fps, saves CPU vs 60fps). */
export const TARGET_FRAME_INTERVAL_MS = 33;

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * Theme animation phase - LOCAL state for the pulsing ring animation.
 *
 * IMPORTANT: This is NOT the orchestrator's lifecycle state (COUNTING/CELEBRATING/CELEBRATED).
 * This tracks WHERE we are in our animation sequence:
 * - 'idle': No animation running (paused or reduced motion)
 * - 'pulsing': Ring is actively pulsing
 * - 'celebrating': Playing celebration animation (traveling light)
 */
export type AnimationPhase = 'idle' | 'pulsing' | 'celebrating';

/**
 * Renderer state object - explicit state for testability and inspection.
 *
 * Using state object pattern instead of closure variables makes state:
 * - Inspectable in debugger
 * - Testable (can verify state transitions)
 * - Explicit (all state visible in one place)
 */
export interface RendererState {
  container: HTMLElement | null;
  elements: ThemeElements | null;
  resourceTracker: ResourceTracker;
  getAnimationState: AnimationStateGetter;

  // Animation-specific state (LOCAL to theme)
  animationPhase: AnimationPhase;
  pulseProgress: number;           // 0-1 for smooth pulsing
  intensityLevel: IntensityLevel;  // Current intensity based on time
  totalSecondsRemaining: number;   // Cached for intensity calculation
  lastFrameTime: number;           // For frame throttling (performance)
}

// =============================================================================
// STATE HELPERS
// =============================================================================

/** Check if renderer is ready (has container and elements). */
export function isRendererReady(state: RendererState): boolean {
  return state.container !== null && state.elements !== null;
}

// =============================================================================
// INTENSITY CALCULATION
// =============================================================================

/**
 * Calculate intensity level based on total seconds remaining.
 * Returns the appropriate level for visual effects.
 */
export function calculateIntensityLevel(totalSeconds: number): IntensityLevel {
  if (totalSeconds > INTENSITY_LEVELS.CALM.threshold) return 'CALM';
  if (totalSeconds > INTENSITY_LEVELS.BUILDING.threshold) return 'BUILDING';
  if (totalSeconds > INTENSITY_LEVELS.INTENSE.threshold) return 'INTENSE';
  return 'FINALE';
}

/**
 * Update state with new time and apply intensity level to UI.
 */
export function updateIntensity(state: RendererState, totalMs: number): void {
  const totalSeconds = Math.floor(totalMs / 1000);
  state.totalSecondsRemaining = totalSeconds;

  const newLevel = calculateIntensityLevel(totalSeconds);
  if (newLevel !== state.intensityLevel) {
    state.intensityLevel = newLevel;
    // Update CSS class for intensity-based styling
    if (state.elements) {
      const ring = state.elements.pulsingRing;
      ring.dataset.intensity = newLevel.toLowerCase();
    }
  }
}

// =============================================================================
// ANIMATION FUNCTIONS
// =============================================================================

/**
 * Start the pulsing ring animation loop.
 *
 * Uses safeRequestAnimationFrame for automatic cleanup tracking.
 * The animation speed scales based on intensity level.
 * Throttled to ~30fps for better performance (no visual difference for pulsing).
 */
export function startPulsingAnimation(state: RendererState): void {
  if (state.animationPhase === 'pulsing') return; // Already running

  state.animationPhase = 'pulsing';
  state.lastFrameTime = performance.now();

  function animate(currentTime: number): void {
    // Stop if no longer pulsing or renderer destroyed
    if (state.animationPhase !== 'pulsing' || !isRendererReady(state)) return;

    // Check if we should still animate (reduced motion, tab hidden, etc.)
    if (!shouldEnableAnimations(state.getAnimationState)) {
      state.animationPhase = 'idle';
      updatePulsingRing(state.elements!, 0, 'CALM'); // Reset to no pulse
      return;
    }

    // Throttle to ~30fps for performance (pulsing doesn't need 60fps)
    const elapsed = currentTime - state.lastFrameTime;
    if (elapsed < TARGET_FRAME_INTERVAL_MS) {
      safeRequestAnimationFrame(animate, state.resourceTracker);
      return;
    }
    state.lastFrameTime = currentTime;

    // Get current intensity config
    const intensityConfig = INTENSITY_LEVELS[state.intensityLevel];
    const speed = BASE_PULSE_SPEED * intensityConfig.speedMultiplier;

    // Update pulse progress (0 to 1, then wrap)
    state.pulseProgress = (state.pulseProgress + speed) % 1;

    // Apply visual update to the pulsing ring with intensity
    updatePulsingRing(state.elements!, state.pulseProgress, state.intensityLevel);

    // Schedule next frame (automatically tracked for cleanup)
    safeRequestAnimationFrame(animate, state.resourceTracker);
  }

  // Start the loop
  safeRequestAnimationFrame(animate, state.resourceTracker);
}

/** Stop the pulsing animation. */
export function stopPulsingAnimation(state: RendererState): void {
  if (state.animationPhase !== 'pulsing') return;

  state.animationPhase = 'idle';
  state.pulseProgress = 0;

  // Visual reset
  if (state.elements) {
    updatePulsingRing(state.elements, 0, 'CALM');
  }
}

/**
 * Start the celebration animation (traveling light around ring).
 * Throttled to ~30fps for performance.
 */
export function startCelebrationLoop(state: RendererState): void {
  if (state.animationPhase !== 'celebrating' || !isRendererReady(state)) return;

  let celebrationProgress = 0;
  let lastCelebrationFrame = performance.now();
  const CELEBRATION_SPEED = 0.008; // Speed of light traveling around ring

  function animateCelebration(currentTime: number): void {
    if (state.animationPhase !== 'celebrating' || !isRendererReady(state)) return;

    if (!shouldEnableAnimations(state.getAnimationState)) {
      // Still show celebration, but no animation
      return;
    }

    // Throttle to ~30fps
    const elapsed = currentTime - lastCelebrationFrame;
    if (elapsed < TARGET_FRAME_INTERVAL_MS) {
      safeRequestAnimationFrame(animateCelebration, state.resourceTracker);
      return;
    }
    lastCelebrationFrame = currentTime;

    celebrationProgress = (celebrationProgress + CELEBRATION_SPEED) % 1;
    startCelebrationAnimation(state.elements!, celebrationProgress);

    safeRequestAnimationFrame(animateCelebration, state.resourceTracker);
  }

  safeRequestAnimationFrame(animateCelebration, state.resourceTracker);
}

/**
 * Handle animation state changes from orchestrator.
 *
 * This is called when:
 * - Tab visibility changes (hidden = pause, visible = resume)
 * - User toggles reduced motion preference
 * - Overlay opens/closes (modal, menu)
 *
 * The theme should pause/resume its LOCAL animation based on this.
 */
export function handleAnimationStateChange(state: RendererState): void {
  if (!isRendererReady(state)) return;

  if (shouldEnableAnimations(state.getAnimationState)) {
    // Animations allowed - resume appropriate animation
    if (state.animationPhase === 'idle') {
      startPulsingAnimation(state);
    } else if (state.animationPhase === 'celebrating') {
      startCelebrationLoop(state);
    }
  } else {
    // Animations should stop - but keep visual state
    if (state.animationPhase === 'pulsing') {
      state.animationPhase = 'idle';
    }
  }
}

// =============================================================================
// LIFECYCLE HELPERS
// =============================================================================

/**
 * Reset UI to counting state.
 * Called when entering COUNTING state (e.g., timezone switch).
 */
export function resetToCounting(state: RendererState): void {
  if (!isRendererReady(state)) return;

  // Stop celebration animation, reset intensity
  stopCelebrationAnimation(state.elements!);
  state.animationPhase = 'idle';
  state.intensityLevel = 'CALM';
  state.totalSecondsRemaining = Infinity;

  showCountdown(state.elements!);

  // Resume pulsing if animations are allowed
  if (shouldEnableAnimations(state.getAnimationState)) {
    startPulsingAnimation(state);
  }
}

/**
 * Switch to celebrating state with animation.
 * Called when timer hits zero.
 */
export function startCelebrating(state: RendererState, message: string): void {
  if (!isRendererReady(state)) return;

  // Stop pulsing, switch to celebration phase
  stopPulsingAnimation(state);
  state.animationPhase = 'celebrating';

  showCelebration(state.elements!, message);

  // Start traveling light animation if animations allowed
  if (shouldEnableAnimations(state.getAnimationState)) {
    startCelebrationLoop(state);
  }
}

/**
 * Show static celebration (no animation).
 * Called when entering CELEBRATED state (e.g., TZ switch).
 */
export function showStaticCelebration(state: RendererState, message: string): void {
  if (!isRendererReady(state)) return;

  // Stop any animation, show static celebration
  stopPulsingAnimation(state);
  stopCelebrationAnimation(state.elements!);
  state.animationPhase = 'idle';

  showCelebration(state.elements!, message);
}

// =============================================================================
// CLEANUP HELPERS
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
