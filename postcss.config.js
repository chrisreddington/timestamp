import purgeCSSPlugin from '@fullhuman/postcss-purgecss';
import autoprefixer from 'autoprefixer';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  plugins: [
    autoprefixer(),
    ...(isProduction
      ? [
          purgeCSSPlugin({
            content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
            safelist: {
              standard: [
                'hidden',
                'sr-only',
                'focus-visible',
                'celebrating',
                'celebrated',
              ],
              deep: [
                // Contribution graph levels (level-0 through level-4)
                /^level-\d$/,
                // Theme-related classes
                /^theme-/,
                // Celebration effects
                /^celebration-/,
                // Color mode classes
                /^color-mode-/,
                // Aria and state attributes used as selectors
                /\[aria-/,
                /\[data-/,
              ],
              greedy: [
                /modal/,
                /overlay/,
                /tooltip/,
                /dropdown/,
              ],
            },
            blocklist: [],
            defaultExtractor: (content) => {
              const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
              const innerMatches =
                content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
              return broadMatches.concat(innerMatches);
            },
          }),
        ]
      : []),
  ],
};
