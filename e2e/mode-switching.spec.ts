/**
 * E2E Tests: Mode Switching
 *
 * Regression coverage for target-date desync when switching between modes.
 */

import { test, expect } from '@playwright/test';
import { waitForCountdown } from './fixtures/test-utils';

async function getThemeContainerLabel(page: import('@playwright/test').Page): Promise<string> {
  const container = page.locator('[data-testid="theme-container"]').first();
  const label = await container.getAttribute('aria-label');
  expect(label).not.toBeNull();
  return label as string;
}

function toLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

test.describe('Mode Switching', () => {
  test('should maintain correct target when switching from timer to wall-clock', async ({ page }) => {
    await page.goto('/?mode=timer&duration=300');
    await page.waitForLoadState('networkidle');
    await waitForCountdown(page);

    const initialLabel = await getThemeContainerLabel(page);
    expect(initialLabel).toMatch(/4 minutes|5 minutes/);

    // Wall-clock mode requires target WITHOUT Z suffix (local time format)
    const futureDate = toLocalDateTime(new Date(Date.now() + 600_000));
    await page.goto(`/?mode=wall-clock&target=${futureDate}`);
    await page.waitForLoadState('networkidle');
    await waitForCountdown(page);

    const wallClockLabel = await getThemeContainerLabel(page);
    expect(wallClockLabel).toMatch(/9 minutes|10 minutes/);
  });

  test('should maintain correct target when switching from wall-clock to timer', async ({ page }) => {
    // Wall-clock mode requires target WITHOUT Z suffix (local time format)
    const futureDate = toLocalDateTime(new Date(Date.now() + 600_000));
    await page.goto(`/?mode=wall-clock&target=${futureDate}`);
    await page.waitForLoadState('networkidle');
    await waitForCountdown(page);

    const initialLabel = await getThemeContainerLabel(page);
    expect(initialLabel).toMatch(/9 minutes|10 minutes/);

    await page.goto('/?mode=timer&duration=120');
    await page.waitForLoadState('networkidle');
    await waitForCountdown(page);

    const timerLabel = await getThemeContainerLabel(page);
    expect(timerLabel).toMatch(/1 minute|2 minutes/);
  });

  test('should maintain correct target when switching from timer to absolute', async ({ page }) => {
    await page.goto('/?mode=timer&duration=300');
    await page.waitForLoadState('networkidle');
    await waitForCountdown(page);

    const futureDate = new Date(Date.now() + 600_000).toISOString();
    await page.goto(`/?mode=absolute&target=${futureDate}`);
    await page.waitForLoadState('networkidle');
    await waitForCountdown(page);

    const absoluteLabel = await getThemeContainerLabel(page);
    expect(absoluteLabel).toMatch(/9 minutes|10 minutes/);
  });

  test('should properly cleanup theme when switching from timer to wall-clock', async ({ page }) => {
    await page.goto('/?mode=timer&duration=300&theme=contribution-graph');
    await page.waitForLoadState('networkidle');
    await waitForCountdown(page);

    await expect(page.getByTestId('countdown-display')).toBeAttached();

    const futureDate = toLocalDateTime(new Date(Date.now() + 600_000));
    await page.goto(`/?mode=wall-clock&target=${futureDate}&theme=contribution-graph`);
    await page.waitForLoadState('networkidle');

    await waitForCountdown(page);
    await expect(page.getByTestId('countdown-display')).toBeAttached();

    const label = await page.getByTestId('theme-container').getAttribute('aria-label');
    expect(label).toMatch(/Countdown/i);
  });
});
