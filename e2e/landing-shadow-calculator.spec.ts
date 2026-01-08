import { test, expect } from '@playwright/test';
import { waitForLandingPage } from './fixtures/test-utils';

test.use({
  geolocation: { latitude: 37.7749, longitude: -122.4194 },
  permissions: ['geolocation'],
});

test.describe('Landing Shadow Calculator', () => {
  test('renders and updates after requesting location', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    const section = page.getByTestId('landing-shadow-section');
    await expect(section).toBeVisible();

    const status = page.getByTestId('shadow-location-status');
    await expect(status).toContainText(/Use my location|Click "Use my location"/i);

    const heightInput = page.getByTestId('shadow-height-input');
    await heightInput.fill('1.50');

    await page.getByTestId('shadow-location-button').click();
    await expect(status).toContainText(/Location detected|Requesting location/i, { timeout: 5000 });

    const results = page.getByTestId('shadow-results');
    await expect(results).not.toContainText('Waiting for location');
    await expect(results).not.toContainText('Location required');
  });
});
