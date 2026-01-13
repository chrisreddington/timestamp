/**
 * E2E tests for the color mode toggle component across all views.
 * Tests visibility, interactions, CSS variable application, and persistence.
 */

import { expect, test, type Page } from '@playwright/test';
import { waitForCountdown, waitForLandingPage } from './fixtures/test-utils';

const FUTURE_TARGET = new Date('2099-01-01T00:00:00').toISOString().slice(0, -1);

/**
 * Start a countdown from the landing page.
 */
async function startCountdownFromLanding(page: Page): Promise<void> {
  await page.goto('/');
  await waitForLandingPage(page);
  
  // Click Start button with default settings
  await page.getByTestId('landing-start-button').click();
  await waitForCountdown(page);
}

/**
 * Get CSS custom property value from document root.
 */
async function getCSSVariable(page: Page, varName: string): Promise<string> {
  return page.evaluate((v) => {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue(v).trim();
  }, varName);
}

/**
 * Emulate prefers-color-scheme media query.
 */
async function setColorSchemePreference(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
}

test.describe('Color Mode Toggle - Landing Page', () => {
  test('should be visible on landing page', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    const colorModeToggle = page.getByTestId('color-mode-toggle');
    await expect(colorModeToggle).toBeVisible();
  });

  test('should have correct default selection (system)', async ({ page }) => {
    // Clear localStorage to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForLandingPage(page);

    const systemOption = page.locator('button[data-mode="system"][aria-checked="true"]');
    await expect(systemOption).toBeVisible();
  });

  test('should apply light mode colors when Light is selected', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    // Click Light mode button
    const lightOption = page.locator('button[data-mode="light"]');
    await lightOption.click();

    // Wait for color mode attribute to update
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');

    // Verify light mode CSS variables are applied (contribution-graph light colors)
    const accentPrimary = await getCSSVariable(page, '--color-accent-primary');
    const accentSecondary = await getCSSVariable(page, '--color-accent-secondary');
    
    expect(accentPrimary).toBe('#1a7f37'); // contribution-graph light primary
    expect(accentSecondary).toBe('#116329'); // contribution-graph light secondary
  });

  test('should apply dark mode colors when Dark is selected', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    // Click Dark mode button
    const darkOption = page.locator('button[data-mode="dark"]');
    await darkOption.click();

    // Wait for color mode attribute to update
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');

    // Verify dark mode CSS variables are applied (contribution-graph dark colors)
    const accentPrimary = await getCSSVariable(page, '--color-accent-primary');
    const accentSecondary = await getCSSVariable(page, '--color-accent-secondary');
    
    expect(accentPrimary).toBe('#39d353'); // contribution-graph dark primary
    expect(accentSecondary).toBe('#26a641'); // contribution-graph dark secondary
  });

  test('should respect system preference when System is selected', async ({ page }) => {
    // Emulate light mode system preference
    await setColorSchemePreference(page, 'light');
    await page.goto('/');
    await waitForLandingPage(page);

    // Select System mode button
    const systemOption = page.locator('button[data-mode="system"]');
    await systemOption.click();

    // Verify light colors are applied
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
    const accentPrimary = await getCSSVariable(page, '--color-accent-primary');
    expect(accentPrimary).toBe('#1a7f37'); // light mode color
  });

  test('should persist color mode preference across page reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await waitForLandingPage(page);

    // Select dark mode button
    const darkOption = page.locator('button[data-mode="dark"]');
    await darkOption.click();
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');

    // Reload page
    await page.reload();
    await waitForLandingPage(page);

    // Verify dark mode is still selected
    await expect(page.locator('button[data-mode="dark"][aria-checked="true"]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  });
});

test.describe('Color Mode Toggle - Countdown Page', () => {
  test('should be visible in button container on countdown page', async ({ page }) => {
    await startCountdownFromLanding(page);

    const colorModeToggle = page.getByTestId('color-mode-toggle');
    await expect(colorModeToggle).toBeVisible();

    // Verify it's in the button container
    const buttonContainer = page.locator('.countdown-button-container');
    await expect(buttonContainer.locator('[data-testid="color-mode-toggle"]')).toBeVisible();
  });

  test('should update theme colors when mode changes on countdown page', async ({ page }) => {
    await startCountdownFromLanding(page);

    // Start in system/light mode
    await setColorSchemePreference(page, 'light');
    await page.reload();
    await waitForCountdown(page);

    // Select dark mode button
    const darkOption = page.locator('button[data-mode="dark"]');
    await darkOption.click();

    // Verify theme colors changed to dark
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
    const accentPrimary = await getCSSVariable(page, '--color-accent-primary');
    expect(accentPrimary).toBe('#39d353'); // contribution-graph dark primary
  });

    // Removed redundant theme switching color update test
});

test.describe('Color Mode Toggle - Mobile Menu', () => {
  test('should appear in mobile menu on small viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 400, height: 800 });
    
    await startCountdownFromLanding(page);

    // Open mobile menu
    const menuButton = page.getByTestId('mobile-menu-button');
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Verify color mode toggle is in the menu
    const overlay = page.getByTestId('mobile-menu-overlay');
    await expect(overlay).toBeVisible();
    
    const colorModeToggle = overlay.getByTestId('color-mode-toggle');
    await expect(colorModeToggle).toBeVisible();
  });

  test('should update colors when interacting with toggle in mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await startCountdownFromLanding(page);

    // Open mobile menu
    await page.getByTestId('mobile-menu-button').click();
    const overlay = page.getByTestId('mobile-menu-overlay');
    await expect(overlay).toBeVisible();

    // Click dark mode button in menu
    const darkOption = overlay.locator('button[data-mode="dark"]');
    await darkOption.click();

    // Verify colors changed
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
    const accentPrimary = await getCSSVariable(page, '--color-accent-primary');
    expect(accentPrimary).toBe('#39d353');
  });
});

test.describe('Color Mode Toggle - Fullscreen Mode', () => {
  test('should be hidden when fullscreen mode is active', async ({ page }) => {
    await startCountdownFromLanding(page);

    // Verify toggle is visible initially
    const colorModeToggle = page.getByTestId('color-mode-toggle');
    await expect(colorModeToggle).toBeVisible();

    // Enter fullscreen mode (simulate by adding class - actual fullscreen API is restricted)
    await page.evaluate(() => {
      document.body.classList.add('fullscreen-mode');
      const container = document.querySelector('.countdown-button-container');
      if (container) {
        container.setAttribute('data-chrome-hidden', 'true');
      }
    });

    // Verify button container (which contains toggle) is hidden
    const buttonContainer = page.locator('.countdown-button-container');
    await expect(buttonContainer).not.toBeVisible();
  });
});

test.describe('Color Mode Toggle - Theme Preview Videos', () => {
  test('should switch theme preview video posters when color mode changes', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    // Get the first theme card's preview video (cards now use video elements)
    const previewVideo = page.locator('.theme-selector-card-preview-video').first();
    await expect(previewVideo).toBeVisible();

    // Select light mode
    const lightOption = page.locator('button[data-mode="light"]');
    await lightOption.click();
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');

    // Get the poster in light mode
    const lightModePoster = await previewVideo.getAttribute('poster');

    // Switch to dark mode
    const darkOption = page.locator('button[data-mode="dark"]');
    await darkOption.click();
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');

    // Wait for the poster to update
    await expect.poll(() => previewVideo.getAttribute('poster')).toMatch(/preview-dark/);

    const darkModePoster = await previewVideo.getAttribute('poster');

    // Posters should be different (light vs dark preview)
    expect(lightModePoster).not.toBe(darkModePoster);
    expect(lightModePoster).toContain('preview-light');
    expect(darkModePoster).toContain('preview-dark');
  });
  // Removed preview-mode duplication tests that checked initial system preference and bulk card updates.
});

test.describe('Color Mode Toggle - Accessibility', () => {
  test('should have correct ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    // The radiogroup role is on the inner group, not the container
    const radioGroup = page.locator('.color-mode-toggle-group');
    await expect(radioGroup).toHaveAttribute('role', 'radiogroup');
    await expect(radioGroup).toHaveAttribute('aria-label', 'Color mode');

    // Check radio buttons have correct attributes
    const lightOption = page.locator('button[data-mode="light"]');
    await expect(lightOption).toHaveAttribute('role', 'radio');
    await expect(lightOption).toHaveAttribute('aria-label', 'Light mode');
    
    const darkOption = page.locator('button[data-mode="dark"]');
    await expect(darkOption).toHaveAttribute('role', 'radio');
    await expect(darkOption).toHaveAttribute('aria-label', 'Dark mode');
    
    const systemOption = page.locator('button[data-mode="system"]');
    await expect(systemOption).toHaveAttribute('role', 'radio');
    await expect(systemOption).toHaveAttribute('aria-label', 'System mode');
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    // Focus the first radio button
    const lightOption = page.locator('button[data-mode="light"]');
    await lightOption.focus();

    // Press Enter to select
    await page.keyboard.press('Enter');
    await expect(lightOption).toHaveAttribute('aria-checked', 'true');

    // Press ArrowRight to move to next option (auto-selects in our implementation)
    // Note: Our implementation only focuses on arrow, doesn't auto-select
    // This matches some radio patterns, though ARIA recommends auto-selection
    await page.keyboard.press('ArrowRight');
    const darkOption = page.locator('button[data-mode="dark"]');
    await expect(darkOption).toBeFocused();
    
    // Need to press Enter to select after arrow navigation
    await page.keyboard.press('Enter');
    await expect(darkOption).toHaveAttribute('aria-checked', 'true');

    // Press ArrowRight again to move to system
    await page.keyboard.press('ArrowRight');
    const systemOption = page.locator('button[data-mode="system"]');
    await expect(systemOption).toBeFocused();
    
    // Select system mode
    await page.keyboard.press('Enter');
    await expect(systemOption).toHaveAttribute('aria-checked', 'true');

    // Press ArrowLeft to go back
    await page.keyboard.press('ArrowLeft');
    await expect(darkOption).toBeFocused();
  });

  test('should be keyboard focusable with Tab', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    // Find first radio button within toggle
    const toggle = page.getByTestId('color-mode-toggle');
    const firstButton = toggle.locator('button[role="radio"]').first();
    await firstButton.focus();
    
    // Verify it's focused
    await expect(firstButton).toBeFocused();
  });
});
