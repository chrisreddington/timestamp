/**
 * Consolidated E2E coverage for mobile menu, responsive chrome, and viewport safety.
 * Reduces duplication from prior mobile-menu*, mobile-viewport, and mobile-resize specs.
 */

import { expect, test } from '@playwright/test';
import {
    DESKTOP_VIEWPORT,
    FIREWORKS_TEST_URL,
    MOBILE_VIEWPORT,
    SMALL_MOBILE_VIEWPORT,
    TABLET_VIEWPORT,
    TEST_URL,
    TIMER_TEST_URL,
} from './fixtures/mobile-constants';
import {
    assertDropdownNavigationStaysVisible,
    closeHamburgerOverlay,
    expectAlignedRows,
    expectNoHorizontalOverflow,
    getLastCopiedText,
    gotoWithViewport,
    mockClipboard,
    openHamburgerOverlay,
    waitForCountdown,
    waitForMobileMenuButton,
} from './fixtures/test-utils';
import { getWorldMapThemes, THEME_FIXTURES } from './fixtures/theme-fixtures';

const WALL_CLOCK_QUERY = '/?mode=wall-clock&target=2099-01-01T00:00:00';

// ---------------------------------------------------------------------------
// Viewport-driven visibility and layout
// ---------------------------------------------------------------------------

test.describe('Hamburger visibility by viewport', () => {
  const cases = [
    { name: 'mobile', viewport: MOBILE_VIEWPORT, expectVisible: true },
    { name: 'small mobile', viewport: SMALL_MOBILE_VIEWPORT, expectVisible: true },
    { name: 'tablet', viewport: TABLET_VIEWPORT, expectVisible: true }, // 768px ≤ 1050px mobile breakpoint
    { name: 'desktop', viewport: DESKTOP_VIEWPORT, expectVisible: false },
  ];

  for (const variant of cases) {
    test(`shows hamburger on ${variant.name} only`, async ({ page }) => {
      await gotoWithViewport(page, variant.viewport, TEST_URL);
      const hamburger = page.getByTestId('mobile-menu-button');
      if (variant.expectVisible) {
        await expect(hamburger).toBeVisible();
      } else {
        await expect(hamburger).not.toBeVisible();
      }
    });
  }
});

test.describe('Inline chrome visibility by viewport', () => {
  // World map visibility tests only for themes that support it
  for (const { id } of getWorldMapThemes()) {
    test(`${id}: hides world map on mobile`, async ({ page }) => {
      await gotoWithViewport(page, MOBILE_VIEWPORT, `/?theme=${id}&mode=wall-clock&target=2099-01-01T00:00:00`);
      const worldMap = page.getByTestId('world-map');
      await expect(worldMap).not.toBeVisible();
    });

    test(`${id}: shows world map on desktop`, async ({ page }) => {
      await gotoWithViewport(page, DESKTOP_VIEWPORT, `/?theme=${id}&mode=wall-clock&target=2099-01-01T00:00:00`);
      const worldMap = page.getByTestId('world-map');
      await expect(worldMap).toBeVisible();
    });
  }

  // Timezone selector and share button tests for all themes
  for (const { id } of THEME_FIXTURES) {
    test(`${id}: hides timezone selector on mobile`, async ({ page }) => {
      await gotoWithViewport(page, MOBILE_VIEWPORT, `/?theme=${id}&mode=wall-clock&target=2099-01-01T00:00:00`);
      const timezoneSelector = page.getByTestId('timezone-selector');
      await expect(timezoneSelector).not.toBeVisible();
    });

    test(`${id}: shows inline chrome on desktop`, async ({ page }) => {
      await gotoWithViewport(page, DESKTOP_VIEWPORT, `/?theme=${id}&mode=wall-clock&target=2099-01-01T00:00:00`);
      const timezoneSelector = page.getByTestId('timezone-selector');
      const shareButton = page.getByTestId('share-button');
      await expect(timezoneSelector).toBeVisible();
      await expect(shareButton).toBeVisible();
    });
  }
});

test.describe('Horizontal overflow guard', () => {
  for (const viewport of [MOBILE_VIEWPORT, SMALL_MOBILE_VIEWPORT]) {
    for (const { id } of THEME_FIXTURES) {
      test(`${id}: no horizontal scroll at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await gotoWithViewport(page, viewport, `/?theme=${id}&mode=wall-clock&target=2099-01-01T00:00:00`);
        await expectNoHorizontalOverflow(page);
      });
    }
  }
});

test.describe('Resize smoke', () => {
  test('hamburger appears after shrinking to mobile', async ({ page }) => {
    await gotoWithViewport(page, DESKTOP_VIEWPORT, TEST_URL);
    const hamburger = page.getByTestId('mobile-menu-button');
    await expect(hamburger).not.toBeVisible();

    await page.setViewportSize(MOBILE_VIEWPORT);
    await expect(hamburger).toBeVisible();
  });

  test('overlay closes when resizing back to desktop', async ({ page }) => {
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    await waitForMobileMenuButton(page);
    await page.getByTestId('mobile-menu-button').click();
    const overlay = page.getByTestId('mobile-menu-overlay');
    await expect(overlay).toBeVisible();

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await expect(overlay).not.toBeVisible();
  });

  test('fullscreen button appears after expanding from mobile to desktop', async ({ page }) => {
    // Start in mobile viewport - fullscreen button should not exist
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    await waitForCountdown(page);
    
    const fullscreenButton = page.getByTestId('fullscreen-button');
    await expect(fullscreenButton).not.toBeVisible();

    // Resize to desktop - fullscreen button should now appear
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await expect(fullscreenButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Hamburger overlay behavior
// ---------------------------------------------------------------------------

test.describe('Hamburger overlay basics', () => {
  test('opens with expected controls and world map in wall-clock mode', async ({ page }) => {
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    await waitForCountdown(page);
    const { overlay } = await openHamburgerOverlay(page);

    await expect(overlay.getByTestId('share-selected-timezone')).toBeVisible();
    await expect(overlay.getByTestId('favorite-button')).toBeVisible();
    await expect(overlay.getByTestId('theme-switcher')).toBeVisible();
    await expect(overlay.getByTestId('timezone-selector')).toBeVisible();
    await expect(overlay.getByTestId('world-map')).toBeVisible();
  });

  test('closes and returns focus to hamburger button', async ({ page }) => {
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    await waitForMobileMenuButton(page);
    const { button } = await openHamburgerOverlay(page);
    await closeHamburgerOverlay(page);
    await expect(button).toBeFocused();
  });

  test('Escape closes overlay', async ({ page }) => {
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    await waitForMobileMenuButton(page);
    await page.getByTestId('mobile-menu-button').click();
    const overlay = page.getByTestId('mobile-menu-overlay');
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible();
  });
});

test.describe('Overlay content by mode', () => {
  test('timer mode omits timezone and world map', async ({ page }) => {
    await gotoWithViewport(page, MOBILE_VIEWPORT, TIMER_TEST_URL);
    await waitForCountdown(page);
    const { overlay } = await openHamburgerOverlay(page);
    await expect(overlay.getByTestId('share-button')).toBeVisible();
    await expect(overlay.getByTestId('theme-switcher')).toBeVisible();
    await expect(overlay.getByTestId('timezone-selector')).toHaveCount(0);
    await expect(overlay.getByTestId('world-map')).toHaveCount(0);
  });

  test('wall-clock mode shows timezone and world map', async ({ page }) => {
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    const { overlay } = await openHamburgerOverlay(page);
    await expect(overlay.getByTestId('timezone-selector')).toBeVisible();
    await expect(overlay.getByTestId('world-map')).toBeVisible();
  });
});

test.describe('Share and theme actions inside overlay', () => {
  test('share copies current link', async ({ page }) => {
    await mockClipboard(page);
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    const { overlay } = await openHamburgerOverlay(page);

    const selectedTz = overlay.getByTestId('share-selected-timezone');
    await expect(selectedTz).toBeVisible();
    await selectedTz.click();
    const copied = await getLastCopiedText(page);
    expect(copied).toContain('theme=contribution-graph');
  });

  test('theme switcher opens modal above overlay', async ({ page }) => {
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    const { overlay } = await openHamburgerOverlay(page);

    const switcher = overlay.getByTestId('theme-switcher');
    await switcher.click();
    const modal = page.getByTestId('theme-modal');
    await expect(modal).toBeVisible();

    const overlayZ = await overlay.evaluate((el) => parseInt(window.getComputedStyle(el).zIndex) || 0);
    const modalZ = await page.getByTestId('theme-modal-overlay').evaluate((el) => parseInt(window.getComputedStyle(el).zIndex) || 0);
    expect(modalZ).toBeGreaterThan(overlayZ);
  });
});

test.describe('Overlay persistence across reopen', () => {
  test('actions remain available after close/reopen (X and Escape)', async ({ page }) => {
    await gotoWithViewport(page, MOBILE_VIEWPORT, TEST_URL);
    const { overlay } = await openHamburgerOverlay(page);
    await expect(overlay.getByTestId('share-selected-timezone')).toBeVisible();
    await closeHamburgerOverlay(page);

    await page.getByTestId('mobile-menu-button').click();
    const reopened = page.getByTestId('mobile-menu-overlay');
    await expect(reopened).toBeVisible();
    await expect(reopened.getByTestId('share-selected-timezone')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(reopened).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Desktop alignment regression guard
// ---------------------------------------------------------------------------

test.describe('Desktop action bar layout', () => {
  test('action buttons align horizontally', async ({ page }) => {
    await gotoWithViewport(page, DESKTOP_VIEWPORT, FIREWORKS_TEST_URL);
    const buttonContainer = page.getByTestId('countdown-button-container');
    await expect(buttonContainer).toBeVisible();

    const display = await buttonContainer.evaluate((el) => window.getComputedStyle(el).display);
    const flexDirection = await buttonContainer.evaluate((el) => window.getComputedStyle(el).flexDirection);
    expect(display).toBe('flex');
    expect(flexDirection).toBe('row');

    const buttons = await buttonContainer.locator(':scope > button, :scope > a, :scope > div > button[data-testid="share-button"], :scope > div > a').all();
    const boxes = await Promise.all(buttons.map((btn) => btn.boundingBox()));
    await expectAlignedRows(boxes);
  });
});

// ---------------------------------------------------------------------------
// Dropdown navigation helper coverage (shared with timezone tests)
// ---------------------------------------------------------------------------

test.describe('Timezone dropdown navigation remains visible', () => {
  const navigationKeys = Array.from({ length: 30 }, () => 'ArrowDown');

  test('countdown page (desktop)', async ({ page }) => {
    await gotoWithViewport(page, DESKTOP_VIEWPORT, WALL_CLOCK_QUERY + '&skip=true');
    await waitForCountdown(page);
    const trigger = page.getByTestId('timezone-selector').getByRole('button').first();
    await trigger.click();
    const dropdownList = page.getByTestId('timezone-dropdown-list');
    const searchInput = page.getByRole('searchbox', { name: 'Search timezones' });
    await assertDropdownNavigationStaysVisible({
      page,
      dropdownList,
      searchInput,
      navigationKeys,
    });
  });

  test('landing page', async ({ page }) => {
    await page.goto('/');
    const timezoneSection = page.getByTestId('landing-timezone-section');
    const trigger = timezoneSection.getByRole('button').first();
    await trigger.click();
    const dropdownList = timezoneSection.getByTestId('timezone-dropdown-list');
    const searchInput = timezoneSection.getByRole('searchbox', { name: 'Search timezones' });
    await assertDropdownNavigationStaysVisible({
      page,
      dropdownList,
      searchInput,
      navigationKeys,
    });
  });
});
