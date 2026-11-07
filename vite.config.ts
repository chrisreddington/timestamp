/**
 * Vite Build Configuration
 *
 * @remarks
 * This configuration handles development server and production builds:
 *
 * **Site URL Handling:**
 * - `VITE_SITE_URL` env var is set by CI from GitHub context (owner.github.io/repo)
 * - Falls back to `DEFAULT_SITE_URL` for local development
 * - Used for SEO meta tags (canonical, og:url, og:image, etc.)
 *
 * **Global Constants:**
 * - `__PROFILING__`: `true` in dev, `false` in prod (tree-shaken)
 *
 * **PWA Configuration:**
 * - Precaches essential shell resources (≤1.5MB compressed)
 * - Uses runtime caching strategies per asset type
 * - Manifest configured for standalone display mode
 *
 * @see {@link https://vitejs.dev/config/} for Vite configuration options
 * @see {@link https://vite-pwa-org.netlify.app/} for PWA plugin options
 */
import { resolve } from 'path';
import license, { type Dependency } from 'rollup-plugin-license';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// NOTE: CI sets VITE_SITE_URL from GitHub context (owner.github.io/repo)
const DEFAULT_SITE_URL = 'https://chrisreddington.com/timestamp';

/** Licenses whose notices we can satisfy by shipping third-party-licenses.txt. */
const ALLOWED_BUNDLED_LICENSES = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD']);

/**
 * Licenses for bundled packages whose package.json omits the license field,
 * taken from the LICENSE file each package ships.
 */
const LICENSE_OVERRIDES: Readonly<Record<string, string>> = {
  suncalc: 'BSD-2-Clause',
};

function licenseOf(dependency: Dependency): string | null {
  return dependency.license ?? (dependency.name ? LICENSE_OVERRIDES[dependency.name] : undefined) ?? null;
}

// The plugin's own allow check skips packages with no license field, so check here.
function assertBundledLicensesAllowed(dependencies: Dependency[]): void {
  const disallowed = dependencies.filter((dependency) => !ALLOWED_BUNDLED_LICENSES.has(licenseOf(dependency) ?? ''));
  if (disallowed.length > 0) {
    const names = disallowed.map((dependency) => `${dependency.name} (${licenseOf(dependency) ?? 'no license'})`);
    throw new Error(`Bundled dependencies with disallowed licenses: ${names.join(', ')}`);
  }
}

function formatLicenseNotice(dependency: Dependency): string {
  return [
    `${dependency.name}@${dependency.version} (${licenseOf(dependency)})`,
    dependency.licenseText ?? '',
    dependency.noticeText ?? '',
  ].filter(Boolean).join('\n\n');
}

export default defineConfig({
  base: '/timestamp/',
  define: {
    // NOTE: Gates perf monitoring and is tree-shaken in production
    __PROFILING__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    // NOTE: Only mutable runtime caches use this timestamp (hashed assets self-version)
    __BUILD_TIMESTAMP__: JSON.stringify(Date.now().toString(36)),
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [
          resolve(__dirname),
          resolve(__dirname, 'src/styles'),
        ],
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting for better caching and smaller initial bundle.
         * 
         * Strategy:
         * - vendor-icons: @primer/octicons (~800KB) - large but rarely changes
         * - vendor: Other node_modules (fireworks-js, suncalc) - small, rarely change
         * - themes: Each theme gets its own chunk via dynamic imports in registry-core.ts
         * - app: Core application code (default chunk)
         * 
         * This keeps the main chunk under 500KB and improves cache hit rates.
         * The icons chunk is separate so it can be cached long-term.
         * 
         * NOTE: Themes are NOT included here - they are lazy-loaded via dynamic imports
         * in registry-core.ts. Vite automatically code-splits each dynamic import into
         * its own chunk (e.g., contribution-graph-*.js, fireworks-*.js).
         */
        manualChunks(id) {
          // PERF: Separate octicons (~800KB) for better long-term caching
          if (id.includes('node_modules/@primer/octicons')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // NOTE: Themes auto-chunked by dynamic imports in registry-core.ts
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@app': resolve(__dirname, 'src/app'),
      '@core': resolve(__dirname, 'src/core'),
      '@themes': resolve(__dirname, 'src/themes'),
      '@components': resolve(__dirname, 'src/components'),
      '@data': resolve(__dirname, 'src/app/data'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@test-utils': resolve(__dirname, 'src/test-utils'),
      '@utils': resolve(__dirname, 'src/core/utils'),
    },
  },
  server: {
    open: '/timestamp/',
  },
  plugins: [
    // MIT and BSD require their notices to travel with the minified bundle.
    license({
      thirdParty: {
        output: {
          file: resolve(__dirname, 'dist/third-party-licenses.txt'),
          template: (dependencies) => {
            assertBundledLicensesAllowed(dependencies);
            return dependencies.map(formatLicenseNotice).join(`\n\n${'-'.repeat(72)}\n\n`);
          },
        },
      },
    }),
    VitePWA({
      // Use injectManifest for custom service worker with notification handlers
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      // PERF: Moves registerSW.js out of critical rendering path
      injectRegister: 'script-defer',
      devOptions: {
        // NOTE: Disabled - regeneration on every change causes persistent update prompts
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        globIgnores: ['**/node_modules/**/*', '**/themes/**/images/preview-*.webp'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Timestamp',
        short_name: 'Timestamp',
        description: 'A customizable time tracking app with countdowns, timers, and world clocks',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['entertainment', 'utilities'],
      },
    }),
    {
      name: 'inject-site-url',
      transformIndexHtml: (html) => {
        const siteUrl = process.env.VITE_SITE_URL || DEFAULT_SITE_URL;
        // NOTE: Updates canonical, og:url, og:image, twitter:*, and JSON-LD
        return html.replace(/https:\/\/chrisreddington\.com\/timestamp/g, siteUrl);
      },
    },
    {
      name: 'inject-lcp-preload',
      enforce: 'post',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          if (!ctx.bundle) return html;
          
          // PERF: Preload largest preview-dark image (LCP element on landing page)
          const previewPattern = /^assets\/preview-dark-[A-Za-z0-9_]+\.webp$/;
          let largestPreviewUrl: string | null = null;
          let largestSize = 0;
          
          for (const [fileName, chunk] of Object.entries(ctx.bundle)) {
            if (previewPattern.test(fileName) && 'source' in chunk) {
              const size = (chunk.source as Uint8Array | string).length;
              if (size > largestSize) {
                largestSize = size;
                largestPreviewUrl = `/timestamp/${fileName}`;
              }
            }
          }
          
          if (!largestPreviewUrl) return html;
          
          const preloadLink = `\n    <link rel="preload" as="image" href="${largestPreviewUrl}" fetchpriority="high" type="image/webp" />`;
          return html.replace(
            /(<!-- NOTE: Vite hashes assets, so this preload is injected via plugin at build time -->)/,
            `$1${preloadLink}`
          );
        },
      },
    },
  ],
})
