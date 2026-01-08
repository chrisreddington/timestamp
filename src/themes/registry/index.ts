/**
 * Theme Registry - Single Source of Truth
 *
 * Canonical entry point for all theme registry functionality.
 * Import from `@themes/registry` for all theme-related utilities.
 *
 * To create a new theme, run: `npm run theme create my-theme`
 */

// Core: Registry data, types, and constants
export {
  DEFAULT_THEME_ID,
  THEME_REGISTRY,
  type ThemeId,
  type ThemeMetadata,
  type ThemeRegistryEntry
} from './registry-core';

// Metadata: Synchronous, lightweight accessors
export {
  getThemeAuthor,
  getThemeColorOverrides,
  getThemeDependencies,
  getThemeDisplayName,
  getThemeMetadata,
  getThemePublishedDate,
  getThemeTags,
  isNewTheme
} from './registry-metadata';

// Validation: Type guards and validation utilities
export {
  getThemeIds,
  getValidThemes,
  isValidThemeId,
  validateThemeId
} from './registry-validation';

// Loaders: Async theme loading utilities
export { getLandingPageRendererFactory, loadThemeSafe } from './registry-loaders';

