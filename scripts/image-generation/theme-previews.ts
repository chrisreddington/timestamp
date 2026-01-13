/**
 * Theme Preview Image and Video Generation
 * Creates optimized WebP images and WebM videos for theme selector cards.
 *
 * **Image sizes generated** (all in `images/` subfolder):
 * - **Card 1x**: 426x240 (standard displays)
 * - **Card 2x**: 852x480 (retina/HiDPI displays)
 *
 * **Video format**:
 * - **Card**: 426x240 WebM, ~4-5s duration, <100KB file size
 *
 * Cards use srcset for responsive image loading - browser picks 1x or 2x based on device pixel ratio.
 * Video previews show countdown→celebration transition with WebM format (supported by all modern browsers).
 */

import { mkdirSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import type { Browser, Page } from 'playwright';
import sharp from 'sharp';
import {
    buildCountdownUrl,
    CAPTURE_DELAY_MS,
    createBrowser,
    createPage,
    extractThemeData,
    fileExists,
    hideUIElements,
    loadThemeRegistry,
    registerWebpMockLoader,
    resolvePortAndBaseUrl,
    type BaseImageConfig,
    type ThemeData,
} from './shared';

// =============================================================================
// Constants
// =============================================================================

/** Subfolder name for theme images */
export const IMAGES_SUBFOLDER = 'images';

/**
 * Image size presets for different use cases.
 * All use 16:9 aspect ratio to match theme display.
 */
export const IMAGE_SIZES = {
  /**
   * Card images for theme selector (1x standard displays).
   * 426x240 is the native display size.
   */
  'card-1x': { width: 426, height: 240 },
  /**
   * Card images for theme selector (2x retina/HiDPI displays).
   * 852x480 provides crisp rendering on high-density screens.
   */
  'card-2x': { width: 852, height: 480 },
} as const;

/** Image size type */
export type ImageSizeType = keyof typeof IMAGE_SIZES;

/** Capture dimensions (full resolution before resize) */
const CAPTURE_WIDTH = 1600;
const CAPTURE_HEIGHT = 900;

/** Timer duration for preview capture in seconds. */
const PREVIEW_TIMER_DURATION_SECONDS = 2;

// =============================================================================
// Video Constants
// =============================================================================

/**
 * Video size for theme preview cards.
 * Uses 1x card dimensions for optimal file size.
 */
export const VIDEO_SIZE = { width: 426, height: 240 };

/**
 * Video recording configuration.
 * Targets <200KB file size with ~4-5s duration.
 * Complex themes with rich animations may exceed soft limit but will still be kept.
 */
export const VIDEO_CONFIG = {
  /** Target duration in seconds (T-2s countdown + T+5s celebration) */
  targetDurationSeconds: 7,
  /** Timer duration to set for countdown */
  timerDurationSeconds: 2,
  /** Time before countdown reaches zero to start recording */
  preCountdownSeconds: 2,
  /** Time after countdown reaches zero to continue recording */
  postCelebrationSeconds: 5,
  /** Soft limit file size in bytes (500KB) - warns but keeps file */
  softLimitBytes: 500 * 1024,
  /** Hard limit file size in bytes (2MB) - fails validation for extremely large files */
  hardLimitBytes: 2 * 1024 * 1024,
  /** Minimum acceptable duration in seconds */
  minDurationSeconds: 4,
  /** Maximum acceptable duration in seconds */
  maxDurationSeconds: 8,
  /** Number of retry attempts for failed recordings */
  maxRetries: 2,
  /** Delay between retries in milliseconds */
  retryDelayMs: 1000,
} as const;

/**
 * Video compression configuration using ffmpeg.
 * Applied as post-processing to reduce file size for complex themes.
 */
export const VIDEO_COMPRESSION = {
  /** Enable ffmpeg compression (requires ffmpeg installed) */
  enabled: true,
  /** VP9 Constant Rate Factor (0-63, lower = better quality, 30-35 is good for web) */
  crf: 35,
  /** Target frame rate (lower = smaller file) */
  fps: 24,
  /** VP9 encoding speed (0-5, higher = faster but larger files) */
  cpuUsed: 2,
  /** Two-pass encoding for better quality/size ratio */
  twoPass: false,
} as const;

// =============================================================================
// Types
// =============================================================================

/** Configuration options for theme preview generation */
export type PreviewConfig = BaseImageConfig;

/** Size option for preview generation - 'card' generates both 1x and 2x */
export type SizeOption = 'card' | 'both';

/** Media type option for preview generation */
export type MediaOption = 'images' | 'videos' | 'both';

/** Options for preview generation behavior */
export interface PreviewOptions {
  /** Specific theme ID to generate (undefined = all themes) */
  themeId?: string;
  /** Force overwrite even if preview exists */
  force: boolean;
  /** Color mode for preview (default: both) */
  colorMode?: 'dark' | 'light' | 'both';
  /** Image size to generate (default: both) */
  size?: SizeOption;
  /** Media type to generate (default: both images and videos) */
  media?: MediaOption;
}

/** Result of preview generation for a single theme */
export type PreviewResult = 'generated' | 'skipped';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Builds the configuration for theme preview generation from environment variables.
 * Outputs to src/themes directory so previews are co-located with theme code.
 * @param baseDir - Base directory for output (defaults to src/themes)
 * @returns Configuration object with port, base URL, and output directory
 */
export function buildPreviewConfig(baseDir?: string): PreviewConfig {
  const { port, baseUrl } = resolvePortAndBaseUrl();
  const outputDir = baseDir || resolve(process.cwd(), 'src/themes');
  const completionMessage = 'timestamp';

  return { port, baseUrl, outputDir, completionMessage };
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

/**
 * Parse command line arguments for preview generation.
 *
 * Supported formats:
 * - `<themeId>` - Generate specific theme (forces overwrite)
 * - `--theme <themeId>` or `--theme=<themeId>` - Generate specific theme
 * - `--force` or `-f` - Force overwrite all existing previews
 * - `--size <card|both>` - Image size to generate (default: both)
 * - `--media <images|videos|both>` - Media type to generate (default: both)
 *
 * @param args - Command line arguments (typically process.argv.slice(2))
 * @returns Parsed preview options
 */
export function parsePreviewArgs(args: string[]): PreviewOptions {
  let themeId: string | undefined;
  let force = false;
  let colorMode: 'dark' | 'light' | 'both' = 'both';
  let size: SizeOption = 'both';
  let media: MediaOption = 'both';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (arg === '--theme' && args[i + 1]) {
      themeId = args[i + 1];
      force = true; // Specific theme always forces
      i++; // Skip next arg
    } else if (arg.startsWith('--theme=')) {
      themeId = arg.slice('--theme='.length);
      force = true;
    } else if (arg === '--color-mode' && args[i + 1]) {
      const mode = args[i + 1];
      if (mode === 'dark' || mode === 'light' || mode === 'both') {
        colorMode = mode;
      }
      i++; // Skip next arg
    } else if (arg.startsWith('--color-mode=')) {
      const mode = arg.slice('--color-mode='.length);
      if (mode === 'dark' || mode === 'light' || mode === 'both') {
        colorMode = mode;
      }
    } else if (arg === '--size' && args[i + 1]) {
      const sizeArg = args[i + 1];
      if (sizeArg === 'card' || sizeArg === 'both') {
        size = sizeArg;
      }
      i++; // Skip next arg
    } else if (arg.startsWith('--size=')) {
      const sizeArg = arg.slice('--size='.length);
      if (sizeArg === 'card' || sizeArg === 'both') {
        size = sizeArg;
      }
    } else if (arg === '--media' && args[i + 1]) {
      const mediaArg = args[i + 1];
      if (mediaArg === 'images' || mediaArg === 'videos' || mediaArg === 'both') {
        media = mediaArg;
      }
      i++; // Skip next arg
    } else if (arg.startsWith('--media=')) {
      const mediaArg = arg.slice('--media='.length);
      if (mediaArg === 'images' || mediaArg === 'videos' || mediaArg === 'both') {
        media = mediaArg;
      }
    } else if (!arg.startsWith('-')) {
      // Positional argument = theme ID
      themeId = arg;
      force = true; // Specific theme always forces
    }
  }

  return { themeId, force, colorMode, size, media };
}

// =============================================================================
// File Existence Check
// =============================================================================

/**
 * Check if a preview image already exists at the given path.
 * @param filePath - Absolute path to check
 * @returns true if file exists, false otherwise
 */
export function previewExists(filePath: string): boolean {
  return fileExists(filePath);
}

// =============================================================================
// Screenshot Capture
// =============================================================================

/** Delay after clicking fullscreen for the mode to activate */
const PREVIEW_FULLSCREEN_ACTIVATION_DELAY_MS = 500;

/**
 * Delay after countdown reaches 00:00 to capture celebration animations.
 * 
 * Timing math (for contribution-graph wall build ~1800ms):
 * - Fullscreen activation: 500ms
 * - CAPTURE_DELAY_MS: 1000ms (from shared.ts)
 * - This delay: added after the above
 * - Timer duration: 2000ms
 * 
 * Total before capture = 500 + 1000 + this value
 * Timer completes at ~2000ms from page load
 * Reduced to 200ms to capture early celebration (minimal wall coverage of timer)
 */
const PREVIEW_CELEBRATION_CAPTURE_DELAY_MS = 200;

/**
 * Get the filename suffix for an image size type.
 * @param sizeType - The size type
 * @returns Filename suffix (e.g., '-card-1x', '-card-2x', or '')
 */
function getSizeSuffix(sizeType: ImageSizeType): string {
  switch (sizeType) {
    case 'card-1x':
      return '-card-1x';
    case 'card-2x':
      return '-card-2x';
  }
}

/**
 * Build the output filename for a preview image.
 * Images are stored in the `images/` subfolder within each theme.
 * @param outputDir - Base output directory
 * @param themeId - Theme identifier
 * @param colorMode - Color mode (dark or light)
 * @param sizeType - Image size type
 * @returns Full path to output file
 */
export function buildPreviewFilename(
  outputDir: string,
  themeId: string,
  colorMode: 'dark' | 'light',
  sizeType: ImageSizeType
): string {
  const suffix = getSizeSuffix(sizeType);
  return resolve(outputDir, themeId, IMAGES_SUBFOLDER, `preview-${colorMode}${suffix}.webp`);
}

/**
 * Build the output filename for a preview video.
 * Videos are stored in the `images/` subfolder within each theme.
 * @param outputDir - Base output directory
 * @param themeId - Theme identifier
 * @param colorMode - Color mode (dark or light)
 * @returns Full path to output WebM file
 */
export function buildVideoFilename(
  outputDir: string,
  themeId: string,
  colorMode: 'dark' | 'light'
): string {
  return resolve(outputDir, themeId, IMAGES_SUBFOLDER, `preview-${colorMode}.webm`);
}

// =============================================================================
// Video Validation
// =============================================================================

/** Result of video file validation */
export interface VideoValidationResult {
  /** Whether the video is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Warning message if size exceeds soft limit but is still acceptable */
  warning?: string;
  /** File size in bytes */
  fileSizeBytes?: number;
}

/**
 * Validate a recorded video file meets requirements.
 * Checks file exists, size is within limits.
 *
 * @param filePath - Path to the video file
 * @returns Validation result with error message if invalid
 * @throws Error if file doesn't exist
 *
 * @example
 * ```typescript
 * const result = validateVideoFile('/path/to/preview-dark.webm');
 * if (!result.valid) {
 *   throw new Error(result.error);
 * }
 * ```
 */
export function validateVideoFile(filePath: string): VideoValidationResult {
  try {
    const stats = statSync(filePath);
    const fileSizeBytes = stats.size;

    // Check if file is empty or too small (likely failed recording)
    if (fileSizeBytes < 1024) {
      return {
        valid: false,
        error: `Video file is too small (${fileSizeBytes} bytes) - recording may have failed`,
        fileSizeBytes,
      };
    }

    // Check hard limit (fail)
    if (fileSizeBytes > VIDEO_CONFIG.hardLimitBytes) {
      return {
        valid: false,
        error: `Video file size ${Math.round(fileSizeBytes / 1024)}KB exceeds hard limit ${Math.round(VIDEO_CONFIG.hardLimitBytes / 1024)}KB`,
        fileSizeBytes,
      };
    }

    // Check soft limit (warn but accept)
    if (fileSizeBytes > VIDEO_CONFIG.softLimitBytes) {
      return {
        valid: true,
        warning: `Video file size ${Math.round(fileSizeBytes / 1024)}KB exceeds soft limit ${Math.round(VIDEO_CONFIG.softLimitBytes / 1024)}KB`,
        fileSizeBytes,
      };
    }

    return { valid: true, fileSizeBytes };
  } catch (error) {
    return {
      valid: false,
      error: `Video file not found or cannot be read: ${filePath}`,
    };
  }
}

// =============================================================================
// Video Compression (ffmpeg)
// =============================================================================

/** Cache for ffmpeg availability check */
let ffmpegAvailable: boolean | null = null;

/**
 * Check if ffmpeg is available on the system.
 * Result is cached for subsequent calls.
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) {
    return ffmpegAvailable;
  }

  try {
    const { execSync } = await import('child_process');
    execSync('ffmpeg -version', { stdio: 'ignore' });
    ffmpegAvailable = true;
    return true;
  } catch {
    ffmpegAvailable = false;
    return false;
  }
}

/** Result of video compression */
export interface VideoCompressionResult {
  /** Whether compression was successful */
  success: boolean;
  /** Original file size in bytes */
  originalSize: number;
  /** Compressed file size in bytes (same as original if skipped/failed) */
  compressedSize: number;
  /** Compression ratio (e.g., 0.6 = 60% of original size) */
  ratio: number;
  /** Error message if compression failed */
  error?: string;
  /** Whether compression was skipped (ffmpeg not available or disabled) */
  skipped?: boolean;
}

/**
 * Compress a video file using ffmpeg with VP9 codec.
 * Falls back gracefully if ffmpeg is not available.
 *
 * @param inputPath - Path to the input video file
 * @param outputPath - Path for the compressed output (can be same as input)
 * @returns Compression result with size statistics
 */
export async function compressVideo(
  inputPath: string,
  outputPath?: string
): Promise<VideoCompressionResult> {
  const targetPath = outputPath || inputPath;
  const originalStats = statSync(inputPath);
  const originalSize = originalStats.size;

  // Skip if compression is disabled
  if (!VIDEO_COMPRESSION.enabled) {
    return {
      success: true,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      skipped: true,
    };
  }

  // Check if ffmpeg is available
  const hasFfmpeg = await checkFfmpegAvailable();
  if (!hasFfmpeg) {
    return {
      success: true,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      skipped: true,
      error: 'ffmpeg not available',
    };
  }

  // Create temp output path if compressing in place
  const tempOutput = targetPath === inputPath
    ? `${inputPath}.compressed.webm`
    : targetPath;

  try {
    const { execSync } = await import('child_process');

    // Build ffmpeg command for VP9 compression
    // -y: overwrite output
    // -i: input file
    // -c:v libvpx-vp9: VP9 codec
    // -crf: quality (0-63, lower = better)
    // -b:v 0: let CRF control bitrate
    // -r: frame rate
    // -cpu-used: encoding speed
    // -an: no audio (videos are muted anyway)
    // -auto-alt-ref 0: disable for better streaming
    const command = [
      'ffmpeg -y',
      `-i "${inputPath}"`,
      '-c:v libvpx-vp9',
      `-crf ${VIDEO_COMPRESSION.crf}`,
      '-b:v 0',
      `-r ${VIDEO_COMPRESSION.fps}`,
      `-cpu-used ${VIDEO_COMPRESSION.cpuUsed}`,
      '-an',
      '-auto-alt-ref 0',
      `"${tempOutput}"`,
    ].join(' ');

    execSync(command, { stdio: 'ignore' });

    // If compressing in place, replace original with compressed
    if (targetPath === inputPath) {
      const { renameSync } = await import('fs');
      unlinkSync(inputPath);
      renameSync(tempOutput, inputPath);
    }

    const compressedStats = statSync(targetPath);
    const compressedSize = compressedStats.size;
    const ratio = compressedSize / originalSize;

    return {
      success: true,
      originalSize,
      compressedSize,
      ratio,
    };
  } catch (error) {
    // Clean up temp file if it exists
    try {
      unlinkSync(tempOutput);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      error: error instanceof Error ? error.message : 'Unknown compression error',
    };
  }
}

/**
 * Captures a screenshot of a countdown theme for preview image.
 * Clicks fullscreen button, waits for countdown to complete and celebration
 * animations to start, then captures as PNG and converts to WebP.
 * @param page - Playwright page instance
 * @param url - URL to navigate to
 * @param outputPath - File path for saving the screenshot (should end in .webp)
 * @param colorMode - Color mode preference ('dark' or 'light')
 * @param sizeType - Target image size type
 */
export async function captureThemePreviewScreenshot(
  page: Page,
  url: string,
  outputPath: string,
  colorMode: 'dark' | 'light',
  sizeType: ImageSizeType = 'card-2x'
): Promise<void> {
  // Emulate the color scheme at browser level (affects prefers-color-scheme media query)
  await page.emulateMedia({ colorScheme: colorMode });

  // Also set color mode preference in localStorage before navigating
  await page.addInitScript((mode: 'dark' | 'light') => {
    localStorage.setItem('countdown:color-mode', mode);
  }, colorMode);

  await page.goto(url, { waitUntil: 'networkidle' });

  // Click fullscreen button to enter fullscreen mode
  const fullscreenButton = page.locator('[data-testid="fullscreen-button"]');
  if (await fullscreenButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await fullscreenButton.click();
    await page.waitForTimeout(PREVIEW_FULLSCREEN_ACTIVATION_DELAY_MS);
  }

  // Wait for countdown to complete (timer duration) and celebration animations to start
  await page.waitForTimeout(CAPTURE_DELAY_MS + PREVIEW_CELEBRATION_CAPTURE_DELAY_MS);

  // Hide any remaining UI chrome
  await hideUIElements(page);

  // Capture as PNG buffer (Playwright doesn't support WebP directly)
  const pngBuffer = await page.screenshot({ type: 'png' });

  // Get target dimensions
  const { width, height } = IMAGE_SIZES[sizeType];

  // Convert to WebP using sharp with resize and quality 85
  await sharp(pngBuffer)
    .resize(width, height, { fit: 'cover' })
    .webp({ quality: 85 })
    .toFile(outputPath);
}

// =============================================================================
// Video Recording
// =============================================================================

/** Delay before starting countdown to allow page to fully stabilize */
const VIDEO_SETUP_DELAY_MS = 1500;

/** Result of video recording */
export interface VideoRecordingResult {
  /** Path to the recorded video file */
  path: string;
  /** Warning message if file size exceeds soft limit */
  warning?: string;
  /** Compression statistics if compression was applied */
  compression?: {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    skipped?: boolean;
  };
}

/**
 * Records a video preview of a theme showing countdown→celebration transition.
 * Uses Playwright's recordVideo API to capture the theme in action.
 *
 * @param browser - Playwright browser instance
 * @param url - URL to navigate to (should have timer set appropriately)
 * @param outputPath - File path for saving the video (should end in .webm)
 * @param colorMode - Color mode preference ('dark' or 'light')
 * @returns Recording result with path and optional warning
 *
 * @example
 * ```typescript
 * const browser = await chromium.launch();
 * const result = await recordThemeVideo(
 *   browser,
 *   'http://localhost:5173/countdown?theme=fireworks&timer=2&chrome=none',
 *   '/path/to/preview-dark.webm',
 *   'dark'
 * );
 * console.log(`Recorded: ${result.path}`);
 * if (result.warning) console.warn(result.warning);
 * await browser.close();
 * ```
 */
export async function recordThemeVideo(
  browser: Browser,
  url: string,
  outputPath: string,
  colorMode: 'dark' | 'light'
): Promise<VideoRecordingResult> {
  // Create a new context with video recording enabled
  const context = await browser.newContext({
    viewport: { width: VIDEO_SIZE.width, height: VIDEO_SIZE.height },
    colorScheme: colorMode,
    recordVideo: {
      dir: resolve(outputPath, '..'), // Playwright needs a directory
      size: VIDEO_SIZE,
    },
  });

  const page = await context.newPage();

  // Set color mode preference in localStorage before navigating
  await page.addInitScript((mode: 'dark' | 'light') => {
    localStorage.setItem('countdown:color-mode', mode);
  }, colorMode);

  try {
    // Navigate to the countdown page with timeout
    // URL includes chrome=none which prevents ALL UI buttons/controls from being created
    // This is the cleanest solution - no UI elements = nothing to hide
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Additional wait for color scheme to fully apply
    // This is especially important for light mode which seems to need more time
    await page.waitForTimeout(500);

    // Wait for page to stabilize
    await page.waitForTimeout(VIDEO_SETUP_DELAY_MS);

    // Calculate total wait time: timer duration + post-celebration time
    const totalRecordingMs =
      (VIDEO_CONFIG.timerDurationSeconds + VIDEO_CONFIG.postCelebrationSeconds) * 1000;

    // Wait for the countdown and celebration to complete
    await page.waitForTimeout(totalRecordingMs);

    // Get video reference before closing page (required by Playwright)
    const video = page.video();
    if (!video) {
      throw new Error('No video was recorded');
    }
    
    // Close page to finalize video recording
    await page.close();
    
    // Wait a moment for video file to be completely written
    await new Promise(resolve => setTimeout(resolve, 500));

    const tempVideoPath = await video.path();

    // Move from temp location to desired output path
    const { renameSync, copyFileSync } = await import('fs');
    try {
      renameSync(tempVideoPath, outputPath);
    } catch {
      // Cross-device move fallback
      copyFileSync(tempVideoPath, outputPath);
      unlinkSync(tempVideoPath);
    }

    // Compress video using ffmpeg if available
    const compressionResult = await compressVideo(outputPath);

    // Validate the recorded video (after compression)
    const validation = validateVideoFile(outputPath);
    if (!validation.valid) {
      // Clean up invalid file
      try {
        unlinkSync(outputPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(validation.error);
    }

    // Return output path with compression stats and any warning
    return {
      path: outputPath,
      warning: validation.warning,
      compression: compressionResult.skipped
        ? undefined
        : {
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            ratio: compressionResult.ratio,
          },
    };
  } finally {
    await context.close();
  }
}

// =============================================================================
// Image Generation
// =============================================================================

/**
 * Expand a size option to the actual image size types to generate.
 * 'card' generates both 1x and 2x variants for responsive images.
 * @param sizeOption - The size option from CLI
 * @returns Array of image size types to generate
 */
function expandSizeOption(sizeOption: SizeOption): ImageSizeType[] {
  switch (sizeOption) {
    case 'card':
    case 'both':
      return ['card-1x', 'card-2x'];
  }
}

/**
 * Generates preview images for a single theme.
 * Outputs to the theme's `images/` subfolder with naming convention:
 * - Card 1x: `preview-{mode}-card-1x.webp` (426x240)
 * - Card 2x: `preview-{mode}-card-2x.webp` (852x480)
 * - README: `preview-{mode}.webp` (1200x675)
 *
 * @param page - Playwright page instance
 * @param theme - Theme data containing id and display name
 * @param config - Preview image configuration
 * @param options - Preview generation options (default: no force)
 * @returns 'generated' if any image was created, 'skipped' if all already exist
 */
export async function generateThemePreview(
  page: Page,
  theme: ThemeData,
  config: PreviewConfig,
  options: PreviewOptions = { force: false, colorMode: 'both', size: 'both' }
): Promise<PreviewResult> {
  const colorMode = options.colorMode || 'both';
  const sizeOption = options.size || 'both';
  
  const colorModes: Array<'dark' | 'light'> = colorMode === 'both' ? ['dark', 'light'] : [colorMode];
  const sizeTypes = expandSizeOption(sizeOption);

  let anyGenerated = false;

  // Ensure images subfolder exists
  const imagesDir = resolve(config.outputDir, theme.id, IMAGES_SUBFOLDER);
  mkdirSync(imagesDir, { recursive: true });

  for (const mode of colorModes) {
    // Navigate and capture screenshot once per color mode
    const url = buildCountdownUrl(config.baseUrl, theme.id, config.completionMessage, PREVIEW_TIMER_DURATION_SECONDS);
    
    // Check which sizes need generation for this color mode
    const sizesToGenerate: ImageSizeType[] = [];
    for (const sizeType of sizeTypes) {
      const filename = buildPreviewFilename(config.outputDir, theme.id, mode, sizeType);
      if (!options.force && previewExists(filename)) {
        const { width, height } = IMAGE_SIZES[sizeType];
        console.log(`  ⏭️  ${theme.displayName} (${theme.id}, ${mode}, ${width}x${height}) - already exists, skipping`);
      } else {
        sizesToGenerate.push(sizeType);
      }
    }

    if (sizesToGenerate.length === 0) {
      continue;
    }

    // Capture screenshot once at full resolution
    console.log(`  📸 Capturing ${theme.displayName} (${theme.id}, ${mode})...`);
    
    // Emulate the color scheme at browser level
    await page.emulateMedia({ colorScheme: mode });
    await page.addInitScript((colorModeParam: 'dark' | 'light') => {
      localStorage.setItem('countdown:color-mode', colorModeParam);
    }, mode);

    await page.goto(url, { waitUntil: 'networkidle' });

    // Click fullscreen button to enter fullscreen mode
    const fullscreenButton = page.locator('[data-testid="fullscreen-button"]');
    if (await fullscreenButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fullscreenButton.click();
      await page.waitForTimeout(PREVIEW_FULLSCREEN_ACTIVATION_DELAY_MS);
    }

    // Wait for countdown to complete and celebration animations
    await page.waitForTimeout(CAPTURE_DELAY_MS + PREVIEW_CELEBRATION_CAPTURE_DELAY_MS);
    await hideUIElements(page);

    // Capture as PNG buffer once
    const pngBuffer = await page.screenshot({ type: 'png' });

    // Generate each requested size from the same screenshot
    for (const sizeType of sizesToGenerate) {
      const filename = buildPreviewFilename(config.outputDir, theme.id, mode, sizeType);
      const { width, height } = IMAGE_SIZES[sizeType];
      const sizeLabel = `${width}x${height}`;

      console.log(`  🖼️  ${theme.displayName} (${mode}, ${sizeLabel})...`);

      await sharp(pngBuffer)
        .resize(width, height, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(filename);

      const suffix = getSizeSuffix(sizeType);
      console.log(`     ✅ Saved: src/themes/${theme.id}/${IMAGES_SUBFOLDER}/preview-${mode}${suffix}.webp`);
      anyGenerated = true;
    }
  }

  return anyGenerated ? 'generated' : 'skipped';
}

/**
 * Generates preview videos for a single theme.
 * Outputs to the theme's `images/` subfolder with naming convention:
 * - `preview-{mode}.webm`
 *
 * @param browser - Playwright browser instance
 * @param theme - Theme data containing id and display name
 * @param config - Preview configuration
 * @param options - Preview generation options (default: no force)
 * @returns 'generated' if any video was created, 'skipped' if all already exist
 */
export async function generateThemeVideo(
  browser: Browser,
  theme: ThemeData,
  config: PreviewConfig,
  options: PreviewOptions = { force: false, colorMode: 'both' }
): Promise<PreviewResult> {
  const colorMode = options.colorMode || 'both';
  const colorModes: Array<'dark' | 'light'> = colorMode === 'both' ? ['dark', 'light'] : [colorMode];

  let anyGenerated = false;

  // Ensure images subfolder exists
  const imagesDir = resolve(config.outputDir, theme.id, IMAGES_SUBFOLDER);
  mkdirSync(imagesDir, { recursive: true });

  for (const mode of colorModes) {
    const filename = buildVideoFilename(config.outputDir, theme.id, mode);

    if (!options.force && previewExists(filename)) {
      console.log(`  ⏭️  ${theme.displayName} video (${theme.id}, ${mode}) - already exists, skipping`);
      continue;
    }

    // Delete existing file when forcing regeneration for a clean slate
    if (options.force && previewExists(filename)) {
      try {
        unlinkSync(filename);
      } catch {
        // Ignore deletion errors
      }
    }

    console.log(`  🎬 Recording ${theme.displayName} video (${theme.id}, ${mode})...`);

    // Build URL with timer duration appropriate for video recording
    // Use chrome=none to prevent UI elements from being created at all
    const url = buildCountdownUrl(
      config.baseUrl,
      theme.id,
      config.completionMessage,
      VIDEO_CONFIG.timerDurationSeconds,
      true // hideChrome - prevents all UI buttons/controls from being created
    );

    // Retry loop for robustness
    let lastError: Error | unknown = null;
    for (let attempt = 1; attempt <= VIDEO_CONFIG.maxRetries + 1; attempt++) {
      try {
        const result = await recordThemeVideo(browser, url, filename, mode);
        
        // Get file size for logging
        const validation = validateVideoFile(filename);
        const sizeKB = validation.fileSizeBytes
          ? Math.round(validation.fileSizeBytes / 1024)
          : '?';

        // Build log message with compression info
        let logMessage = `src/themes/${theme.id}/${IMAGES_SUBFOLDER}/preview-${mode}.webm (${sizeKB}KB)`;
        
        // Add compression stats if applied
        if (result.compression) {
          const originalKB = Math.round(result.compression.originalSize / 1024);
          const savings = Math.round((1 - result.compression.ratio) * 100);
          logMessage += ` [compressed from ${originalKB}KB, ${savings}% smaller]`;
        }

        // Log success with optional warning
        if (result.warning) {
          console.log(`     ⚠️  Saved: ${logMessage} - ${result.warning}`);
        } else {
          console.log(`     ✅ Saved: ${logMessage}`);
        }
        anyGenerated = true;
        lastError = null;
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        if (attempt <= VIDEO_CONFIG.maxRetries) {
          console.log(`     ⚠️  Attempt ${attempt} failed, retrying in ${VIDEO_CONFIG.retryDelayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, VIDEO_CONFIG.retryDelayMs));
        }
      }
    }

    if (lastError) {
      console.error(`     ❌ Failed to record video after ${VIDEO_CONFIG.maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : lastError}`);
      // Continue with other color modes/themes
    }
  }

  return anyGenerated ? 'generated' : 'skipped';
}

// =============================================================================
// Browser/Page Factory (Preview-specific wrappers)
// =============================================================================

/**
 * Creates a Playwright browser instance for preview generation.
 * @returns Playwright browser instance
 */
async function createPreviewBrowser(): Promise<Browser> {
  return createBrowser();
}

/**
 * Creates a Playwright page with capture dimensions (1600x900).
 * Full resolution capture is then resized to target dimensions.
 * @param browser - Playwright browser instance
 * @returns Playwright page instance with capture viewport
 */
export async function createPreviewPage(browser: Browser): Promise<Page> {
  return createPage(browser, CAPTURE_WIDTH, CAPTURE_HEIGHT);
}

// =============================================================================
// Main Orchestration
// =============================================================================

/**
 * Main function to generate preview images and videos for all themes.
 * Orchestrates the entire process: browser setup, theme iteration, and cleanup.
 *
 * @param options - Preview options (theme filter, force overwrite, size, media)
 * @param registryPath - Optional path to registry file (for testing)
 */
export async function generateThemePreviews(
  options: PreviewOptions = { force: false, size: 'both', media: 'both' },
  registryPath?: string
): Promise<void> {
  // Register loader and load registry
  registerWebpMockLoader();

  const resolvedRegistryPath =
    registryPath || resolve(process.cwd(), 'src/themes/registry/index.ts');
  const registry = await loadThemeRegistry(resolvedRegistryPath);

  // Extract theme data from registry
  let themes = extractThemeData(registry);

  // Filter to specific theme if requested
  if (options.themeId) {
    const targetTheme = themes.find((t) => t.id === options.themeId);
    if (!targetTheme) {
      console.error(`❌ Theme '${options.themeId}' not found in registry.`);
      console.error(`   Available themes: ${themes.map((t) => t.id).join(', ')}`);
      throw new Error(`Theme '${options.themeId}' not found`);
    }
    themes = [targetTheme];
  }

  const config = buildPreviewConfig();
  const mediaOption = options.media || 'both';
  const generateImages = mediaOption === 'images' || mediaOption === 'both';
  const generateVideos = mediaOption === 'videos' || mediaOption === 'both';

  console.log('🖼️  Generating theme previews...');
  console.log(`   Using base URL: ${config.baseUrl}`);
  console.log(`   Output subfolder: ${IMAGES_SUBFOLDER}/`);
  
  if (generateImages) {
    console.log(`   Capture resolution: ${CAPTURE_WIDTH}x${CAPTURE_HEIGHT}`);
    console.log(`   Card 1x output: ${IMAGE_SIZES['card-1x'].width}x${IMAGE_SIZES['card-1x'].height} (standard displays)`);
    console.log(`   Card 2x output: ${IMAGE_SIZES['card-2x'].width}x${IMAGE_SIZES['card-2x'].height} (retina/HiDPI)`);
  }
  
  if (generateVideos) {
    console.log(`   Video output: ${VIDEO_SIZE.width}x${VIDEO_SIZE.height} WebM (~${VIDEO_CONFIG.targetDurationSeconds}s)`);
    
    // Check ffmpeg availability for compression
    const hasFfmpeg = await checkFfmpegAvailable();
    if (VIDEO_COMPRESSION.enabled && hasFfmpeg) {
      console.log(`   Compression: ffmpeg VP9 (CRF ${VIDEO_COMPRESSION.crf}, ${VIDEO_COMPRESSION.fps}fps)`);
    } else if (VIDEO_COMPRESSION.enabled) {
      console.log(`   Compression: ⚠️ ffmpeg not found, videos will be uncompressed`);
    } else {
      console.log(`   Compression: disabled`);
    }
  }
  
  console.log(`   Color mode: ${options.colorMode || 'both'}`);
  console.log(`   Media: ${mediaOption}`);
  if (options.themeId) {
    console.log(`   Target theme: ${options.themeId}`);
  } else {
    console.log(`   Themes found: ${themes.map((t) => t.id).join(', ')}`);
  }
  if (options.force) {
    console.log(`   Mode: Force overwrite`);
  } else {
    console.log(`   Mode: Skip existing`);
  }
  console.log('');

  const browser = await createPreviewBrowser();
  const page = await createPreviewPage(browser);

  try {
    let imagesGenerated = 0;
    let imagesSkipped = 0;
    let videosGenerated = 0;
    let videosSkipped = 0;

    // Generate previews for each theme
    for (const theme of themes) {
      // Generate images
      if (generateImages) {
        const result = await generateThemePreview(page, theme, config, options);
        if (result === 'generated') {
          imagesGenerated++;
        } else {
          imagesSkipped++;
        }
      }

      // Generate videos
      if (generateVideos) {
        const result = await generateThemeVideo(browser, theme, config, options);
        if (result === 'generated') {
          videosGenerated++;
        } else {
          videosSkipped++;
        }
      }
    }

    console.log('\n✨ Theme preview generation complete!');
    
    if (generateImages) {
      if (imagesSkipped > 0) {
        console.log(`   Images: Generated ${imagesGenerated}, Skipped ${imagesSkipped}`);
      } else {
        console.log(`   Images: Generated ${imagesGenerated} theme${imagesGenerated === 1 ? '' : 's'}`);
      }
    }
    
    if (generateVideos) {
      if (videosSkipped > 0) {
        console.log(`   Videos: Generated ${videosGenerated}, Skipped ${videosSkipped}`);
      } else {
        console.log(`   Videos: Generated ${videosGenerated} theme${videosGenerated === 1 ? '' : 's'}`);
      }
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ Error generating theme previews:', error);
    throw error;
  } finally {
    await browser.close();
  }
}


