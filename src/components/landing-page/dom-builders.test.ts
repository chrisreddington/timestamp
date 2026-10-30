/**
 * Landing Page DOM Builders Tests
 * Tests DOM building functions extracted from landing-page.ts
 */
import { describe, it, expect } from 'vitest';
import {
  buildModeSelector,
  buildDateSection,
  buildTimerSection,
  buildCompletionMessageSection,
  buildFooter,
  DATE_MODE_DEFAULT_MESSAGE,
  NEW_YEAR_MESSAGE,
  CORE_DEPENDENCIES,
} from './dom-builders';

describe('Landing Page DOM Builders', () => {
  describe('buildModeSelector', () => {
    it('should create mode selector fieldset with date and timer options', () => {
      const fieldset = buildModeSelector();

      expect(fieldset.tagName).toBe('FIELDSET');
      expect(fieldset.className).toBe('landing-mode-fieldset');
      expect(fieldset.getAttribute('data-testid')).toBe('landing-mode-selector');

      const legend = fieldset.querySelector('legend');
      expect(legend?.textContent).toBe('Mode');

      const dateOption = fieldset.querySelector('[data-testid="landing-mode-wall-clock"]');
      const timerOption = fieldset.querySelector('[data-testid="landing-mode-timer"]');

      expect(dateOption).toBeTruthy();
      expect(timerOption).toBeTruthy();
    });

    it('should return radio input references', () => {
      const fieldset = buildModeSelector();

      const dateInput = fieldset.querySelector('#mode-wall-clock') as HTMLInputElement;
      const timerInput = fieldset.querySelector('#mode-timer') as HTMLInputElement;

      expect(dateInput).toBeTruthy();
      expect(dateInput.type).toBe('radio');
      expect(dateInput.value).toBe('wall-clock');

      expect(timerInput).toBeTruthy();
      expect(timerInput.type).toBe('radio');
      expect(timerInput.value).toBe('timer');
    });
  });

  describe('buildDateSection', () => {
    it('should create date section with datetime-local input', () => {
      const section = buildDateSection();

      expect(section.tagName).toBe('SECTION');
      expect(section.className).toBe('landing-form-section');
      expect(section.getAttribute('data-testid')).toBe('landing-date-section');

      const input = section.querySelector('#landing-date-picker') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.type).toBe('datetime-local');
      expect(input.required).toBe(true);

      const errorEl = section.querySelector('#landing-date-error');
      expect(errorEl).toBeTruthy();
      expect(errorEl?.getAttribute('role')).toBe('alert');
    });

    it('should NOT include embedded completion message section', () => {
      const section = buildDateSection();

      // Verify old embedded message input is removed
      const messageInput = section.querySelector('#landing-completion-message');
      expect(messageInput).toBeNull();
    });
  });

  describe('message constants', () => {
    it('should export DATE_MODE_DEFAULT_MESSAGE as Hooray!', () => {
      expect(DATE_MODE_DEFAULT_MESSAGE).toBe('Hooray!');
    });

    it('should export NEW_YEAR_MESSAGE as Happy New Year!', () => {
      expect(NEW_YEAR_MESSAGE).toBe('Happy New Year!');
    });
  });

  describe('buildTimerSection', () => {
    it('should create timer section with duration inputs', () => {
      const section = buildTimerSection();

      expect(section.tagName).toBe('SECTION');
      expect(section.className).toBe('landing-form-section');
      expect(section.getAttribute('data-testid')).toBe('landing-timer-section');

      const hoursInput = section.querySelector(
        '[data-testid="landing-duration-hours"]'
      ) as HTMLInputElement;
      const minutesInput = section.querySelector(
        '[data-testid="landing-duration-minutes"]'
      ) as HTMLInputElement;
      const secondsInput = section.querySelector(
        '[data-testid="landing-duration-seconds"]'
      ) as HTMLInputElement;

      expect(hoursInput).toBeTruthy();
      expect(hoursInput.type).toBe('number');
      expect(hoursInput.hasAttribute('max')).toBe(false);

      expect(minutesInput).toBeTruthy();
      expect(minutesInput.type).toBe('number');
      expect(minutesInput.hasAttribute('max')).toBe(false);

      expect(secondsInput).toBeTruthy();
      expect(secondsInput.type).toBe('number');
      expect(secondsInput.hasAttribute('max')).toBe(false);
    });

    it('should NOT include embedded completion message section', () => {
      const section = buildTimerSection();

      // Verify old embedded message input is removed
      const messageInput = section.querySelector('#landing-completion-message');
      expect(messageInput).toBeNull();
    });

    it('should create duration error element', () => {
      const section = buildTimerSection();

      const errorEl = section.querySelector('#landing-duration-error');
      expect(errorEl).toBeTruthy();
      expect(errorEl?.getAttribute('role')).toBe('alert');
    });

    it('should have duration preview with aria-hidden when empty', () => {
      const section = buildTimerSection();

      const preview = section.querySelector('#landing-duration-preview');
      expect(preview).toBeTruthy();
      expect(preview?.getAttribute('aria-hidden')).toBe('true');
      expect(preview?.getAttribute('role')).toBe('status');
      expect(preview?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('buildFooter', () => {
    it('should create footer with attribution and links', () => {
      const footer = buildFooter();

      expect(footer.tagName).toBe('FOOTER');
      expect(footer.className).toBe('landing-footer');
      expect(footer.getAttribute('data-testid')).toBe('landing-footer');

      const githubLink = footer.querySelector('.landing-footer-star-link');
      expect(githubLink).toBeTruthy();
      expect(githubLink?.textContent).toContain('Star on GitHub');

      const themeLink = footer.querySelector('.landing-footer-theme-link');
      expect(themeLink).toBeTruthy();
      expect(themeLink?.textContent).toContain('Contribute a Theme');
    });

    it('should include technology credits from CORE_DEPENDENCIES', () => {
      const footer = buildFooter();

      const techList = footer.querySelector('.landing-footer-tech-list');
      expect(techList).toBeTruthy();
      expect(techList?.textContent).toContain('TypeScript');
      expect(techList?.textContent).toContain('Vite');
      expect(techList?.textContent).toContain('Octicons');
      expect(techList?.textContent).toContain('SunCalc');
      expect(techList?.textContent).toContain('Natural Earth');
    });

    it('should link to the bundled third-party license notices', () => {
      const footer = buildFooter();

      const licensesLink = footer.querySelector<HTMLAnchorElement>('[data-testid="landing-footer-licenses-link"]');
      expect(licensesLink?.getAttribute('href')).toBe('third-party-licenses.txt');
      expect(licensesLink?.textContent).toContain('Third-party licenses');
    });

    it('should NOT include theme-specific dependencies (Fireworks.js)', () => {
      const footer = buildFooter();

      const techList = footer.querySelector('.landing-footer-tech-list');
      expect(techList).toBeTruthy();
      expect(techList?.textContent).not.toContain('Fireworks.js');
    });

    it('should have reasonable number of footer links (max 8)', () => {
      const footer = buildFooter();

      const techList = footer.querySelector('.landing-footer-tech-list');
      const links = techList?.querySelectorAll('a');
      expect(links?.length).toBeLessThanOrEqual(8);
      expect(links?.length).toBe(CORE_DEPENDENCIES.length);
    });
  });

  describe('buildCompletionMessageSection', () => {
    it('should create completion message section with proper structure', () => {
      const section = buildCompletionMessageSection();

      expect(section.tagName).toBe('SECTION');
      expect(section.className).toContain('landing-form-section');
      expect(section.className).toContain('landing-message-section');
      expect(section.getAttribute('data-testid')).toBe('landing-message-section');

      const input = section.querySelector('#landing-completion-message') as HTMLTextAreaElement;
      expect(input).toBeTruthy();
      expect(input.tagName).toBe('TEXTAREA');
      expect(input.getAttribute('maxlength')).toBe('200');
      expect(input.getAttribute('data-testid')).toBe('landing-completion-message');
    });

    it('should have accessible label', () => {
      const section = buildCompletionMessageSection();

      const label = section.querySelector('#landing-message-label');
      expect(label).toBeTruthy();
      expect(label?.textContent).toBe('Completion Message');
    });

    it('should not have redundant hint text', () => {
      const section = buildCompletionMessageSection();

      const hint = section.querySelector('.landing-field-hint');
      expect(hint).toBeNull();
    });

    it('should have proper ARIA attributes', () => {
      const section = buildCompletionMessageSection();

      const input = section.querySelector('#landing-completion-message') as HTMLTextAreaElement;
      expect(input.getAttribute('aria-labelledby')).toBe('landing-message-label');
    });

    it('should have placeholder text', () => {
      const section = buildCompletionMessageSection();

      const input = section.querySelector('#landing-completion-message') as HTMLTextAreaElement;
      expect(input.placeholder).toBe('Leave blank for default message');
    });
  });
});
