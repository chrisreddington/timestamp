/**
 * Sun/Moon Shadow Rotator Theme Configuration
 *
 * Sun & Moon shadow theme - countdown digits cast shadows that rotate
 * based on celestial body position in the sky.
 *
 * IMPORTANT: The ThemeConfig here is the source of truth for theme metadata.
 * The registry imports from this file to avoid duplication.
 */

import type { ThemeConfig } from '@themes/shared/types';

// =============================================================================
// ANIMATION CONSTANTS
// =============================================================================

/** Sun/Moon orbit duration in milliseconds (5 minutes = 300000ms for natural animation). */
export const ORBIT_DURATION_MS = 300000;

/** Sun arc angles (degrees from horizontal). */
export const SUN_START_ANGLE = 180; // Left horizon
export const SUN_END_ANGLE = 0;     // Right horizon

/** Moon arc angles (opposite of sun). */
export const MOON_START_ANGLE = 0;
export const MOON_END_ANGLE = 180;

/** Orbit radius as percentage of container size. */
export const ORBIT_RADIUS_PERCENT = 40;

/** Shadow configuration. */
export const SHADOW_CONFIG = {
  /** Maximum shadow blur (px). */
  maxBlur: 20,
  /** Maximum shadow offset (px). */
  maxOffset: 30,
  /** Shadow opacity. */
  opacity: 0.6,
} as const;

// =============================================================================
// THEME CONFIGURATION
// =============================================================================

/**
 * Theme configuration for Sun/Moon Shadow Rotator.
 *
 * @remarks
 * Features sun and moon orbiting the screen, casting dynamic shadows
 * on the countdown digits. Shadow direction follows the light source.
 */
export const AKHIL_SQUARE_SHADOW_CONFIG: ThemeConfig = {
  id: 'akhil-square-shadow',
  name: 'Sun/Moon Shadow Rotator',
  description: 'Countdown with sun/moon casting rotating shadows on digits',
  publishedDate: '2026-01-08',
  author: 'shahiakhilesh1304',
  tags: ['countdown', 'shadow', 'sun', 'moon', 'celestial'],
  dependencies: [
    { name: 'suncalc', url: 'https://github.com/mourner/suncalc' },
  ],
  supportsWorldMap: false, // Theme has its own sky visualization
  availableInIssueTemplate: true,
  optionalComponents: {
    timezoneSelector: true,
    worldMap: false, // Disabled - theme has built-in celestial display
  },
  colors: {
    dark: {
      accentPrimary: '#fbbf24',   // Golden sun accent
      accentSecondary: '#a78bfa', // Purple moon accent
    },
    light: {
      accentPrimary: '#f59e0b',   // Amber sun for light mode
      accentSecondary: '#8b5cf6', // Violet moon for light mode
    },
  },
};
