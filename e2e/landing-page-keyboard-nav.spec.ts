/**
 * @file landing-page-keyboard-nav.spec.ts
 * @description E2E tests for landing page keyboard navigation accessibility.
 *
 * Tests focus management and tab order across different countdown modes.
 * Specifically validates that Shift+Tab from Timer mode inputs returns
 * to the mode selector (Focus Order compliance).
 */

import { expect, test, type Page } from '@playwright/test';

const getFocusableThemeCard = (page: Page) =>
  page.locator('[data-testid^="theme-card-"] [role="gridcell"][tabindex="0"]').first();

test.describe('Landing Page Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/timestamp/');
    await page.waitForSelector('[data-testid="landing-page"]');
  });

  test.describe('Timer Mode Tab Navigation', () => {
    test('Shift+Tab from hours input should focus mode selector', async ({ page }) => {
      // Select Timer mode
      const timerRadio = page.getByTestId('landing-mode-timer');
      await timerRadio.click();

      // Verify Timer mode is selected
      await expect(timerRadio).toBeChecked();

      // Verify timer section is visible
      const timerSection = page.getByTestId('landing-timer-section');
      await expect(timerSection).toBeVisible();

      // Focus the hours input
      const hoursInput = page.getByTestId('landing-duration-hours');
      await hoursInput.focus();
      await expect(hoursInput).toBeFocused();

      // Press Shift+Tab to navigate backward
      await page.keyboard.press('Shift+Tab');

      // Should focus the Timer radio button (the selected mode)
      // The roving tabindex should have made the timer radio (index 2) tabbable
      await expect(timerRadio).toBeFocused();
    });

    test('Shift+Tab three times from minutes input reaches theme selector', async ({ page }) => {
      // Select Timer mode
      const timerRadio = page.locator('#mode-timer');
      await timerRadio.click();
      await expect(timerRadio).toBeChecked();

      // Focus the minutes input
      const minutesInput = page.getByTestId('landing-duration-minutes');
      await minutesInput.focus();
      await expect(minutesInput).toBeFocused();

      // Shift+Tab to hours input
      await page.keyboard.press('Shift+Tab');
      const hoursInput = page.getByTestId('landing-duration-hours');
      await expect(hoursInput).toBeFocused();

      // Shift+Tab to mode selector
      await page.keyboard.press('Shift+Tab');
      await expect(timerRadio).toBeFocused();

      // Shift+Tab to theme selector (card with tabindex="0")
      await page.keyboard.press('Shift+Tab');
      await expect(getFocusableThemeCard(page)).toBeFocused();
    });

    test('Tab from mode selector should reach timer inputs when Timer mode selected', async ({ page }) => {
      // Select Timer mode
      const timerRadio = page.getByTestId('landing-mode-timer');
      await timerRadio.click();
      await expect(timerRadio).toBeChecked();

      // Focus the timer radio
      await timerRadio.focus();

      // Tab forward should go to hours input (skipping inert date section)
      await page.keyboard.press('Tab');
      const hoursInput = page.getByTestId('landing-duration-hours');
      await expect(hoursInput).toBeFocused();
    });

    test('Shift+Tab from mode selector should reach theme selector', async ({ page }) => {
      // Select Timer mode
      const timerRadio = page.locator('#mode-timer');
      await timerRadio.click();
      await expect(timerRadio).toBeChecked();

      // Focus the timer radio
      await timerRadio.focus();

      // Shift+Tab backward should go to theme selector (card with tabindex="0")
      await page.keyboard.press('Shift+Tab');
      await expect(getFocusableThemeCard(page)).toBeFocused();
    });
  });

  test.describe('Wall-Clock Mode Tab Navigation', () => {
    test('Shift+Tab from date input should focus mode selector', async ({ page }) => {
      // Wall-clock mode is the default
      const wallClockRadio = page.getByTestId('landing-mode-wall-clock');
      await expect(wallClockRadio).toBeChecked();

      // Focus the date input
      const dateInput = page.getByTestId('landing-date-picker');
      await dateInput.focus();
      await expect(dateInput).toBeFocused();

      // Press Shift+Tab to navigate backward
      await page.keyboard.press('Shift+Tab');

      // Should focus the wall-clock radio button (the selected mode)
      await expect(wallClockRadio).toBeFocused();
    });

    test('Shift+Tab from mode selector should reach theme selector', async ({ page }) => {
      // Wall-clock mode is the default
      const wallClockRadio = page.getByTestId('landing-mode-wall-clock');
      await expect(wallClockRadio).toBeChecked();

      // Focus the wall-clock radio
      await wallClockRadio.focus();

      // Shift+Tab backward should go to theme selector (card with tabindex="0")
      await page.keyboard.press('Shift+Tab');
      await expect(getFocusableThemeCard(page)).toBeFocused();
    });

    test('Timer section should be inert in wall-clock mode', async ({ page }) => {
      // Wall-clock mode is the default
      const wallClockRadio = page.locator('#mode-wall-clock');
      await expect(wallClockRadio).toBeChecked();

      // Timer section should be hidden/inert
      const timerSection = page.getByTestId('landing-timer-section');
      await expect(timerSection).toHaveAttribute('inert', 'true');
      await expect(timerSection).toBeHidden();
    });
  });

  test.describe('Absolute Mode Tab Navigation', () => {
    test('Shift+Tab from date input should focus mode selector in absolute mode', async ({ page }) => {
      // Select Absolute mode
      const absoluteRadio = page.getByTestId('landing-mode-absolute');
      await absoluteRadio.click();
      await expect(absoluteRadio).toBeChecked();

      // Focus the date input
      const dateInput = page.getByTestId('landing-date-picker');
      await dateInput.focus();
      await expect(dateInput).toBeFocused();

      // Press Shift+Tab to navigate backward
      await page.keyboard.press('Shift+Tab');

      // Should focus the absolute radio button (the selected mode)
      await expect(absoluteRadio).toBeFocused();
    });
  });

  test.describe('Mode Switching Focus Management', () => {
    test('should update roving tabindex when switching from wall-clock to timer', async ({ page }) => {
      // Start in wall-clock mode (default)
      const wallClockRadio = page.getByTestId('landing-mode-wall-clock');
      await expect(wallClockRadio).toBeChecked();

      // Switch to timer mode
      const timerRadio = page.getByTestId('landing-mode-timer');
      await timerRadio.click();
      await expect(timerRadio).toBeChecked();

      // The timer radio should now be the tabbable element in the group (tabindex="0")
      await expect(timerRadio).toHaveAttribute('tabindex', '0');

      // Other radios should have tabindex="-1"
      await expect(wallClockRadio).toHaveAttribute('tabindex', '-1');
      await expect(page.locator('#mode-absolute')).toHaveAttribute('tabindex', '-1');
    });

    test('should update roving tabindex when switching from timer to absolute', async ({ page }) => {
      // Select Timer mode first
      const timerRadio = page.getByTestId('landing-mode-timer');
      await timerRadio.click();
      await expect(timerRadio).toBeChecked();

      // Switch to absolute mode
      const absoluteRadio = page.getByTestId('landing-mode-absolute');
      await absoluteRadio.click();
      await expect(absoluteRadio).toBeChecked();

      // The absolute radio should now be the tabbable element
      await expect(absoluteRadio).toHaveAttribute('tabindex', '0');

      // Timer radio should have tabindex="-1"
      await expect(timerRadio).toHaveAttribute('tabindex', '-1');
    });

    test('should maintain focus order integrity when rapidly switching modes', async ({ page }) => {
      const wallClockRadio = page.getByTestId('landing-mode-wall-clock');
      const absoluteRadio = page.getByTestId('landing-mode-absolute');
      const timerRadio = page.getByTestId('landing-mode-timer');

      // Rapid mode switches
      await absoluteRadio.click();
      await timerRadio.click();
      await wallClockRadio.click();
      await timerRadio.click();

      // Final state: Timer mode
      await expect(timerRadio).toBeChecked();
      await expect(timerRadio).toHaveAttribute('tabindex', '0');

      // Focus hours input and Shift+Tab back
      const hoursInput = page.getByTestId('landing-duration-hours');
      await hoursInput.focus();
      await page.keyboard.press('Shift+Tab');

      // Should correctly reach the timer radio
      await expect(timerRadio).toBeFocused();
    });
  });

  test.describe('Full Tab Cycle', () => {
    test('should have logical tab order in Timer mode', async ({ page }) => {
      // Select Timer mode first
      const timerRadio = page.getByTestId('landing-mode-timer');
      await timerRadio.click();

      // Start from theme selector search input (first focusable element)
      const searchInput = page.getByTestId('theme-search-input');
      await searchInput.focus();
      await expect(searchInput).toBeFocused();

      // Tab through theme selector to reach mode selector
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const isFocused = await timerRadio.evaluate((el) => el === document.activeElement);
        if (isFocused) break;
        await page.keyboard.press('Tab');
        attempts++;
      }
      await expect(timerRadio).toBeFocused();

      // Tab through timer inputs
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('landing-duration-hours')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.getByTestId('landing-duration-minutes')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.getByTestId('landing-duration-seconds')).toBeFocused();

      // Tab to completion message
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('landing-completion-message')).toBeFocused();

      // Tab to start button
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('landing-start-button')).toBeFocused();
    });

    test('should have logical reverse tab order in Timer mode', async ({ page }) => {
      // Select Timer mode
      const timerRadio = page.locator('#mode-timer');
      await timerRadio.click();

      // Start from start button
      const startButton = page.getByTestId('landing-start-button');
      await startButton.focus();

      // Shift+Tab to completion message
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByTestId('landing-completion-message')).toBeFocused();

      // Continue Shift+Tab through timer inputs
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByTestId('landing-duration-seconds')).toBeFocused();

      await page.keyboard.press('Shift+Tab');
      await expect(page.getByTestId('landing-duration-minutes')).toBeFocused();

      await page.keyboard.press('Shift+Tab');
      await expect(page.getByTestId('landing-duration-hours')).toBeFocused();

      // Shift+Tab should reach mode selector
      await page.keyboard.press('Shift+Tab');
      await expect(timerRadio).toBeFocused();

      // Shift+Tab should reach theme selector (card with tabindex="0")
      await page.keyboard.press('Shift+Tab');
      await expect(getFocusableThemeCard(page)).toBeFocused();
    });
  });
});
