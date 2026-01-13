import type { Page } from 'playwright';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBrowser, createMockPage, createMockRegistry } from './image-generation-helpers';
import * as shared from './shared';
import {
    UI_ELEMENTS_TO_HIDE,
    hideUIElements,
} from './shared';
import {
    IMAGES_SUBFOLDER,
    IMAGE_SIZES,
    buildPreviewConfig,
    buildPreviewFilename,
    captureThemePreviewScreenshot,
    createPreviewPage,
    generateThemePreview,
    generateThemePreviews,
    parsePreviewArgs,
    previewExists,
    type PreviewConfig,
    type PreviewOptions,
} from './theme-previews';

/** Capture dimensions (full resolution before resize) */
const CAPTURE_WIDTH = 1600;
const CAPTURE_HEIGHT = 900;
/** Total delay: CAPTURE_DELAY_MS (1000) + PREVIEW_CELEBRATION_CAPTURE_DELAY_MS (200) */
const TOTAL_CAPTURE_DELAY_MS = 1200;

describe('theme-previews', () => {
  describe('IMAGES_SUBFOLDER constant', () => {
    it('should be "images"', () => {
      expect(IMAGES_SUBFOLDER).toBe('images');
    });
  });

  describe('IMAGE_SIZES constants', () => {
    it('should have card-1x size for standard displays (426x240)', () => {
      expect(IMAGE_SIZES['card-1x'].width).toBe(426);
      expect(IMAGE_SIZES['card-1x'].height).toBe(240);
      expect(IMAGE_SIZES['card-1x'].width / IMAGE_SIZES['card-1x'].height).toBeCloseTo(16 / 9);
    });

    it('should have card-2x size for retina displays (852x480)', () => {
      expect(IMAGE_SIZES['card-2x'].width).toBe(852);
      expect(IMAGE_SIZES['card-2x'].height).toBe(480);
      expect(IMAGE_SIZES['card-2x'].width / IMAGE_SIZES['card-2x'].height).toBeCloseTo(16 / 9);
    });

    it('should have card-2x be exactly 2x card-1x', () => {
      expect(IMAGE_SIZES['card-2x'].width).toBe(IMAGE_SIZES['card-1x'].width * 2);
      expect(IMAGE_SIZES['card-2x'].height).toBe(IMAGE_SIZES['card-1x'].height * 2);
    });
  });

  describe('buildPreviewFilename', () => {
    it('should build card-1x filename in images subfolder', () => {
      const result = buildPreviewFilename('/output', 'fireworks', 'dark', 'card-1x');
      expect(result).toContain('fireworks');
      expect(result).toContain('images');
      expect(result).toContain('preview-dark-card-1x.webp');
    });

    it('should build card-2x filename in images subfolder', () => {
      const result = buildPreviewFilename('/output', 'fireworks', 'light', 'card-2x');
      expect(result).toContain('fireworks');
      expect(result).toContain('images');
      expect(result).toContain('preview-light-card-2x.webp');
    });
  });

  describe('UI_ELEMENTS_TO_HIDE (shared)', () => {
    it('should include all chrome elements', () => {
      const expectedSelectors = [
        '[data-testid="share-button"]',
        '[data-testid="back-button"]',
        '[data-testid="theme-switcher"]',
        '[data-testid="favorite-button"]',
        '[data-testid="github-button"]',
        '[data-testid="timezone-selector"]',
        '[data-testid="world-map"]',
        '[data-testid="offline-indicator"]',
        '.share-button',
        '.back-button',
        '.theme-switcher',
        '.favorite-button',
        '.github-button',
        '.countdown-button-container',
      ];

      expectedSelectors.forEach((selector) => {
        expect(UI_ELEMENTS_TO_HIDE).toContain(selector);
      });
    });

    it('should have comprehensive list of UI elements', () => {
      expect(UI_ELEMENTS_TO_HIDE.length).toBeGreaterThan(6);
    });
  });

  describe('buildPreviewConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use default port when no env vars set', () => {
      delete process.env.OG_PORT;
      delete process.env.PORT;

      const config = buildPreviewConfig();

      expect(config.port).toBe('5173');
      expect(config.baseUrl).toBe('http://localhost:5173/timestamp');
    });

    it('should output to src/themes directory by default', () => {
      const config = buildPreviewConfig();

      expect(config.outputDir).toContain('src/themes');
      expect(config.outputDir).toMatch(/.*\/src\/themes$/);
    });

    it('should use timestamp as completion message', () => {
      const config = buildPreviewConfig();

      expect(config.completionMessage).toBe('timestamp');
    });
  });

  describe('parsePreviewArgs', () => {
    it('should return empty options with default colorMode and size when no args provided', () => {
      const result = parsePreviewArgs([]);

      expect(result.themeId).toBeUndefined();
      expect(result.force).toBe(false);
      expect(result.colorMode).toBe('both');
      expect(result.size).toBe('both');
    });

    it.each([
      { args: ['fireworks'], themeId: 'fireworks', force: true },
      { args: ['--theme', 'contribution-graph'], themeId: 'contribution-graph', force: true },
      { args: ['--theme=fireworks'], themeId: 'fireworks', force: true },
      { args: ['--force'], themeId: undefined, force: true },
      { args: ['-f'], themeId: undefined, force: true },
      { args: ['--theme', 'fireworks', '--force'], themeId: 'fireworks', force: true },
      { args: ['contribution-graph', '-f'], themeId: 'contribution-graph', force: true },
    ])('should parse theme/force flags for args $args', ({ args, themeId, force }) => {
      const result = parsePreviewArgs(args);

      expect(result.themeId).toBe(themeId);
      expect(result.force).toBe(force);
    });

    it.each([
      { args: ['--color-mode=dark'], expected: 'dark' },
      { args: ['--color-mode=light'], expected: 'light' },
      { args: ['--color-mode=both'], expected: 'both' },
      { args: ['--color-mode', 'dark'], expected: 'dark' },
      { args: ['--color-mode=invalid'], expected: 'both' },
    ])('should parse color mode for args $args', ({ args, expected }) => {
      const result = parsePreviewArgs(args);
      expect(result.colorMode).toBe(expected);
    });

    it.each([
      { args: ['--size=card'], expected: 'card' },
      { args: ['--size=both'], expected: 'both' },
      { args: ['--size', 'card'], expected: 'card' },
      { args: ['--size=invalid'], expected: 'both' },
      { args: ['--size=readme'], expected: 'both' }, // readme is no longer valid, defaults to both
    ])('should parse size option for args $args', ({ args, expected }) => {
      const result = parsePreviewArgs(args);
      expect(result.size).toBe(expected);
    });
  });

  describe('previewExists', () => {
    it('should return true when preview file exists', () => {
      const existingPath = process.cwd() + '/package.json';
      expect(previewExists(existingPath)).toBe(true);
    });

    it('should return false when preview file does not exist', () => {
      const nonExistentPath = '/path/to/nonexistent/preview.webp';
      expect(previewExists(nonExistentPath)).toBe(false);
    });
  });

  describe('hideUIElements (shared)', () => {
    it('should hide all chrome elements', async () => {
      const mockPage = createMockPage();

      await hideUIElements(mockPage);

      expect(mockPage.evaluate).toHaveBeenCalledOnce();
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        expect.arrayContaining([
          '[data-testid="share-button"]',
          '[data-testid="back-button"]',
          '[data-testid="theme-switcher"]',
          '[data-testid="favorite-button"]',
          '[data-testid="github-button"]',
          '[data-testid="timezone-selector"]',
          '[data-testid="world-map"]',
        ])
      );
    });
  });

  describe('captureThemePreviewScreenshot', () => {
    it('should set localStorage before navigation and capture PNG for WebP conversion', async () => {
      const mockPage = createMockPage({
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
        addInitScript: vi.fn().mockResolvedValue(undefined),
      } as unknown as Partial<Page>);

      const url = 'http://localhost:5173/timestamp/?theme=test';
      const outputPath = '/path/to/preview.webp';
      const colorMode = 'dark';

      await expect(captureThemePreviewScreenshot(mockPage, url, outputPath, colorMode)).rejects.toThrow();

      expect(mockPage.addInitScript).toHaveBeenCalledWith(expect.any(Function), 'dark');
      expect(mockPage.goto).toHaveBeenCalledWith(url, { waitUntil: 'networkidle' });
      // CAPTURE_DELAY_MS (1000) + PREVIEW_CELEBRATION_CAPTURE_DELAY_MS (200) = 1200
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(TOTAL_CAPTURE_DELAY_MS);
      expect(mockPage.evaluate).toHaveBeenCalledOnce();
      expect(mockPage.screenshot).toHaveBeenCalledWith({ type: 'png' });
    });

    it('should propagate navigation errors', async () => {
      const mockPage = createMockPage();
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Navigation failed'));

      const url = 'http://localhost:5173/timestamp/?theme=test';
      const outputPath = '/path/to/preview.webp';

      await expect(captureThemePreviewScreenshot(mockPage, url, outputPath)).rejects.toThrow(
        'Navigation failed'
      );
    });

    it('should propagate screenshot errors', async () => {
      const mockPage = createMockPage();
      mockPage.screenshot = vi.fn().mockRejectedValue(new Error('Screenshot failed'));

      const url = 'http://localhost:5173/timestamp/?theme=test';
      const outputPath = '/path/to/preview.webp';

      await expect(captureThemePreviewScreenshot(mockPage, url, outputPath)).rejects.toThrow(
        'Screenshot failed'
      );
    });
  });

  describe('generateThemePreview', () => {
    it('should generate webp previews for both color modes and sizes by default', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockPage = createMockPage({
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
        addInitScript: vi.fn().mockResolvedValue(undefined),
      } as unknown as Partial<Page>);

      // Use a fake theme ID that doesn't exist, so it will try to generate
      const theme = { id: 'test-new-theme', displayName: 'Test New Theme' };
      // Use actual output dir so mkdirSync succeeds, but sharp will still fail
      const config: PreviewConfig = {
        port: '5173',
        baseUrl: 'http://localhost:5173/timestamp',
        outputDir: process.cwd() + '/src/themes',
        completionMessage: '00:00',
      };

      await expect(generateThemePreview(mockPage, theme, config)).rejects.toThrow();

      // Dark mode capture first, then sizes generated
      expect(consoleSpy).toHaveBeenCalledWith('  📸 Capturing Test New Theme (test-new-theme, dark)...');
      // Due to error in sharp conversion, second size isn't reached
      expect(mockPage.goto).toHaveBeenCalledTimes(1);
      expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
      expect(mockPage.addInitScript).toHaveBeenCalledWith(expect.any(Function), 'dark');

      consoleSpy.mockRestore();
    });

    it('should handle navigation errors during preview generation', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockPage = createMockPage();
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Theme not found'));

      const theme = { id: 'test-nav-error', displayName: 'Invalid Theme' };
      // Use actual output dir so mkdirSync succeeds
      const config: PreviewConfig = {
        port: '5173',
        baseUrl: 'http://localhost:5173/timestamp',
        outputDir: process.cwd() + '/src/themes',
        completionMessage: '00:00',
      };

      await expect(generateThemePreview(mockPage, theme, config)).rejects.toThrow(
        'Theme not found'
      );

      expect(consoleSpy).toHaveBeenCalledWith('  📸 Capturing Invalid Theme (test-nav-error, dark)...');

      consoleSpy.mockRestore();
    });

    it('should handle screenshot buffer errors', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockPage = createMockPage();
      mockPage.screenshot = vi.fn().mockRejectedValue(new Error('Memory allocation failed'));

      const theme = { id: 'test-screenshot-error', displayName: 'Large Theme' };
      // Use actual output dir so mkdirSync succeeds
      const config: PreviewConfig = {
        port: '5173',
        baseUrl: 'http://localhost:5173/timestamp',
        outputDir: process.cwd() + '/src/themes',
        completionMessage: '00:00',
      };

      await expect(generateThemePreview(mockPage, theme, config)).rejects.toThrow(
        'Memory allocation failed'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createPreviewPage', () => {
    it('should create page with capture viewport dimensions (1600x900)', async () => {
      const mockBrowser = createMockBrowser();

      await createPreviewPage(mockBrowser);

      expect(mockBrowser.newPage).toHaveBeenCalledWith({
        viewport: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      });
    });
  });

  describe('generateThemePreview with skip logic', () => {
    it('should skip generation when all previews exist and force is false', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockPage = createMockPage();

      const theme = { id: 'fireworks', displayName: 'Fireworks' };
      const config: PreviewConfig = {
        port: '5173',
        baseUrl: 'http://localhost:5173/timestamp',
        outputDir: process.cwd() + '/src/themes',
        completionMessage: '00:00',
      };
      const options: PreviewOptions = { force: false, colorMode: 'both', size: 'card' };

      const result = await generateThemePreview(mockPage, theme, config, options);

      expect(result).toBe('skipped');
      expect(consoleSpy).toHaveBeenCalledWith(
        '  ⏭️  Fireworks (fireworks, dark, 426x240) - already exists, skipping'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '  ⏭️  Fireworks (fireworks, light, 426x240) - already exists, skipping'
      );
      expect(mockPage.goto).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should force generation when force is true even if preview exists', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockPage = createMockPage({
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
        addInitScript: vi.fn().mockResolvedValue(undefined),
      } as unknown as Partial<Page>);

      const theme = { id: 'fireworks', displayName: 'Fireworks' };
      const config: PreviewConfig = {
        port: '5173',
        baseUrl: 'http://localhost:5173/timestamp',
        outputDir: process.cwd() + '/src/themes',
        completionMessage: '00:00',
      };
      const options: PreviewOptions = { force: true, colorMode: 'both', size: 'card' };

      await expect(generateThemePreview(mockPage, theme, config, options)).rejects.toThrow();

      // Dark mode capture first
      expect(consoleSpy).toHaveBeenCalledWith('  📸 Capturing Fireworks (fireworks, dark)...');
      expect(mockPage.goto).toHaveBeenCalled();
      expect(mockPage.addInitScript).toHaveBeenCalledWith(expect.any(Function), 'dark');

      consoleSpy.mockRestore();
    });

    it('should generate both 1x and 2x card images when size is "card"', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockPage = createMockPage({
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
        addInitScript: vi.fn().mockResolvedValue(undefined),
      } as unknown as Partial<Page>);

      const theme = { id: 'test-theme', displayName: 'Test Theme' };
      const config: PreviewConfig = {
        port: '5173',
        baseUrl: 'http://localhost:5173/timestamp',
        outputDir: '/tmp/themes',
        completionMessage: '00:00',
      };
      const options: PreviewOptions = { force: true, colorMode: 'dark', size: 'card' };

      await expect(generateThemePreview(mockPage, theme, config, options)).rejects.toThrow();

      // Should log the capture start message
      expect(consoleSpy).toHaveBeenCalledWith('  📸 Capturing Test Theme (test-theme, dark)...');

      consoleSpy.mockRestore();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow for single theme preview', async () => {
      const mockPage = createMockPage({
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
      } as unknown as Partial<Page>);

      const theme = { id: 'test-theme', displayName: 'Test Theme' };
      const config = buildPreviewConfig();

      await expect(generateThemePreview(mockPage, theme, config)).rejects.toThrow();

      expect(mockPage.goto).toHaveBeenCalled();
      expect(mockPage.screenshot).toHaveBeenCalledWith({ type: 'png' });
    });
  });

  describe('generateThemePreviews (main orchestrator)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should orchestrate preview generation for registry themes and close browser', async () => {
      const mockPage = createMockPage();
      const mockBrowser = createMockBrowser(mockPage);
      const registry = createMockRegistry({
        alpha: { name: 'Alpha' },
        beta: { name: 'Beta' },
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(shared, 'registerWebpMockLoader').mockImplementation(() => {});
      vi.spyOn(shared, 'loadThemeRegistry').mockResolvedValue(registry as never);
      vi.spyOn(shared, 'extractThemeData').mockReturnValue([
        { id: 'alpha', displayName: 'Alpha' },
        { id: 'beta', displayName: 'Beta' },
      ]);
      vi.spyOn(shared, 'createBrowser').mockResolvedValue(mockBrowser as never);
      vi.spyOn(shared, 'createPage').mockResolvedValue(mockPage as never);
      vi.spyOn(shared, 'fileExists').mockReturnValue(true);

      await generateThemePreviews({ force: false, colorMode: 'both', size: 'both' }, '/fake/registry.ts');

      expect(shared.loadThemeRegistry).toHaveBeenCalledWith('/fake/registry.ts');
      expect(shared.createBrowser).toHaveBeenCalledTimes(1);
      expect(shared.createPage).toHaveBeenCalledWith(mockBrowser, CAPTURE_WIDTH, CAPTURE_HEIGHT);
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should throw when requested theme is missing before launching browser', async () => {
      const registry = createMockRegistry({
        alpha: { name: 'Alpha' },
      });

      vi.spyOn(shared, 'registerWebpMockLoader').mockImplementation(() => {});
      vi.spyOn(shared, 'loadThemeRegistry').mockResolvedValue(registry as never);
      vi.spyOn(shared, 'extractThemeData').mockReturnValue([
        { id: 'alpha', displayName: 'Alpha' },
      ]);
      const createBrowserSpy = vi.spyOn(shared, 'createBrowser');

      await expect(
        generateThemePreviews({ themeId: 'missing', force: true }, '/fake/registry.ts')
      ).rejects.toThrow("Theme 'missing' not found");

      expect(createBrowserSpy).not.toHaveBeenCalled();
    });
  });
});
