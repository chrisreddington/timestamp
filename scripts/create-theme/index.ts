#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import {
  generateAssetsMd,
  generateConfigTestTs,
  generateConfigTs,
  generateE2EMobileViewportSpec,
  generateIndexTestTs,
  generateIndexTs,
  generateLandingPageRendererTestTs,
  generateLandingPageRendererTs,
  generateStylesScss,
  generateTestTs,
  generateTestUtilsTs,
  generateTimePageHelpersTestTs,
  generateTimePageHelpersTs,
  generateTimePageRendererTs,
  generateUiBuilderTs,
} from './generators';
import {
  THEMES_DIR,
  normalizeAuthor,
  toKebabCase,
  updateRegistry,
  updateSitemapLastmod,
  validateThemeName,
} from './utils';

/**
 * Print usage instructions and exit.
 * Displays command syntax, arguments, and examples.
 */
function printUsage(): void {
  console.error('Usage: npm run theme create <theme-name> [author]');
  console.error('');
  console.error('Arguments:');
  console.error('  theme-name  Kebab-case theme name (e.g., "my-theme")');
  console.error('  author      Optional GitHub username (without @ prefix)');
  console.error('');
  console.error('Examples:');
  console.error('  npm run theme create neon-glow');
  console.error('  npm run theme create neon-glow chrisreddington');
}

/**
 * Main theme creation function.
 * Creates theme scaffold, registers in THEME_REGISTRY, and updates sitemap.
 *
 * @throws Error if theme name validation fails or theme already exists
 * @throws Never returns - uses process.exit(1) on validation failures
 */
function main(): void {
  const themeNameArg = process.argv[2];
  const authorArg = process.argv[3];

  if (!themeNameArg) {
    printUsage();
    process.exit(1);
  }

  const kebabName = toKebabCase(themeNameArg);
  validateThemeName(kebabName);

  // Normalize author (strips @ prefix if present, validates format)
  const author = normalizeAuthor(authorArg);

  const themeDir = path.join(THEMES_DIR, kebabName);
  fs.mkdirSync(themeDir, { recursive: true });

  // Create subdirectories following fireworks pattern
  const configDir = path.join(themeDir, 'config');
  const renderersDir = path.join(themeDir, 'renderers');
  const testUtilsDir = path.join(themeDir, 'test-utils');
  const utilsDir = path.join(themeDir, 'utils');
  const utilsTimePageDir = path.join(utilsDir, 'time-page');
  const utilsUiDir = path.join(utilsDir, 'ui');
  const e2eDir = path.join(themeDir, 'e2e');
  const imagesDir = path.join(themeDir, 'images');

  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(renderersDir, { recursive: true });
  fs.mkdirSync(testUtilsDir, { recursive: true });
  fs.mkdirSync(utilsTimePageDir, { recursive: true });
  fs.mkdirSync(utilsUiDir, { recursive: true });
  fs.mkdirSync(e2eDir, { recursive: true });
  fs.mkdirSync(imagesDir, { recursive: true });

  // Write theme files
  fs.writeFileSync(path.join(themeDir, 'index.ts'), generateIndexTs(kebabName, author));
  fs.writeFileSync(path.join(themeDir, 'index.test.ts'), generateIndexTestTs(kebabName));
  fs.writeFileSync(path.join(themeDir, 'styles.scss'), generateStylesScss(kebabName));
  fs.writeFileSync(path.join(themeDir, 'ASSETS.md'), generateAssetsMd(kebabName));

  // Config
  fs.writeFileSync(path.join(configDir, 'index.ts'), generateConfigTs(kebabName, author));
  fs.writeFileSync(path.join(configDir, 'index.test.ts'), generateConfigTestTs(kebabName));

  // Renderers
  fs.writeFileSync(path.join(renderersDir, 'time-page-renderer.ts'), generateTimePageRendererTs(kebabName));
  fs.writeFileSync(path.join(renderersDir, 'time-page-renderer.test.ts'), generateTestTs(kebabName));
  fs.writeFileSync(path.join(renderersDir, 'landing-page-renderer.ts'), generateLandingPageRendererTs(kebabName));
  fs.writeFileSync(path.join(renderersDir, 'landing-page-renderer.test.ts'), generateLandingPageRendererTestTs(kebabName));

  // Test utils
  fs.writeFileSync(path.join(testUtilsDir, 'index.ts'), generateTestUtilsTs(kebabName));

  // Utils
  fs.writeFileSync(path.join(utilsTimePageDir, 'index.ts'), generateTimePageHelpersTs(kebabName));
  fs.writeFileSync(path.join(utilsTimePageDir, 'index.test.ts'), generateTimePageHelpersTestTs(kebabName));
  fs.writeFileSync(path.join(utilsUiDir, 'ui-builder.ts'), generateUiBuilderTs(kebabName));

  // E2E tests
  fs.writeFileSync(path.join(e2eDir, 'mobile-viewport.spec.ts'), generateE2EMobileViewportSpec(kebabName));

  // Update registry with new theme
  updateRegistry(kebabName);

  // Update sitemap lastmod (adding a theme is meaningful content change)
  updateSitemapLastmod();

  const authorInfo = author ? `by @${author}` : '(no author specified)';
  console.log(`
✅ Created theme scaffold at: src/themes/${kebabName}/

📁 Generated files:
   - index.ts                  (theme entry point)
   - index.test.ts             (entry point unit tests)
   - styles.scss               (theme styles)
   - ASSETS.md                 (third-party asset documentation)
   - config/
     ├── index.ts              (theme configuration)
     └── index.test.ts         (config tests)
   - renderers/
     ├── time-page-renderer.ts      (countdown display renderer)
     ├── time-page-renderer.test.ts (renderer tests)
     ├── landing-page-renderer.ts   (landing page background)
     └── landing-page-renderer.test.ts (background tests)
   - test-utils/
     └── index.ts              (test helpers)
   - utils/
     ├── time-page/
     │   ├── index.ts          (time page animation helpers)
     │   └── index.test.ts     (helpers tests)
     └── ui/
         └── ui-builder.ts     (UI creation utilities)
   - e2e/
     └── mobile-viewport.spec.ts (E2E tests)
   - images/                   (preview images will be generated here)

👤 Author: ${authorInfo}

✅ Automatically registered in src/themes/registry/registry-core.ts
✅ Updated sitemap.xml lastmod date

📚 Architecture (follows fireworks pattern):
   - index.ts: Clean entry point (exports config + renderers)
   - config/: Theme constants, colors, and configuration
   - renderers/: TimePageRenderer and LandingPageRenderer implementations
   - test-utils/: Shared test helpers
   - utils/ui/: DOM creation and manipulation utilities
   - images/: Preview images (generated, not committed)

⚠️  Next steps:
   1. Generate preview images:
      npm run generate:previews -- --theme=${kebabName}

   2. Run tests:
      npm run test && npm run test:e2e:fast

   3. Start dev server: npm run dev
      Visit: http://localhost:5173/?theme=${kebabName}
`);
}

try {
  main();
} catch (error) {
  console.error(`❌ Error: ${(error as Error).message}`);
  process.exit(1);
}
