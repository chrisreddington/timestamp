import { test, expect } from '@playwright/test';
import { waitForCountdown } from './fixtures/test-utils';

// Minimal E2E to verify overlay presence and basic accessibility

test.describe('Shadow & Sun overlay (Contribution Graph)', () => {
  test('should render overlay and expose accessible controls', async ({ page }) => {
    await page.goto('/?theme=contribution-graph&mode=timer&duration=60');
    await waitForCountdown(page);

    const overlay = page.getByTestId('cg-shadow-overlay');
    await expect(overlay).toBeVisible();

    // Region labeled by title
    await expect(overlay).toHaveAttribute('role', 'region');
    const title = overlay.locator('.cg-shadow-title');
    await expect(title).toBeVisible();

    // Height input is present and labelled
    const height = page.locator('#cg-shadow-height');
    await expect(height).toBeVisible();
    await height.fill('0.50');

    // Status live region present
    const status = overlay.locator('.cg-shadow-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('role', 'status');

    // Results region present
    const results = overlay.locator('.cg-shadow-results');
    await expect(results).toBeVisible();
  });
});
