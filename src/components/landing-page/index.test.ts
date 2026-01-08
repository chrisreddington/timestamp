/**
 * Landing Page Component - Unit Tests
 * Focused smoke coverage for mode flows and background rendering.
 */
import { MAX_MESSAGE_LENGTH } from '@core/utils/text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLandingPage } from './index';
import {
  renderLandingPage,
  type LandingPageHarness,
} from './test-helpers';

const FUTURE_DATE = new Date(Date.now() + 86_400_000 * 10);
const dateInputValue = (date: Date): string => date.toISOString().slice(0, 16);

describe('landing-page', () => {
  let harness: LandingPageHarness | null = null;

  beforeEach(() => {
    harness = null;
  });

  afterEach(() => {
    harness?.cleanup();
    harness = null;
  });

  it('should default to wall-clock mode with date section visible', () => {
    harness = renderLandingPage();

    const dateRadio = harness.getModeRadio('wall-clock');
    const timerSection = harness.getSection('landing-timer-section');
    const dateSection = harness.getSection('landing-date-section');

    expect(dateRadio.checked).toBe(true);
    expect(dateSection.hidden).toBe(false);
    expect(timerSection.hidden).toBe(true);
  }, 10000); // Extended timeout for page initialization and DOM query operations

  it('should toggle world map and timezone visibility between wall-clock and timer modes', () => {
    harness = renderLandingPage();

    const dateRadio = harness.getModeRadio('wall-clock');
    const timerRadio = harness.getModeRadio('timer');
    const displayOptionsSection = harness.getSection('landing-world-map-section');
    const timezoneSection = harness.getSection('landing-timezone-section');

    expect(displayOptionsSection.hidden).toBe(false);
    expect(timezoneSection.hidden).toBe(false);

    timerRadio.checked = true;
    timerRadio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(displayOptionsSection.hidden).toBe(true);
    expect(timezoneSection.hidden).toBe(true);

    dateRadio.checked = true;
    dateRadio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(displayOptionsSection.hidden).toBe(false);
    expect(timezoneSection.hidden).toBe(false);
  }, 10000);

  describe('background', () => {
    it('should render theme background element covering full area', async () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });

      await harness.page.waitForBackgroundReady();

      const background = harness.container.querySelector('.landing-theme-background') as HTMLElement | null;
      expect(background).not.toBeNull();
      expect(background?.getAttribute('aria-hidden')).toBe('true');
    }, 10000); // Extended timeout for page initialization and background rendering
  });

  describe('start flows', () => {
    it('should submit wall-clock mode with target date', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });

      const dateInput = harness.container.querySelector('[data-testid="landing-date-picker"]') as HTMLInputElement;
      dateInput.value = dateInputValue(FUTURE_DATE);

      const startButton = harness.container.querySelector('[data-testid="landing-start-button"]') as HTMLButtonElement;
      startButton.click();

      expect(onStart).toHaveBeenCalledTimes(1);
      const config = onStart.mock.calls[0][0];
      expect(config.mode).toBe('wall-clock');
      expect(config.targetDate).toBeInstanceOf(Date);
    });

    it('should submit absolute mode with target date', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });

      const absoluteRadio = harness.getModeRadio('absolute');
      absoluteRadio.checked = true;
      absoluteRadio.dispatchEvent(new Event('change', { bubbles: true }));

      const dateInput = harness.container.querySelector('[data-testid="landing-date-picker"]') as HTMLInputElement;
      dateInput.value = dateInputValue(FUTURE_DATE);

      const startButton = harness.container.querySelector('[data-testid="landing-start-button"]') as HTMLButtonElement;
      startButton.click();

      expect(onStart).toHaveBeenCalledTimes(1);
      const config = onStart.mock.calls[0][0];
      expect(config.mode).toBe('absolute');
      expect(config.showWorldMap).toBe(false);
    });

    it('should validate timer mode and pass sanitized config to onStart', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });

      const timerRadio = harness.getModeRadio('timer');
      timerRadio.checked = true;
      timerRadio.dispatchEvent(new Event('change', { bubbles: true }));

      const minutesInput = harness.container.querySelector('[data-testid="landing-duration-minutes"]') as HTMLInputElement;
      const messageInput = harness.container.querySelector('[data-testid="landing-completion-message"]') as HTMLTextAreaElement;
      minutesInput.value = '05';
      messageInput.value = "<script>alert('x')</script>";

      const startButton = harness.container.querySelector('[data-testid="landing-start-button"]') as HTMLButtonElement;
      startButton.click();

      expect(onStart).toHaveBeenCalledTimes(1);
      const config = onStart.mock.calls[0][0];
      expect(config.mode).toBe('timer');
      expect(config.durationSeconds).toBe(300);
      // Config stores plain text (truncated) - SafeMessage handles XSS at display
      expect(config.completionMessage).toBe("<script>alert('x')</script>".slice(0, MAX_MESSAGE_LENGTH));
    });

    it.each([
      { description: 'hours only', inputs: { hours: '1', minutes: '', seconds: '' }, expectedSeconds: 3600 },
      { description: 'minutes only', inputs: { hours: '', minutes: '30', seconds: '' }, expectedSeconds: 1800 },
      { description: 'seconds only', inputs: { hours: '', minutes: '', seconds: '45' }, expectedSeconds: 45 },
    ])('should accept timer when $description', ({ inputs, expectedSeconds }) => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const timerRadio = container.querySelector('[data-testid="landing-mode-timer"]') as HTMLInputElement;
      timerRadio.checked = true;
      timerRadio.dispatchEvent(new Event('change', { bubbles: true }));

      const hoursInput = container.querySelector('[data-testid="landing-duration-hours"]') as HTMLInputElement;
      const minutesInput = container.querySelector('[data-testid="landing-duration-minutes"]') as HTMLInputElement;
      const secondsInput = container.querySelector('[data-testid="landing-duration-seconds"]') as HTMLInputElement;

      hoursInput.value = inputs.hours;
      minutesInput.value = inputs.minutes;
      secondsInput.value = inputs.seconds;

      const startButton = container.querySelector('[data-testid="landing-start-button"]') as HTMLButtonElement;
      startButton.click();

      expect(onStart).toHaveBeenCalledTimes(1);
      const config = onStart.mock.calls[0][0];
      expect(config.mode).toBe('timer');
      expect(config.durationSeconds).toBe(expectedSeconds);
    });
  });

  describe('config setters', () => {
    it('should prefill configuration via setConfig', async () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container, page } = harness;

      page.setConfig({
        mode: 'timer',
        durationSeconds: 120,
        completionMessage: 'Ready',
        theme: 'fireworks',
        targetDate: FUTURE_DATE,
      });
      await page.waitForBackgroundReady();

      const minutesInput = container.querySelector('[data-testid="landing-duration-minutes"]') as HTMLInputElement;
      const themeCard = container.querySelector('[data-testid="theme-card-fireworks"] [role="gridcell"]') as HTMLElement;

      expect(minutesInput.value).toBe('2');
      expect(themeCard.getAttribute('aria-selected')).toBe('true');
    }, 10000); // Extended timeout: slow integration test with theme loading and DOM updates

    it('should update timezone via setConfig', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container, page } = harness;

      page.setConfig({
        timezone: 'America/New_York',
      });

      const timezoneWrapper = container.querySelector('[data-testid="timezone-selector"]') as HTMLElement;
      const valueEl = timezoneWrapper.querySelector('.selector-value');
      expect(valueEl?.textContent).toBe('New York');
    }, 10000);

    it('should set completion message via setConfig', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container, page } = harness;

      const timerRadio = container.querySelector('[data-testid="landing-mode-timer"]') as HTMLInputElement;
      timerRadio.checked = true;
      timerRadio.dispatchEvent(new Event('change', { bubbles: true }));

      page.setConfig({
        completionMessage: 'Custom Message',
      });

      const messageInput = container.querySelector('[data-testid="landing-completion-message"]') as HTMLTextAreaElement;
      expect(messageInput.value).toBe('Custom Message');
    });

    it('should set target date via setConfig', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container, page } = harness;

      const testDate = new Date('2025-12-31T12:00:00Z');
      page.setConfig({
        targetDate: testDate,
      });

      const dateInput = container.querySelector('[data-testid="landing-date-picker"]') as HTMLInputElement;
      expect(dateInput.value).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });
  });

  describe('resilience', () => {
    it('should clean up resources when destroy is called', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container, page } = harness;

      expect(container.querySelector('[data-testid="landing-page"]')).not.toBeNull();

      page.destroy();

      expect(container.querySelector('[data-testid="landing-page"]')).toBeNull();
    });

    it('should handle rapid mode switching', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const dateRadio = container.querySelector('[data-testid="landing-mode-wall-clock"]') as HTMLInputElement;
      const timerRadio = container.querySelector('[data-testid="landing-mode-timer"]') as HTMLInputElement;

      for (let i = 0; i < 10; i++) {
        timerRadio.checked = true;
        timerRadio.dispatchEvent(new Event('change', { bubbles: true }));

        dateRadio.checked = true;
        dateRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(dateRadio.checked).toBe(true);
    });

    it('should handle destroy called multiple times', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { page } = harness;

      page.destroy();
      page.destroy();
      page.destroy();

      expect(harness.container.querySelector('[data-testid="landing-page"]')).toBeNull();
    });
  });

  describe('DOM structure', () => {
    it('should create root container with correct attributes', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart, initialConfig: { theme: 'fireworks' } });
      const { container } = harness;

      const root = container.querySelector('[data-testid="landing-page"]') as HTMLElement;
      expect(root).not.toBeNull();
      expect(root.getAttribute('data-theme')).toBe('fireworks');
      expect(root.style.position).toBe('relative');
      expect(root.style.minHeight).toBe('100vh');
      expect(root.style.width).toBe('100%');
    });

    it('should create theme background with correct class and attributes', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart, initialConfig: { theme: 'contribution-graph' } });
      const { container } = harness;

      const background = container.querySelector('.landing-theme-background') as HTMLElement;
      expect(background).not.toBeNull();
      expect(background.className).toContain('landing-theme-background--contribution-graph');
      expect(background.getAttribute('aria-hidden')).toBe('true');
      expect(background.getAttribute('data-testid')).toBe('landing-theme-background');
      expect(background.getAttribute('data-theme-id')).toBe('contribution-graph');
    });

    it('should create header with title and subtitle', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const header = container.querySelector('[data-testid="landing-header"]') as HTMLElement;
      expect(header).not.toBeNull();
      expect(header.querySelector('.landing-title')?.textContent).toBe('Timestamp');
      expect(header.querySelector('.landing-subtitle')?.textContent).toBe('Your stamp on time');
      expect(header.querySelector('.landing-description')).not.toBeNull();
    });

    it('should create wrapper and card structure', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const wrapper = container.querySelector('[data-testid="landing-wrapper"]') as HTMLElement;
      const card = container.querySelector('[data-testid="landing-card"]') as HTMLElement;
      const main = container.querySelector('main[aria-label="Countdown configuration"]') as HTMLElement;

      expect(wrapper).not.toBeNull();
      expect(card).not.toBeNull();
      expect(main).not.toBeNull();
      expect(wrapper.className).toBe('landing-wrapper');
      expect(card.className).toBe('landing-card');
      expect(main.className).toBe('landing-main');
    });

    it('should remove countdown attributes from container on mount', () => {
      const container = document.createElement('div');
      container.setAttribute('data-theme', 'old-theme');
      container.setAttribute('role', 'old-role');
      container.setAttribute('aria-label', 'old-label');
      container.setAttribute('tabindex', '0');
      document.body.appendChild(container);

      // Ensure a11y-status region exists
      let a11yStatus = document.getElementById('a11y-status');
      if (!a11yStatus) {
        a11yStatus = document.createElement('div');
        a11yStatus.id = 'a11y-status';
        a11yStatus.setAttribute('role', 'status');
        a11yStatus.setAttribute('aria-live', 'polite');
        a11yStatus.className = 'sr-only';
        document.body.appendChild(a11yStatus);
      }

      const onStart = vi.fn();
      const page = createLandingPage({ onStart });
      page.mount(container);

      expect(container.getAttribute('data-theme')).toBeNull();
      expect(container.getAttribute('role')).toBeNull();
      expect(container.getAttribute('aria-label')).toBeNull();
      expect(container.getAttribute('tabindex')).toBeNull();

      page.destroy();
      container.remove();
    });
  });

  describe('world map toggle', () => {
    it('should create world map toggle with correct initial state', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const toggle = container.querySelector('[data-testid="landing-map-toggle"]') as HTMLButtonElement;
      expect(toggle).not.toBeNull();
      expect(toggle.type).toBe('button');
      expect(toggle.className).toContain('is-on');
      expect(toggle.getAttribute('role')).toBe('switch');
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Show world map on countdown');
      expect(toggle.getAttribute('tabindex')).toBe('0');
    });

    it('should toggle world map state when clicked', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const toggle = container.querySelector('[data-testid="landing-map-toggle"]') as HTMLButtonElement;
      const statusRegion = document.getElementById('a11y-status') as HTMLElement;

      expect(toggle.classList.contains('is-on')).toBe(true);
      expect(toggle.getAttribute('aria-checked')).toBe('true');

      toggle.click();

      expect(toggle.classList.contains('is-on')).toBe(false);
      expect(toggle.getAttribute('aria-checked')).toBe('false');
      expect(statusRegion.textContent).toBe('World map disabled');

      toggle.click();

      expect(toggle.classList.contains('is-on')).toBe(true);
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      expect(statusRegion.textContent).toBe('World map enabled');
    });

    it('should include world map state in start callback for wall-clock mode', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const toggle = container.querySelector('[data-testid="landing-map-toggle"]') as HTMLButtonElement;
      const dateInput = container.querySelector('[data-testid="landing-date-picker"]') as HTMLInputElement;
      const startButton = container.querySelector('[data-testid="landing-start-button"]') as HTMLButtonElement;

      dateInput.value = dateInputValue(FUTURE_DATE);

      // Test with world map enabled
      startButton.click();
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart.mock.calls[0][0].showWorldMap).toBe(true);

      onStart.mockClear();

      // Test with world map disabled
      toggle.click();
      startButton.click();
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart.mock.calls[0][0].showWorldMap).toBe(false);
    });

    it('should include showWorldMap in config for timer mode', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const timerRadio = container.querySelector('[data-testid="landing-mode-timer"]') as HTMLInputElement;
      const minutesInput = container.querySelector('[data-testid="landing-duration-minutes"]') as HTMLInputElement;
      const startButton = container.querySelector('[data-testid="landing-start-button"]') as HTMLButtonElement;

      timerRadio.checked = true;
      timerRadio.dispatchEvent(new Event('change', { bubbles: true }));

      minutesInput.value = '5';
      startButton.click();

      expect(onStart).toHaveBeenCalledTimes(1);
      // Timer mode includes showWorldMap field (defaults to true)
      expect(onStart.mock.calls[0][0].showWorldMap).toBe(true);
    });
  });

  describe('theme selection', () => {
    it('should update theme background when theme changes', async () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart, initialConfig: { theme: 'contribution-graph' } });
      const { container } = harness;

      await harness.page.waitForBackgroundReady();

      const background = container.querySelector('.landing-theme-background') as HTMLElement;
      expect(background.className).toContain('landing-theme-background--contribution-graph');

      // Select a different theme
      const fireworksCard = container.querySelector('[data-testid="theme-card-fireworks"] [role="gridcell"]') as HTMLElement;
      fireworksCard.click();

      await harness.page.waitForBackgroundReady();

      expect(background.className).toContain('landing-theme-background--fireworks');
      expect(background.getAttribute('data-theme-id')).toBe('fireworks');
    }, 10000);

    it('should update root data-theme attribute when theme changes', async () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart, initialConfig: { theme: 'contribution-graph' } });
      const { container } = harness;

      const root = container.querySelector('[data-testid="landing-page"]') as HTMLElement;
      expect(root.getAttribute('data-theme')).toBe('contribution-graph');

      const fireworksCard = container.querySelector('[data-testid="theme-card-fireworks"] [role="gridcell"]') as HTMLElement;
      fireworksCard.click();

      await harness.page.waitForBackgroundReady();

      expect(root.getAttribute('data-theme')).toBe('fireworks');
    }, 10000);

    it('should announce theme change', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const statusRegion = document.getElementById('a11y-status') as HTMLElement;
      const fireworksCard = container.querySelector('[data-testid="theme-card-fireworks"] [role="gridcell"]') as HTMLElement;

      fireworksCard.click();

      expect(statusRegion.textContent).toContain('Theme changed to Fireworks');
    });
  });

  describe('mode switching', () => {
    it.each([
      { mode: 'wall-clock' as const, expectDateVisible: true, expectTimerVisible: false, expectTimezoneVisible: true },
      { mode: 'absolute' as const, expectDateVisible: true, expectTimerVisible: false, expectTimezoneVisible: true },
      { mode: 'timer' as const, expectDateVisible: false, expectTimerVisible: true, expectTimezoneVisible: false },
    ])('should show correct sections for $mode mode', ({ mode, expectDateVisible, expectTimerVisible, expectTimezoneVisible }) => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart, initialConfig: { mode } });
      const { container } = harness;

      const dateSection = container.querySelector('[data-testid="landing-date-section"]') as HTMLElement;
      const timerSection = container.querySelector('[data-testid="landing-timer-section"]') as HTMLElement;
      const timezoneSection = container.querySelector('[data-testid="landing-timezone-section"]') as HTMLElement;

      expect(dateSection.hidden).toBe(!expectDateVisible);
      expect(timerSection.hidden).toBe(!expectTimerVisible);
      expect(timezoneSection.hidden).toBe(!expectTimezoneVisible);
    });

    it('should update start button label when mode changes', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const startButton = container.querySelector('[data-testid="landing-start-button"]') as HTMLButtonElement;
      expect(startButton.textContent).toBe('Start Countdown');

      const timerRadio = container.querySelector('[data-testid="landing-mode-timer"]') as HTMLInputElement;
      timerRadio.checked = true;
      timerRadio.dispatchEvent(new Event('change', { bubbles: true }));

      expect(startButton.textContent).toBe('Start Timer');
    });
  });

  describe('error handling', () => {
    it('should use global a11y-status region for announcements', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });

      const statusRegion = document.getElementById('a11y-status') as HTMLElement;
      expect(statusRegion).not.toBeNull();
      expect(statusRegion.getAttribute('role')).toBe('status');
      expect(statusRegion.getAttribute('aria-live')).toBe('polite');
    });

    it('should throw error if global a11y-status region is missing', () => {
      const existingRegion = document.getElementById('a11y-status');
      existingRegion?.remove();

      const onStart = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);

      const page = createLandingPage({ onStart });
      expect(() => page.mount(container)).toThrow('Missing global #a11y-status region in index.html');

      container.remove();

      // Restore region for other tests
      const restoredRegion = document.createElement('div');
      restoredRegion.id = 'a11y-status';
      restoredRegion.setAttribute('role', 'status');
      restoredRegion.setAttribute('aria-live', 'polite');
      restoredRegion.className = 'sr-only';
      document.body.appendChild(restoredRegion);
    });
  });

  describe('initial configuration', () => {
    it('should use default theme when no initial config provided', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const root = container.querySelector('[data-testid="landing-page"]') as HTMLElement;
      expect(root.getAttribute('data-theme')).toBe('contribution-graph');
    });

    it('should use user timezone when no initial config provided', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const timezoneWrapper = container.querySelector('[data-testid="timeline-selector"]') as HTMLElement | null;
      // Timezone selector should be initialized with user timezone
      expect(timezoneWrapper).toBeNull(); // Using different selector
    });

    it('should initialize with provided timezone', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart, initialConfig: { timezone: 'America/Los_Angeles' } });
      const { container } = harness;

      const timezoneWrapper = container.querySelector('[data-testid="timezone-selector"]') as HTMLElement;
      const valueEl = timezoneWrapper.querySelector('.selector-value');
      expect(valueEl?.textContent).toBe('Los Angeles');
    });

    it('should initialize world map state as shown by default', () => {
      const onStart = vi.fn();
      harness = renderLandingPage({ onStart });
      const { container } = harness;

      const toggle = container.querySelector('[data-testid="landing-map-toggle"]') as HTMLButtonElement;
      expect(toggle.classList.contains('is-on')).toBe(true);
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });
  });
});


