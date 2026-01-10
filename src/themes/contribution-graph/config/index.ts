/**
 * Contribution Graph Theme Configuration
 *
 * IMPORTANT: The ThemeConfig here is the source of truth for theme metadata.
 * The registry imports from this file to avoid duplication.
 */

import type { ThemeConfig } from '@core/types';

// =============================================================================
// THEME CONFIGURATION
// =============================================================================

/**
 * Theme configuration for Contribution Graph.
 *
 * Features pixel-art digits on a GitHub-style contribution grid.
 */
export const CONTRIBUTION_GRAPH_CONFIG: ThemeConfig = {
  id: 'contribution-graph',
  name: 'Contribution Graph',
  description: 'GitHub contribution graph aesthetic with pixel-art digits',
  publishedDate: '2026-01-07',
  author: 'chrisreddington',
  tags: ['github', 'pixel-art', 'grid', 'green'],
  dependencies: [],
  supportsWorldMap: true,
  availableInIssueTemplate: true,
  optionalComponents: {
    timezoneSelector: true,
    worldMap: true,
  },
  colors: {
    dark: {
      accentPrimary: '#39d353',   // GitHub green
      accentSecondary: '#26a641',
    },
    light: {
      accentPrimary: '#1a7f37',   // Darker green for light mode
      accentSecondary: '#116329',
    },
  },
};

// =============================================================================
// GRID CONFIGURATION
// =============================================================================

/**
 * Grid rendering configuration.
 * Controls square sizing, spacing, and performance limits.
 */
export const GRID_CONFIG = {
  minSquareSize: 4,
  /** Base square size at 1920px viewport. Scales proportionally for larger screens. */
  baseSquareSize: 16,
  /** Maximum square size (cap for very large screens). */
  maxSquareSize: 32,
  gapRatio: 0.2,
  edgePadding: 4,
} as const;

// =============================================================================
// LAYOUT CONFIGURATION
// =============================================================================

/** Character spacing in grid columns. */
export const CHAR_SPACING = 1;

/** Gap between lines in multi-line mode. */
export const LINE_SPACING = 3;

/** Margin around digits for bounding box. */
export const BOUNDING_BOX_MARGIN = 2;

// =============================================================================
// CSS CLASS CONSTANTS
// =============================================================================

/**
 * CSS class names used throughout the theme.
 * Centralized to prevent string duplication and typos.
 */
export const CSS_CLASSES = {
  /** Base class for all grid squares. */
  SQUARE: 'contribution-graph-square',
  /** Grid container class. */
  GRID: 'contribution-graph-grid',
  /** Ambient animation class (CSS handles full lifecycle). */
  AMBIENT: 'is-ambient',
  /** Digit square class. */
  DIGIT: 'is-digit',
  /** Pulse animation class for digits. */
  PULSE: 'pulse-digit',
  /** Wall build animation class. */
  WALL: 'is-wall',
  /** Celebration message class. */
  MESSAGE: 'is-message',
  /** Phase classes for animation timing. */
  PHASE_CALM: 'phase-calm',
  PHASE_BUILDING: 'phase-building',
  PHASE_INTENSE: 'phase-intense',
  PHASE_FINAL: 'phase-final',
  /** Stagger delay classes for organic batch animation. */
  STAGGER_0: 'stagger-0',
  STAGGER_1: 'stagger-1',
  STAGGER_2: 'stagger-2',
  STAGGER_3: 'stagger-3',
  STAGGER_4: 'stagger-4',
} as const;

// =============================================================================
// PRE-COMPUTED CLASS STRINGS (PERF)
// =============================================================================

/** Map phase names to CSS class names. */
const PHASE_CLASS_MAP: Record<string, string> = {
  calm: CSS_CLASSES.PHASE_CALM,
  building: CSS_CLASSES.PHASE_BUILDING,
  intense: CSS_CLASSES.PHASE_INTENSE,
  final: CSS_CLASSES.PHASE_FINAL,
};

/** Get CSS class for activity phase. */
export function getPhaseClass(phase: string): string {
  return PHASE_CLASS_MAP[phase] ?? CSS_CLASSES.PHASE_CALM;
}

/** Pre-computed base class strings for each intensity (0-4). */
const BASE_CLASS_STRINGS: readonly string[] = [
  `${CSS_CLASSES.SQUARE} intensity-0`,
  `${CSS_CLASSES.SQUARE} intensity-1`,
  `${CSS_CLASSES.SQUARE} intensity-2`,
  `${CSS_CLASSES.SQUARE} intensity-3`,
  `${CSS_CLASSES.SQUARE} intensity-4`,
];

/**
 * Number of stagger delay buckets for organic animation timing.
 * 
 * Squares added in the same tick are randomly assigned a stagger class (0-4)
 * which applies a CSS animation-delay to spread out their start times.
 * This creates overlapping fade-ins/fade-outs within each batch for a more
 * organic, living feel while keeping JS overhead minimal.
 * 
 * Stagger delays are phase-aware:
 * - stagger-0: 0% delay (immediate start)
 * - stagger-1: 8% of animation duration
 * - stagger-2: 16% of animation duration  
 * - stagger-3: 24% of animation duration
 * - stagger-4: 32% of animation duration
 * 
  * For example, in "building" phase (3.59s avg duration):
 * - stagger-0: 0ms
 * - stagger-1: ~287ms
 * - stagger-2: ~574ms
 * - stagger-3: ~862ms
 * - stagger-4: ~1149ms
 * 
 * This spreads the batch across ~1.2s while the animation runs for ~3.6s,
 * creating natural overlap.
 */
export const STAGGER_BUCKET_COUNT = 5;

/** Pre-computed ambient class strings keyed by `${phase}-${intensity}-${stagger}`. */
const AMBIENT_CLASS_STRINGS: Record<string, string> = {};
for (const phase of ['calm', 'building', 'intense', 'final']) {
  for (let intensity = 0; intensity <= 4; intensity++) {
    for (let stagger = 0; stagger < STAGGER_BUCKET_COUNT; stagger++) {
      const key = `${phase}-${intensity}-${stagger}`;
      AMBIENT_CLASS_STRINGS[key] = `${CSS_CLASSES.SQUARE} intensity-${intensity} ${CSS_CLASSES.AMBIENT} ${getPhaseClass(phase)} stagger-${stagger}`;
    }
  }
}

/** Build square class string with intensity and optional additional classes. */
export function buildSquareClass(intensity: number, ...additionalClasses: string[]): string {
  const classes = [CSS_CLASSES.SQUARE, `intensity-${intensity}`, ...additionalClasses];
  return classes.join(' ');
}

/** Get pre-computed base class for intensity. O(1), zero allocation. */
export function getBaseClass(intensity: number): string {
  return BASE_CLASS_STRINGS[intensity] ?? BASE_CLASS_STRINGS[0];
}

/**
 * Get pre-computed ambient class for intensity, phase, and stagger.
 * O(1), zero allocation.
 * 
 * The stagger parameter adds a CSS animation-delay class (stagger-0 through stagger-4)
 * to spread out animation start times within a batch. When omitted, a random stagger
 * is selected, creating organic timing variation.
 * 
 * @param intensity - Color intensity (1-4) determines brightness and base animation duration
 * @param phase - Activity phase name ('calm', 'building', 'intense', 'final')
 * @param stagger - Stagger bucket (0-4) for animation delay. Defaults to random.
 *   - 0: No delay (immediate start)
 *   - 1-4: Increasing delays (8%, 16%, 24%, 32% of animation duration)
 * @returns Pre-computed class string like "contribution-graph-square intensity-2 is-ambient phase-building stagger-3"
 * 
 * @example
 * ```ts
 * // Random stagger (default)
 * getAmbientClass(2, 'building'); // → "...stagger-N" (N = random 0-4)
 * 
 * // Explicit stagger for testing
 * getAmbientClass(3, 'intense', 0); // → "...stagger-0" (no delay)
 * ```
 */
export function getAmbientClass(intensity: number, phase: string, stagger?: number): string {
  const staggerIndex = stagger ?? Math.floor(Math.random() * STAGGER_BUCKET_COUNT);
  return AMBIENT_CLASS_STRINGS[`${phase}-${intensity}-${staggerIndex}`] ?? getBaseClass(intensity);
}

// =============================================================================
// VISUAL CONFIGURATION
// =============================================================================

/**
 * Weighted intensity distribution (favor lower intensities).
 * intensity-1: 50%, intensity-2: 30%, intensity-3: 15%, intensity-4: 5%
 */
export const INTENSITY_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4] as const;

/** Get random weighted intensity (1-4, favors lower values). */
export function getWeightedIntensity(): number {
  return INTENSITY_WEIGHTS[Math.floor(Math.random() * INTENSITY_WEIGHTS.length)];
}

// =============================================================================
// ACTIVITY STAGES
// =============================================================================

export {
type ActivityPhase,
  type ActivityPhaseValues,
  BATCH_OVERLAP_FRACTION,
  clearActivityStageCache,
  getActivityPhase,
  getActivityStageSnapshot,
  getBatchLifetimeMs,
  getOverlapTickIntervalMs,
  getPhaseConfig,
  getPhaseConfigByName,
  MAX_STAGGER_FRACTION} from './activity-stages';

