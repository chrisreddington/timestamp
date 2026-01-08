/**
 * Ring Theme Configuration
 *
 * Centralized settings for visuals, animations, and ThemeConfig.
 *
 * IMPORTANT: The ThemeConfig here is the source of truth for theme metadata.
 * The registry imports from this file to avoid duplication.
 */

import type { ThemeConfig } from '@themes/shared/types';

// =============================================================================
// THEME CONFIGURATION
// =============================================================================

/**
 * Theme configuration for Ring.
 *
 * @remarks
 * This is the source of truth for theme metadata. The registry imports
 * from this file to avoid duplication of id, name, description, etc.
 */
export const RING_CONFIG: ThemeConfig = {
  id: 'ring',
  name: 'Ring',
  description: 'A countdown theme with a pulsing ring animation',
  publishedDate: '2026-01-08',
  author: 'chrisreddington',
  tags: ['countdown', 'animation', 'pulsing'],
  /**
   * External npm packages used by this theme. Generates README Dependencies section.
   * These are used to showcase the dependencies used in the theme's auto-generated readme
   * and as a tooltip in the theme selection UI. The intent is to callback to the great
   * open source projects that power our themes!
   *
   * @example
   * dependencies: [
   *   \{ name: 'package-name', url: 'https://github.com/owner/package' \}
   * ]
   */
  dependencies: [],
  supportsWorldMap: true,
  availableInIssueTemplate: true,
  optionalComponents: {
    timezoneSelector: true,
    worldMap: true,
  },
  colors: {
    dark: {
      accentPrimary: '#58a6ff',   // Blue accent for dark mode
      accentSecondary: '#8b949e', // Gray accent for dark mode
      // Optional overrides (uncomment to customize):
      // textOnAccent: '#ffffff',   // Text color on accent backgrounds (buttons, checkmarks)
      // success: '#238636',        // Success state color
      // textOnSuccess: '#ffffff',  // Text color on success backgrounds
      // error: '#f85149',          // Error state color
      // focusRing: '#58a6ff',      // Keyboard focus indicator
    },
    light: {
      accentPrimary: '#0969da',   // Darker blue for light mode
      accentSecondary: '#656d76', // Darker gray for light mode
      // Optional overrides (uncomment to customize):
      // textOnAccent: '#ffffff',   // Text color on accent backgrounds (buttons, checkmarks)
      // success: '#1a7f37',        // Success state color
      // textOnSuccess: '#ffffff',  // Text color on success backgrounds
      // error: '#cf222e',          // Error state color
      // focusRing: '#0969da',      // Keyboard focus indicator
    },
  },
};
