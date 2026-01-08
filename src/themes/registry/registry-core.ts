/**
 * Theme Registry Core
 *
 * Core registry data, types, and constants.
 * This module is the foundation - other registry modules import from here.
 *
 * @remarks
 * This file is automatically updated when you run `npm run theme create <name>`.
 */

import type { LandingPageRendererFactory, ThemeColors, ThemeConfig, ThemeDependency, TimePageRenderer } from '@core/types';

import { CONTRIBUTION_GRAPH_CONFIG } from '../contribution-graph/config';
// Import theme configs for colors (lightweight imports - no heavy dependencies)
import { FIREWORKS_CONFIG } from '../fireworks/config';
import { RING_CONFIG } from '../ring/config';

/**
 * Static metadata (synchronous, lightweight).
 * Used for theme selection UI without loading full theme code.
 */
export interface ThemeMetadata {
  id: string;
  name: string;
  description: string;
  publishedDate: string;
  tags?: string[];
  dependencies?: ThemeDependency[];
  supportsWorldMap?: boolean;
  availableInIssueTemplate?: boolean;
  author: string | null;
  colors?: ThemeColors;
}

/**
 * Registry entry: metadata + async loader.
 * Theme code and factories loaded on demand.
 */
export interface ThemeRegistryEntry extends ThemeMetadata {
  loadTheme: () => Promise<{
    timePageRenderer: (targetDate: Date) => TimePageRenderer;
    landingPageRenderer: LandingPageRendererFactory;
    config: ThemeConfig;
  }>;
}

type LoadedThemeModule = {
  timePageRenderer: (targetDate: Date) => TimePageRenderer;
  landingPageRenderer: LandingPageRendererFactory;
  config: ThemeConfig;
};

function createRegistryEntry(
  config: ThemeConfig,
  loadTheme: () => Promise<LoadedThemeModule>
): ThemeRegistryEntry {
  return { ...config, loadTheme };
}

/**
 * Theme Registry - Single Source of Truth
 * Themes are automatically added here by `npm run theme create <name>`.
 */
// Stryker disable all: Dynamic imports cannot be mutated
const loadFireworksTheme = async (): Promise<LoadedThemeModule> => {
  const module = await import('../fireworks');
  return {
    timePageRenderer: module.fireworksTimePageRenderer,
    landingPageRenderer: module.fireworksLandingPageRenderer,
    config: module.FIREWORKS_CONFIG,
  };
};

const loadContributionGraphTheme = async (): Promise<LoadedThemeModule> => {
  const module = await import('../contribution-graph');
  return {
    timePageRenderer: module.contributionGraphTimePageRenderer,
    landingPageRenderer: module.contributionGraphLandingPageRenderer,
    config: module.CONTRIBUTION_GRAPH_CONFIG,
  };
};


const loadRingTheme = async (): Promise<LoadedThemeModule> => {
  const module = await import('../ring');
  return {
    timePageRenderer: module.ringTimePageRenderer,
    landingPageRenderer: module.ringLandingPageRenderer,
    config: module.RING_CONFIG,
  };
};

// Stryker restore all

export const THEME_REGISTRY = {
  'contribution-graph': createRegistryEntry(CONTRIBUTION_GRAPH_CONFIG, loadContributionGraphTheme),
  fireworks: createRegistryEntry(FIREWORKS_CONFIG, loadFireworksTheme),
  'ring': createRegistryEntry(RING_CONFIG, loadRingTheme),
} as const satisfies Record<string, ThemeRegistryEntry>;

/** Theme identifiers derived from THEME_REGISTRY keys. */
export type ThemeId = keyof typeof THEME_REGISTRY;

/** Default theme ID used when no theme is specified or invalid. */
export const DEFAULT_THEME_ID: ThemeId = 'contribution-graph';
