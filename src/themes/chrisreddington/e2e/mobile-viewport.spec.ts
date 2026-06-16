import { expect, test } from '@playwright/test';

import { buildDeepLinkUrl } from '../../../../e2e/fixtures/deep-link-helpers';

const MOBILE_VIEWPORT = { width: 375, height: 812 };

const chrisreddingtonUrl = buildDeepLinkUrl({
  theme: 'chrisreddington',
  mode: 'wall-clock',
  target: '2099-01-01T00:00:00',
});

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

  test('keeps chevron centerline within 1px of cursor centerline at min/mid/max font sizes', async ({ page }) => {
    const widths = [320, 900, 1800];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(chrisreddingtonUrl);
      await expect(page.locator('.chrisreddington-chevron').first()).toBeVisible();
      await expect(page.locator('.chrisreddington-cursor').first()).toBeVisible();

      const delta = await page.evaluate(() => {
        const chevron = document.querySelector('.chrisreddington-chevron');
        const cursor = document.querySelector('.chrisreddington-cursor');
        if (!(chevron instanceof HTMLElement) || !(cursor instanceof HTMLElement)) {
          return Number.POSITIVE_INFINITY;
        }

        const chevronRect = chevron.getBoundingClientRect();
        const cursorRect = cursor.getBoundingClientRect();
        const chevronCenterY = chevronRect.top + chevronRect.height / 2;
        const cursorCenterY = cursorRect.top + cursorRect.height / 2;

        return Math.abs(chevronCenterY - cursorCenterY);
      });

      expect(delta).toBeLessThanOrEqual(1);
    }
  });
});
