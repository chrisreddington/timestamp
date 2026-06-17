import { expect, test } from '@playwright/test';
import {
    VIEWPORTS,
    assertChromeVisibility,
    assertFullscreenExited,
    enterFullscreen,
    exitFullscreen,
    launchCountdown,
    launchCountdownWithDuration,
    moveMouseToRevealExit,
    waitForCountdown,
    waitForFullscreenState,
} from './fixtures/test-utils';

const { mobile: MOBILE_VIEWPORT, tablet: TABLET_VIEWPORT, desktop: DESKTOP_VIEWPORT } = VIEWPORTS;

// Button visibility across breakpoints and modal states
test.describe('Fullscreen Mode - Button Visibility', () => {
  test('shows fullscreen button on desktop only', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);

    const fullscreenButton = page.getByTestId('fullscreen-button');
    await expect(fullscreenButton).toBeVisible();

    const ariaLabel = await fullscreenButton.getAttribute('aria-label');
    expect(ariaLabel).toMatch(/fullscreen|enter fullscreen/i);
  });

  test('hides fullscreen button on tablet', async ({ page }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await launchCountdown(page);
    await expect(page.getByTestId('fullscreen-button')).not.toBeVisible();
  });

  test('hides fullscreen button on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await launchCountdown(page);
    await expect(page.getByTestId('fullscreen-button')).not.toBeVisible();
  });

  test('keeps button visible when theme modal is open', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);

    const fullscreenButton = page.getByTestId('fullscreen-button');
    await expect(fullscreenButton).toBeVisible();

    await page.getByTestId('theme-switcher').click();
    await expect(page.getByTestId('theme-modal')).toBeVisible();
    await expect(fullscreenButton).toBeVisible();
  });
});

// Entering fullscreen and styling
test.describe('Fullscreen Mode - Enter Fullscreen', () => {
  test('enters fullscreen when clicked', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);

    const isFullscreen = await page.evaluate(() => document.fullscreenElement !== null);
    expect(isFullscreen).toBe(true);
  });

  test('hides chrome when entering fullscreen', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await assertChromeVisibility(page, true);
    await enterFullscreen(page);
    await assertChromeVisibility(page, false);
  });

  test('keeps countdown visible with fullscreen styling', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);

    const countdownDisplay = page.getByTestId('countdown-display');
    await expect(countdownDisplay).toBeVisible();

    const appContainer = page.locator('#app');
    const hasFullscreenAttr = await appContainer.evaluate((el) =>
      el.hasAttribute('data-fullscreen') || el.classList.contains('fullscreen-mode')
    );
    expect(hasFullscreenAttr).toBe(true);
  });
});

// Exit button visibility and behavior
test.describe('Fullscreen Mode - Exit Button Behavior', () => {
  test('hides exit button by default', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);
    await expect(page.getByTestId('exit-fullscreen-button')).not.toBeVisible();
  });

  test('shows exit button on mouse movement', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);
    await moveMouseToRevealExit(page);
    await expect(page.getByTestId('exit-fullscreen-button')).toBeVisible({ timeout: 2000 });
  });

  test('exit button remains accessible', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);
    await moveMouseToRevealExit(page);

    const exitButton = page.getByTestId('exit-fullscreen-button');
    await expect(exitButton).toBeVisible();
    const ariaLabel = await exitButton.getAttribute('aria-label');
    expect(ariaLabel).toMatch(/exit fullscreen|leave fullscreen/i);
  });
});

// Exiting fullscreen
test.describe('Fullscreen Mode - Exit Fullscreen', () => {
  test('exits when exit button clicked', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);
    await moveMouseToRevealExit(page);
    await page.getByTestId('exit-fullscreen-button').click();
    await assertFullscreenExited(page);
  });

  test('exits when ESC key pressed', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);
    await page.keyboard.press('Escape');
    await waitForFullscreenState(page, false);

    const isFullscreen = await page.evaluate(() => document.fullscreenElement !== null);
    expect(isFullscreen).toBe(false);
  });

  test('removes fullscreen styling after exit', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);
    await moveMouseToRevealExit(page);
    await page.getByTestId('exit-fullscreen-button').click();
    await assertFullscreenExited(page);
  });
});

// Compatibility and edge behavior
test.describe('Fullscreen Mode - Cross-Browser Compatibility', () => {
  test('hides button when API unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(document, 'fullscreenEnabled', { value: false, writable: false });
    });

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await expect(page.getByTestId('fullscreen-button')).not.toBeVisible();
  });

  test('enters fullscreen across vendor prefixes', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);
    await waitForFullscreenState(page, true);
  });
});

test.describe('Fullscreen Mode - Edge Cases', () => {
  test('handles rapid enter/exit cycles', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);

    for (let i = 0; i < 3; i++) {
      await enterFullscreen(page);
      await waitForFullscreenState(page, true);
      await exitFullscreen(page);
      await waitForFullscreenState(page, false);
    }

    await assertChromeVisibility(page, true);
  });

  test('keeps fullscreen button available during celebration', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdownWithDuration(page, '2');
    await page.locator('[data-celebrating="true"]').waitFor({ timeout: 10000 });

    const fullscreenButton = page.getByTestId('fullscreen-button');
    await expect(fullscreenButton).toBeVisible();
    const isEnabled = await fullscreenButton.evaluate((el) => !(el as HTMLButtonElement).disabled);
    expect(isEnabled).toBe(true);
  });

  test('handles window resize while in fullscreen', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await launchCountdown(page);
    await enterFullscreen(page);
    await waitForFullscreenState(page, true);

    // Chromium refuses Browser.setWindowBounds (used by setViewportSize) while
    // the window is in real fullscreen, so emulate the viewport change via CDP
    // instead. This updates innerWidth/innerHeight (and fires resize) without
    // touching the OS window, exercising the app's resize handling in fullscreen.
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1024,
      height: 1440,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.waitForFunction(
      () => window.innerWidth === 1024 && window.innerHeight === 1440,
      { timeout: 2000 }
    );

    const isFullscreen = await page.evaluate(() => document.fullscreenElement !== null);
    expect(isFullscreen).toBe(true);
    await expect(page.getByTestId('countdown-display')).toBeVisible();
  });
});

// Celebration/resize coverage using timer mode
test('fullscreen button remains available during celebration phase', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto('/?mode=timer&duration=2');
  await waitForCountdown(page);
  await page.locator('[data-celebrating="true"]').waitFor({ timeout: 10000 });

  const fullscreenButton = page.getByTestId('fullscreen-button');
  await expect(fullscreenButton).toBeVisible();
  const isEnabled = await fullscreenButton.evaluate((el) => !(el as HTMLButtonElement).disabled);
  expect(isEnabled).toBe(true);
});

test('can enter fullscreen during celebration phase', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Fullscreen API unreliable in headless webkit');

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto('/?mode=timer&duration=2');
  await waitForCountdown(page);
  await page.locator('[data-celebrating="true"]').waitFor({ timeout: 10000 });

  // Verify button is clickable and functional
  const fullscreenButton = page.getByTestId('fullscreen-button');
  await expect(fullscreenButton).toBeVisible();
  await fullscreenButton.click();
  
  await waitForFullscreenState(page, true);
  const isFullscreen = await page.evaluate(() => document.fullscreenElement !== null);
  expect(isFullscreen).toBe(true);
});
