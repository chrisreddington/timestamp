/**
 * Ambient activity animation for canvas renderer.
 *
 * PERFORMANCE OPTIMIZATION: Instead of CSS animations on 5000+ DOM elements,
 * ambient activity is handled by updating square states and rendering to a
 * single canvas. This reduces compositor layers from thousands to one.
 *
 * Animation uses smooth easing: fade-in → hold → fade-out
 * Runs at 30fps (throttled) for efficiency.
 */

import type { ActivityPhase } from '../../config';
import { getPhaseConfigByName, getWeightedIntensity } from '../../config';
import type { CanvasGridState } from './state';
import { markDirty } from './state';

// =============================================================================
// TYPES
// =============================================================================

/** Active ambient animation. */
interface AmbientAnimation {
  /** Square index in grid. */
  index: number;
  /** Target intensity (1-4). */
  targetIntensity: number;
  /** Animation start time (ms). */
  startTime: number;
  /** Animation duration (ms). */
  duration: number;
}

/** Ambient activity state. */
export interface AmbientState {
  /** Active animations. */
  animations: Map<number, AmbientAnimation>;
  /** Current activity phase. */
  phase: ActivityPhase;
  /** Whether activity is running. */
  isRunning: boolean;
  /** Next scheduled tick time. */
  nextTickTime: number;
  /** Cached available squares (invalidated when digit bounds change). */
  availableSquaresCache: number[] | null;
  /** Last digit bounds used for cache (for invalidation detection). */
  lastDigitBoundsHash: string | null;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Base animation durations by intensity (ms). */
const BASE_DURATIONS: Record<number, number> = {
  1: 3200,
  2: 2600,
  3: 2000,
  4: 1600,
};

/** Phase multipliers for animation speed. */
const PHASE_MULTIPLIERS: Record<ActivityPhase, number> = {
  calm: 1.8,
  building: 1.3,
  intense: 1.0,
  final: 0.7,
};

/** Duration randomness range (±20%). */
const DURATION_VARIANCE = 0.2;

/** Get animation duration for intensity and phase with randomness. */
function getAnimationDuration(intensity: number, phase: ActivityPhase): number {
  const base = BASE_DURATIONS[intensity] ?? 2500;
  const multiplier = PHASE_MULTIPLIERS[phase] ?? 1;
  const baseDuration = base * multiplier;
  
  // Add ±20% randomness for organic feel
  const variance = baseDuration * DURATION_VARIANCE;
  const randomOffset = (Math.random() * 2 - 1) * variance; // -variance to +variance
  
  return Math.max(1000, baseDuration + randomOffset);
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/** Create initial ambient state. */
export function createAmbientState(): AmbientState {
  return {
    animations: new Map(),
    phase: 'calm',
    isRunning: false,
    nextTickTime: 0,
    availableSquaresCache: null,
    lastDigitBoundsHash: null,
  };
}

/**
 * Check if square is in digit bounding box.
 */
function isInDigitBounds(
  col: number,
  row: number,
  bounds: CanvasGridState['digitBounds']
): boolean {
  if (!bounds) return false;
  return (
    col >= bounds.minCol &&
    col <= bounds.maxCol &&
    row >= bounds.minRow &&
    row <= bounds.maxRow
  );
}

/**
 * Generate hash of digit bounds for cache invalidation.
 */
function getDigitBoundsHash(bounds: CanvasGridState['digitBounds']): string {
  if (!bounds) return 'none';
  return `${bounds.minCol},${bounds.maxCol},${bounds.minRow},${bounds.maxRow}`;
}

/**
 * Get available squares for ambient activity.
 * PERFORMANCE: Results are cached and only recalculated when digit bounds change.
 * Excludes: digit area, currently animating, walls, messages.
 */
function getAvailableSquares(grid: CanvasGridState, ambient: AmbientState): number[] {
  // Check if cache is valid (digit bounds haven't changed)
  const currentBoundsHash = getDigitBoundsHash(grid.digitBounds);
  
  if (
    ambient.availableSquaresCache !== null &&
    ambient.lastDigitBoundsHash === currentBoundsHash
  ) {
    // Filter out currently animating squares from cached list
    return ambient.availableSquaresCache.filter(i => !ambient.animations.has(i));
  }

  // Cache miss - rebuild available squares list
  const available: number[] = [];

  for (let i = 0; i < grid.squares.length; i++) {
    const square = grid.squares[i];
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);

    if (
      !square.isDigit &&
      !square.isWall &&
      !square.isMessage &&
      !isInDigitBounds(col, row, grid.digitBounds)
    ) {
      available.push(i);
    }
  }

  // Update cache
  ambient.availableSquaresCache = available;
  ambient.lastDigitBoundsHash = currentBoundsHash;

  // Filter out currently animating squares
  return available.filter(i => !ambient.animations.has(i));
}

// =============================================================================
// ORGANIC AMBIENT MANAGEMENT
// =============================================================================

/**
 * Continuously manage ambient animations for organic feel.
 * Instead of batched ticks, this adds/removes squares individually with
 * randomized timing to create a "living" atmosphere without visible waves.
 * 
 * Called every frame - uses internal timing to add new squares gradually.
 */
export function manageAmbientActivity(
  grid: CanvasGridState,
  ambient: AmbientState,
  now: number
): void {
  if (!ambient.isRunning) return;

  const config = getPhaseConfigByName(ambient.phase);
  const available = getAvailableSquares(grid, ambient);

  if (available.length === 0) return;

  // Calculate target concurrent animations
  const totalSquares = grid.squares.length - (grid.digitIndices.size * 2); // Rough estimate
  const targetActive = Math.max(
    1,
    Math.ceil((totalSquares * config.coveragePerMille) / 1000)
  );

  const currentActive = ambient.animations.size;

  // Add new squares to reach target, but do it gradually for organic feel
  if (currentActive < targetActive && now >= ambient.nextTickTime) {
    // Calculate how many to add this frame
    const deficit = targetActive - currentActive;
    // Add up to 20% of deficit per tick, minimum 1, to build up gradually
    const toAdd = Math.max(1, Math.min(deficit, Math.ceil(targetActive * 0.2)));
    
    // Stagger the next addition slightly for continuous organic flow
    // Use a short interval (50-150ms) so it builds up quickly but not all at once
    const avgDuration = 2500 * PHASE_MULTIPLIERS[ambient.phase];
    const addInterval = Math.max(50, Math.min(150, avgDuration / (targetActive * 4)));
    
    ambient.nextTickTime = now + addInterval;

    // Add multiple squares this frame
    for (let i = 0; i < toAdd && available.length > 0; i++) {
      // Random selection (swap and pop)
      const idx = Math.floor(Math.random() * available.length);
      const squareIndex = available[idx];
      available[idx] = available[available.length - 1];
      available.pop();

      const intensity = getWeightedIntensity();
      const duration = getAnimationDuration(intensity, ambient.phase);

      ambient.animations.set(squareIndex, {
        index: squareIndex,
        targetIntensity: intensity,
        startTime: now,
        duration,
      });

      const square = grid.squares[squareIndex];
      square.isAmbient = true;
      square.ambientTargetIntensity = intensity;
      markDirty(grid, squareIndex);
    }
  }
}

/**
 * Update ambient animation progress and remove completed animations.
 * Called every frame (throttled to 30fps by renderer).
 *
 * @returns true if any animations are active
 */
export function updateAmbientAnimations(
  grid: CanvasGridState,
  ambient: AmbientState,
  now: number
): boolean {
  if (!ambient.isRunning) return false;

  let hasActive = false;

  for (const [index, anim] of ambient.animations) {
    const elapsed = now - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);

    const square = grid.squares[index];
    if (!square) {
      ambient.animations.delete(index);
      continue;
    }

    if (progress >= 1) {
      // Animation complete - reset square
      square.isAmbient = false;
      square.ambientProgress = 0;
      square.ambientTargetIntensity = 0;
      if (!square.isDigit && !square.isWall && !square.isMessage) {
        square.intensity = 0;
      }
      ambient.animations.delete(index);
      markDirty(grid, index);
    } else {
      // Update progress
      square.ambientProgress = progress;
      hasActive = true;
      markDirty(grid, index);
    }
  }

  return hasActive || ambient.animations.size > 0;
}

/**
 * Get interpolated intensity for ambient animation.
 * Uses ease-in-out curve: fade-in → hold → fade-out
 */
export function getAmbientIntensity(progress: number, targetIntensity: number): number {
  // Keyframes: 0-25% fade-in, 25-50% hold, 50-100% fade-out
  let opacity: number;

  if (progress < 0.25) {
    // Fade in (0 → 1)
    opacity = progress / 0.25;
  } else if (progress < 0.50) {
    // Hold at max
    opacity = 1;
  } else {
    // Fade out (1 → 0)
    opacity = 1 - (progress - 0.50) / 0.50;
  }

  // Ease-in-out
  opacity = opacity < 0.5
    ? 2 * opacity * opacity
    : 1 - Math.pow(-2 * opacity + 2, 2) / 2;

  return opacity * targetIntensity;
}

// =============================================================================
// CONTROL
// =============================================================================

/** Start ambient activity. */
export function startAmbient(ambient: AmbientState): void {
  ambient.isRunning = true;
  ambient.nextTickTime = 0;
}

/**
 * Invalidate ambient cache.
 * Call when grid dimensions change (resize) to force recalculation of available squares.
 */
export function invalidateAmbientCache(ambient: AmbientState): void {
  ambient.availableSquaresCache = null;
  ambient.lastDigitBoundsHash = null;
}

/** Stop ambient activity. */
export function stopAmbient(ambient: AmbientState, grid: CanvasGridState): void {
  ambient.isRunning = false;

  // Clear all active animations
  for (const [index] of ambient.animations) {
    const square = grid.squares[index];
    if (square) {
      square.isAmbient = false;
      square.ambientProgress = 0;
      square.ambientTargetIntensity = 0;
      if (!square.isDigit && !square.isWall && !square.isMessage) {
        square.intensity = 0;
      }
      markDirty(grid, index);
    }
  }

  ambient.animations.clear();
  
  // Invalidate cache (digit bounds may have changed)
  ambient.availableSquaresCache = null;
  ambient.lastDigitBoundsHash = null;
}

/** Set activity phase. */
export function setPhase(ambient: AmbientState, phase: ActivityPhase): void {
  ambient.phase = phase;
}

/** Get tick interval for current phase. */
export function getTickInterval(phase: ActivityPhase): number {
  // Use overlap timing: tick when batch is ~80% complete
  const avgDuration = 2500 * PHASE_MULTIPLIERS[phase];
  const overlapFraction = 0.8;
  return avgDuration * overlapFraction;
}
