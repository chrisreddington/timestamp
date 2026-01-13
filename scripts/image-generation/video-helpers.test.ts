/**
 * Unit tests for video generation utilities.
 * Tests validation logic and argument parsing for video preview generation.
 */

import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildVideoFilename,
  parsePreviewArgs,
  validateVideoFile,
  VIDEO_CONFIG,
} from './theme-previews';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DIR = resolve(process.cwd(), 'test-temp-videos');

beforeEach(() => {
  // Create temp directory for test files
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  // Clean up temp directory
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// =============================================================================
// validateVideoFile Tests
// =============================================================================

describe('validateVideoFile', () => {
  it('should return valid for file within soft limit', () => {
    // Create a small test file (50KB)
    const testFile = resolve(TEST_DIR, 'valid-video.webm');
    const smallBuffer = Buffer.alloc(50 * 1024); // 50KB
    writeFileSync(testFile, smallBuffer);

    const result = validateVideoFile(testFile);

    expect(result.valid).toBe(true);
    expect(result.fileSizeBytes).toBe(50 * 1024);
    expect(result.error).toBeUndefined();
    expect(result.warning).toBeUndefined();
  });

  it('should return valid with warning for file exceeding soft limit but within hard limit', () => {
    // Create a file between soft and hard limit (700KB: soft=500KB, hard=2MB)
    const testFile = resolve(TEST_DIR, 'warning-video.webm');
    const mediumBuffer = Buffer.alloc(700 * 1024); // 700KB
    writeFileSync(testFile, mediumBuffer);

    const result = validateVideoFile(testFile);

    expect(result.valid).toBe(true);
    expect(result.warning).toContain('exceeds soft limit');
    expect(result.fileSizeBytes).toBe(700 * 1024);
  });

  it('should return invalid for file exceeding hard limit', () => {
    // Create an oversized test file (2.5MB > 2MB hard limit)
    const testFile = resolve(TEST_DIR, 'oversized-video.webm');
    const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5MB
    writeFileSync(testFile, largeBuffer);

    const result = validateVideoFile(testFile);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds hard limit');
    expect(result.fileSizeBytes).toBe(2.5 * 1024 * 1024);
  });

  it('should return invalid for non-existent file', () => {
    const testFile = resolve(TEST_DIR, 'non-existent.webm');

    const result = validateVideoFile(testFile);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.fileSizeBytes).toBeUndefined();
  });

  it('should return invalid for empty or too small file', () => {
    // Create a tiny file (500 bytes)
    const testFile = resolve(TEST_DIR, 'tiny-video.webm');
    const tinyBuffer = Buffer.alloc(500);
    writeFileSync(testFile, tinyBuffer);

    const result = validateVideoFile(testFile);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('too small');
  });

  it('should accept file at exactly the soft limit without warning', () => {
    // Create a file exactly at the soft limit (200KB)
    const testFile = resolve(TEST_DIR, 'edge-case-video.webm');
    const exactBuffer = Buffer.alloc(VIDEO_CONFIG.softLimitBytes);
    writeFileSync(testFile, exactBuffer);

    const result = validateVideoFile(testFile);

    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.fileSizeBytes).toBe(VIDEO_CONFIG.softLimitBytes);
  });

  it('should warn for file one byte over soft limit', () => {
    // Create a file 1 byte over the soft limit
    const testFile = resolve(TEST_DIR, 'one-over-video.webm');
    const overBuffer = Buffer.alloc(VIDEO_CONFIG.softLimitBytes + 1);
    writeFileSync(testFile, overBuffer);

    const result = validateVideoFile(testFile);

    expect(result.valid).toBe(true);
    expect(result.warning).toContain('exceeds soft limit');
  });

  it('should reject file at exactly hard limit + 1', () => {
    // Create a file 1 byte over the hard limit
    const testFile = resolve(TEST_DIR, 'hard-limit-over-video.webm');
    const overBuffer = Buffer.alloc(VIDEO_CONFIG.hardLimitBytes + 1);
    writeFileSync(testFile, overBuffer);

    const result = validateVideoFile(testFile);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds hard limit');
  });
});

// =============================================================================
// buildVideoFilename Tests
// =============================================================================

describe('buildVideoFilename', () => {
  it('should build correct path for dark mode', () => {
    const result = buildVideoFilename('/output', 'fireworks', 'dark');

    expect(result).toBe('/output/fireworks/images/preview-dark.webm');
  });

  it('should build correct path for light mode', () => {
    const result = buildVideoFilename('/output', 'contribution-graph', 'light');

    expect(result).toBe('/output/contribution-graph/images/preview-light.webm');
  });

  it('should handle theme IDs with hyphens', () => {
    const result = buildVideoFilename('/base', 'my-custom-theme', 'dark');

    expect(result).toBe('/base/my-custom-theme/images/preview-dark.webm');
  });
});

// =============================================================================
// parsePreviewArgs Tests
// =============================================================================

describe('parsePreviewArgs', () => {
  describe('media option parsing', () => {
    it('should default to both media types', () => {
      const result = parsePreviewArgs([]);

      expect(result.media).toBe('both');
    });

    it('should parse --media images', () => {
      const result = parsePreviewArgs(['--media', 'images']);

      expect(result.media).toBe('images');
    });

    it('should parse --media=videos', () => {
      const result = parsePreviewArgs(['--media=videos']);

      expect(result.media).toBe('videos');
    });

    it('should parse --media both explicitly', () => {
      const result = parsePreviewArgs(['--media', 'both']);

      expect(result.media).toBe('both');
    });

    it('should ignore invalid media values', () => {
      const result = parsePreviewArgs(['--media', 'invalid']);

      expect(result.media).toBe('both'); // Falls back to default
    });
  });

  describe('theme option parsing', () => {
    it('should parse positional theme ID', () => {
      const result = parsePreviewArgs(['fireworks']);

      expect(result.themeId).toBe('fireworks');
      expect(result.force).toBe(true); // Specific theme forces overwrite
    });

    it('should parse --theme flag', () => {
      const result = parsePreviewArgs(['--theme', 'contribution-graph']);

      expect(result.themeId).toBe('contribution-graph');
      expect(result.force).toBe(true);
    });

    it('should parse --theme= format', () => {
      const result = parsePreviewArgs(['--theme=my-theme']);

      expect(result.themeId).toBe('my-theme');
      expect(result.force).toBe(true);
    });
  });

  describe('force option parsing', () => {
    it('should default force to false', () => {
      const result = parsePreviewArgs([]);

      expect(result.force).toBe(false);
    });

    it('should parse --force flag', () => {
      const result = parsePreviewArgs(['--force']);

      expect(result.force).toBe(true);
    });

    it('should parse -f shorthand', () => {
      const result = parsePreviewArgs(['-f']);

      expect(result.force).toBe(true);
    });
  });

  describe('color mode parsing', () => {
    it('should default to both color modes', () => {
      const result = parsePreviewArgs([]);

      expect(result.colorMode).toBe('both');
    });

    it('should parse --color-mode dark', () => {
      const result = parsePreviewArgs(['--color-mode', 'dark']);

      expect(result.colorMode).toBe('dark');
    });

    it('should parse --color-mode=light', () => {
      const result = parsePreviewArgs(['--color-mode=light']);

      expect(result.colorMode).toBe('light');
    });
  });

  describe('size option parsing', () => {
    it('should default to both sizes', () => {
      const result = parsePreviewArgs([]);

      expect(result.size).toBe('both');
    });

    it('should parse --size card', () => {
      const result = parsePreviewArgs(['--size', 'card']);

      expect(result.size).toBe('card');
    });
  });

  describe('combined options', () => {
    it('should parse multiple options correctly', () => {
      const result = parsePreviewArgs([
        '--theme', 'fireworks',
        '--media', 'videos',
        '--color-mode', 'dark',
        '--force',
      ]);

      expect(result.themeId).toBe('fireworks');
      expect(result.media).toBe('videos');
      expect(result.colorMode).toBe('dark');
      expect(result.force).toBe(true);
    });

    it('should handle mixed positional and named args', () => {
      const result = parsePreviewArgs(['fireworks', '--media=videos']);

      expect(result.themeId).toBe('fireworks');
      expect(result.media).toBe('videos');
      expect(result.force).toBe(true);
    });
  });
});

// =============================================================================
// VIDEO_CONFIG Tests
// =============================================================================

describe('VIDEO_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(VIDEO_CONFIG.targetDurationSeconds).toBe(7);
    expect(VIDEO_CONFIG.timerDurationSeconds).toBe(2);
    expect(VIDEO_CONFIG.preCountdownSeconds).toBe(2);
    expect(VIDEO_CONFIG.postCelebrationSeconds).toBe(5);
    expect(VIDEO_CONFIG.softLimitBytes).toBe(500 * 1024); // 500KB soft limit
    expect(VIDEO_CONFIG.hardLimitBytes).toBe(2 * 1024 * 1024); // 2MB hard limit
    expect(VIDEO_CONFIG.minDurationSeconds).toBe(4);
    expect(VIDEO_CONFIG.maxDurationSeconds).toBe(8);
    expect(VIDEO_CONFIG.maxRetries).toBe(2);
    expect(VIDEO_CONFIG.retryDelayMs).toBe(1000);
  });

  it('should have consistent duration calculation', () => {
    // Timer (2s) + post-celebration (5s) = target (7s)
    const calculatedDuration =
      VIDEO_CONFIG.timerDurationSeconds + VIDEO_CONFIG.postCelebrationSeconds;

    expect(calculatedDuration).toBe(VIDEO_CONFIG.targetDurationSeconds);
  });;

  it('should have hard limit greater than soft limit', () => {
    expect(VIDEO_CONFIG.hardLimitBytes).toBeGreaterThan(VIDEO_CONFIG.softLimitBytes);
  });
});
