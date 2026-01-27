/**
 * Theme Sync Module
 *
 * Consolidates all theme synchronization operations:
 * - E2E fixtures
 * - Issue templates
 * - Theme READMEs
 */

export { syncFixtures, checkFixturesSync } from './fixtures.js';
export {
  syncTemplates,
  checkTemplatesSync,
  extractThemeNames,
  extractThemeLabelData,
  extractAllThemeIds,
  extractAllThemeMetadata,
} from './templates.js';
export type { ThemeLabelData, ThemeMetadataFull } from './templates.js';
export {
  syncReadmes,
  checkReadmesSync,
  generateMasterReadme,
  generateThemeReadme,
  generateDependenciesSection,
  getNextNewYear,
  getNextValentinesDay,
  getNextProductLaunch,
} from './readmes.js';
