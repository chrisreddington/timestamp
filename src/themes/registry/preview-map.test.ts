/**
 * Unit tests for theme preview URL resolution utilities.
 * Tests image and video URL generation for theme selector cards.
 */

import { describe, expect, it } from 'vitest';
import { getPreviewUrls, getVideoUrls } from './preview-map';

// =============================================================================
// Test Setup
// =============================================================================

// NOTE: In Vitest environment, glob imports are resolved via Vite.
// Tests verify URL structure and consistency.

// =============================================================================
// getPreviewUrls Tests
// =============================================================================

describe('getPreviewUrls', () => {
  describe('dark mode', () => {
    it('should return URLs containing theme ID and color mode', () => {
      const result = getPreviewUrls('fireworks', 'dark');

      expect(result.url1x).toContain('fireworks');
      expect(result.url1x).toContain('dark');
      expect(result.url1x).toMatch(/\.webp$/);
    });

    it('should use dark as default color mode', () => {
      const explicitDark = getPreviewUrls('fireworks', 'dark');
      const defaultMode = getPreviewUrls('fireworks');

      expect(explicitDark).toEqual(defaultMode);
    });
  });

  describe('light mode', () => {
    it('should return URLs containing light mode', () => {
      const result = getPreviewUrls('contribution-graph', 'light');

      expect(result.url1x).toContain('contribution-graph');
      expect(result.url1x).toContain('light');
      expect(result.url1x).toMatch(/\.webp$/);
    });
  });

  describe('URL structure', () => {
    it('should return object with url1x and url2x properties', () => {
      const result = getPreviewUrls('fireworks', 'dark');

      expect(result).toHaveProperty('url1x');
      expect(result).toHaveProperty('url2x');
      expect(typeof result.url1x).toBe('string');
      expect(typeof result.url2x).toBe('string');
    });

    it('should return 1x and 2x variants', () => {
      const result = getPreviewUrls('fireworks', 'dark');

      expect(result.url1x).toContain('card-1x');
      expect(result.url2x).toContain('card-2x');
    });
  });
});

// =============================================================================
// getVideoUrls Tests
// =============================================================================

describe('getVideoUrls', () => {
  describe('dark mode', () => {
    it('should return URL or fallback for dark mode', () => {
      const result = getVideoUrls('fireworks', 'dark');

      // Either returns real URL or fallback (videos may not exist yet)
      expect(result.webm).toMatch(/\.webm$/);
    });

    it('should use dark as default color mode', () => {
      const explicitDark = getVideoUrls('fireworks', 'dark');
      const defaultMode = getVideoUrls('fireworks');

      expect(explicitDark).toEqual(defaultMode);
    });
  });

  describe('light mode', () => {
    it('should return URL or fallback for light mode', () => {
      const result = getVideoUrls('contribution-graph', 'light');

      expect(result.webm).toMatch(/\.webm$/);
    });
  });

  describe('URL structure', () => {
    it('should return object with webm property', () => {
      const result = getVideoUrls('fireworks', 'dark');

      expect(result).toHaveProperty('webm');
      expect(typeof result.webm).toBe('string');
    });

    it('should return WebM format URL', () => {
      const result = getVideoUrls('fireworks', 'dark');

      expect(result.webm).toMatch(/\.webm$/);
    });
  });

  describe('theme variations', () => {
    it.each([
      { themeId: 'fireworks', colorMode: 'dark' as const },
      { themeId: 'fireworks', colorMode: 'light' as const },
      { themeId: 'contribution-graph', colorMode: 'dark' as const },
      { themeId: 'contribution-graph', colorMode: 'light' as const },
      { themeId: 'custom-theme', colorMode: 'dark' as const },
    ])('should return valid URL for $themeId in $colorMode mode', ({ themeId, colorMode }) => {
      const result = getVideoUrls(themeId, colorMode);

      expect(result.webm).toBeTruthy();
      expect(typeof result.webm).toBe('string');
    });
  });
});

// =============================================================================
// Integration: Both image and video URLs
// =============================================================================

describe('Preview URL Integration', () => {
  it('should return URLs with correct extensions', () => {
    const imageUrls = getPreviewUrls('fireworks', 'dark');
    const videoUrls = getVideoUrls('fireworks', 'dark');

    expect(imageUrls.url1x).toMatch(/\.webp$/);
    expect(videoUrls.webm).toMatch(/\.webm$/);
  });

  it('should handle theme IDs with hyphens', () => {
    const imageUrls = getPreviewUrls('contribution-graph', 'dark');
    const videoUrls = getVideoUrls('contribution-graph', 'dark');

    expect(imageUrls.url1x).toBeTruthy();
    expect(videoUrls.webm).toBeTruthy();
  });

  it('should return different URLs for different color modes', () => {
    const darkImages = getPreviewUrls('fireworks', 'dark');
    const lightImages = getPreviewUrls('fireworks', 'light');
    const darkVideos = getVideoUrls('fireworks', 'dark');
    const lightVideos = getVideoUrls('fireworks', 'light');

    // URLs should contain mode-specific paths (or both be fallbacks)
    expect(darkImages.url1x).not.toBe(lightImages.url1x);
    // Videos may both be fallbacks if not generated yet
    expect(typeof darkVideos.webm).toBe('string');
    expect(typeof lightVideos.webm).toBe('string');
  });
});
