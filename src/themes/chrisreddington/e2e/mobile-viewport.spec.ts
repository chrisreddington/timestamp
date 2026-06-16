import { expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

import { buildDeepLinkUrl } from '../../../../e2e/fixtures/deep-link-helpers';

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const ALIGNMENT_VIEWPORTS = [320, 900, 1800];

const CHEVRON_TOLERANCE_PX = 1.5;
const DIGIT_TOLERANCE_PX = 2;
const WORD_TOLERANCE_PX = 2.5;

const chrisreddingtonUrl = buildDeepLinkUrl({
  theme: 'chrisreddington',
  mode: 'wall-clock',
  target: '2099-01-01T00:00:00',
});

const countingConfigurations = [
  {
    label: 'timer',
    url: buildDeepLinkUrl({ theme: 'chrisreddington', mode: 'timer', duration: 600 }),
  },
  {
    label: 'wall-clock',
    url: buildDeepLinkUrl({ theme: 'chrisreddington', mode: 'wall-clock', target: '2099-01-01T00:00:00' }),
  },
] as const;

const celebrationUrl = buildDeepLinkUrl({
  theme: 'chrisreddington',
  mode: 'timer',
  duration: 1,
});

/** Freezes blink/flick and removes grain so pixel keying is deterministic. */
const FREEZE_STYLE = `
  .chrisreddington-cursor { animation: none !important; opacity: 1 !important; }
  .chrisreddington-digit { opacity: 1 !important; }
  .chrisreddington-digit.flick { animation: none !important; }
  .chrisreddington-theme::before, .chrisreddington-theme::after { display: none !important; }
`;

interface RowCentroids {
  chevron: number | null;
  cursor: number | null;
  text: number | null;
}

type PixelClass = 'chevron' | 'cursor' | 'text';

function classifyPixel(r: number, g: number, b: number): PixelClass | null {
  if (b > 110 && b - r > 35 && b - g > 25) {
    return 'chevron';
  }
  if (g > 110 && g - r > 45 && g - b > 35) {
    return 'cursor';
  }
  if (r > 170 && g > 170 && b > 170) {
    return 'text';
  }
  return null;
}

function centroidFromSums(weightedY: number, count: number): number | null {
  return count > 0 ? weightedY / count : null;
}

async function decodeCentroids(buffer: Buffer): Promise<{ centroids: RowCentroids; imageHeight: number }> {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const sums: Record<PixelClass, { y: number; count: number }> = {
    chevron: { y: 0, count: 0 },
    cursor: { y: 0, count: 0 },
    text: { y: 0, count: 0 },
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const pixelClass = classifyPixel(data[offset], data[offset + 1], data[offset + 2]);
      if (pixelClass) {
        sums[pixelClass].y += y;
        sums[pixelClass].count += 1;
      }
    }
  }

  return {
    imageHeight: height,
    centroids: {
      chevron: centroidFromSums(sums.chevron.y, sums.chevron.count),
      cursor: centroidFromSums(sums.cursor.y, sums.cursor.count),
      text: centroidFromSums(sums.text.y, sums.text.count),
    },
  };
}

/**
 * Captures the prompt row and returns each element's painted-ink vertical centre
 * in CSS pixels, so alignment is measured on ink rather than on font line boxes.
 */
async function measureRowCentroids(page: Page, display: Locator): Promise<RowCentroids> {
  await page.addStyleTag({ content: FREEZE_STYLE });
  await page.waitForFunction(() => {
    const element = document.querySelector('.chrisreddington-countdown-display');
    return (
      element instanceof HTMLElement &&
      getComputedStyle(element).getPropertyValue('--chrisreddington-numeric-nudge').trim() !== ''
    );
  });

  const boundingBox = await display.boundingBox();
  const buffer = await display.screenshot();
  const { centroids, imageHeight } = await decodeCentroids(buffer);

  if (!boundingBox || boundingBox.height <= 0) {
    return centroids;
  }

  const scale = imageHeight / boundingBox.height;
  const toCssPx = (value: number | null): number | null => (value === null ? null : value / scale);

  return {
    chevron: toCssPx(centroids.chevron),
    cursor: toCssPx(centroids.cursor),
    text: toCssPx(centroids.text),
  };
}

function absoluteDelta(a: number | null, b: number | null): number {
  if (a === null || b === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(a - b);
}

test.describe('Chris Reddington Theme: Mobile viewport', () => {
  test('renders required countdown selectors', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(chrisreddingtonUrl);

    await expect(page.getByTestId('theme-container')).toBeVisible();
    await expect(page.getByTestId('countdown-display')).toBeVisible();
    await expect(page.getByTestId('countdown-days')).toBeVisible();
    await expect(page.getByTestId('countdown-hours')).toBeVisible();
    await expect(page.getByTestId('countdown-minutes')).toBeVisible();
    await expect(page.getByTestId('countdown-seconds')).toBeVisible();
    await expect(page.getByTestId('celebration-message')).toBeAttached();
  });

  test('disables cursor blink when reduced motion is preferred', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(chrisreddingtonUrl);

    const animationName = await page.locator('.chrisreddington-cursor').first().evaluate((element) => {
      return getComputedStyle(element).animationName;
    });

    expect(animationName).toBe('none');
  });

  test('aligns prompt, digit ink, and cursor on one centerline while counting', async ({ page }) => {
    test.slow();

    for (const configuration of countingConfigurations) {
      for (const width of ALIGNMENT_VIEWPORTS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(configuration.url);

        const display = page.getByTestId('countdown-display');
        await expect(display).toBeVisible();
        const centroids = await measureRowCentroids(page, display);

        const context = `${configuration.label} width=${width}`;
        expect(absoluteDelta(centroids.chevron, centroids.cursor), `chevron-cursor ${context}`).toBeLessThanOrEqual(
          CHEVRON_TOLERANCE_PX
        );
        expect(absoluteDelta(centroids.text, centroids.cursor), `digits-cursor ${context}`).toBeLessThanOrEqual(
          DIGIT_TOLERANCE_PX
        );
      }
    }
  });

  test('aligns prompt, word ink, and cursor on one centerline in the ready state', async ({ page }) => {
    test.slow();

    for (const width of [900, 1800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(celebrationUrl);
      await page.waitForFunction(() => {
        const display = document.querySelector('.chrisreddington-countdown-display');
        const word = document.querySelector('.chrisreddington-transition-text');
        return (
          display instanceof HTMLElement &&
          display.getAttribute('data-layout') === 'transition' &&
          word instanceof HTMLElement &&
          !word.hidden &&
          word.textContent?.trim() === 'ready'
        );
      });

      const display = page.getByTestId('countdown-display');
      const centroids = await measureRowCentroids(page, display);

      const context = `ready width=${width}`;
      expect(absoluteDelta(centroids.chevron, centroids.cursor), `chevron-cursor ${context}`).toBeLessThanOrEqual(
        CHEVRON_TOLERANCE_PX
      );
      expect(absoluteDelta(centroids.text, centroids.cursor), `word-cursor ${context}`).toBeLessThanOrEqual(
        WORD_TOLERANCE_PX
      );
    }
  });

  test('aligns prompt and cursor in the resting handoff state', async ({ page }) => {
    test.slow();

    for (const width of ALIGNMENT_VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(celebrationUrl);
      await page.waitForFunction(() => {
        const display = document.querySelector('.chrisreddington-countdown-display');
        return display instanceof HTMLElement && display.getAttribute('data-layout') === 'resting';
      });

      const display = page.getByTestId('countdown-display');
      const centroids = await measureRowCentroids(page, display);

      expect(
        absoluteDelta(centroids.chevron, centroids.cursor),
        `resting chevron-cursor width=${width}`
      ).toBeLessThanOrEqual(CHEVRON_TOLERANCE_PX);
    }
  });
});
