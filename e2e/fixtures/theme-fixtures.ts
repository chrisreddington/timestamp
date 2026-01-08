/**
 * Theme fixtures for E2E tests.
 *
 * ⚠️  AUTO-GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * This file is generated from src/themes/registry/index.ts
 * It syncs automatically when running: npm run test:e2e
 *
 * Manual sync: npm run theme sync:fixtures
 * CI validation: npm run theme sync:fixtures -- --check
 */

/**
 * Theme IDs - derived from THEME_REGISTRY keys.
 */
const THEME_IDS = ["contribution-graph","fireworks","ring"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeFixture {
  id: ThemeId;
  supportsWorldMap: boolean;
}

/**
 * Theme fixtures derived from THEME_REGISTRY configs.
 */
export const THEME_FIXTURES: ThemeFixture[] = [
  {
    id: "contribution-graph",
    supportsWorldMap: true
  },
  {
    id: "fireworks",
    supportsWorldMap: true
  },
  {
    id: "ring",
    supportsWorldMap: true
  }
];

/**
 * Get themes that support world map visualization.
 */
export function getWorldMapThemes(): ThemeFixture[] {
  return THEME_FIXTURES.filter((t) => t.supportsWorldMap);
}

/**
 * Get theme IDs for iteration in tests.
 */
export function getThemeIdsForTest(): ThemeId[] {
  return [...THEME_IDS];
}
