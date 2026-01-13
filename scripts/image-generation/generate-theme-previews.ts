#!/usr/bin/env tsx
/**
 * Generate theme preview images for each countdown theme
 *
 * This script uses Playwright to screenshot each countdown theme at completion state
 * and generates WebP images in 16:9 aspect ratio with responsive variants.
 *
 * Preview images are saved to each theme's `images/` subfolder:
 * - Card 1x: 426x240 (standard displays)
 * - Card 2x: 852x480 (retina/HiDPI displays)
 *
 * Usage:
 *   npm run generate:previews                    # Generate all (skip existing)
 *   npm run generate:previews -- --force         # Force regenerate all
 *   npm run generate:previews -- fireworks       # Generate specific theme (force)
 *   npm run generate:previews -- --theme=fireworks
 *
 * Environment variables:
 *   OG_PORT - Port for the preview server (default: 5173)
 *   OG_BASE_URL - Base URL override for the countdown page
 */

import { generateThemePreviews, parsePreviewArgs } from './theme-previews.js';

// Parse CLI arguments
const args = process.argv.slice(2);

// Handle --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: generate-theme-previews [options] [theme-id]

Options:
  <theme-id>              Generate preview for specific theme (forces overwrite)
  --theme <id>            Generate preview for specific theme
  --theme=<id>            Generate preview for specific theme
  --force, -f             Force overwrite existing previews
  --media <type>          Media type: images, videos, or both (default)
  --media=<type>          Media type to generate
  --color-mode <mode>     Color mode: dark, light, or both (default)
  --help, -h              Show this help message

Media Types:
  images                  Generate WebP preview images only
  videos                  Generate WebM preview videos only (~4-5s, <100KB)
  both                    Generate both images and videos (default)

Examples:
  npm run generate:previews                      # Generate all (skip existing)
  npm run generate:previews -- --force           # Force regenerate all
  npm run generate:previews -- fireworks         # Generate specific theme
  npm run generate:previews -- --media=videos    # Generate videos only
  npm run generate:previews -- --theme=fireworks --media=videos
`);
  process.exit(0);
}

const options = parsePreviewArgs(args);

// Run the script
generateThemePreviews(options).catch((error) => {
  console.error(error);
  process.exit(1);
});
