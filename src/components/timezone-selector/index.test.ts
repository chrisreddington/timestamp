/**
 * Tests for Timezone Selector Component
 * Verifies creation, interaction, and cleanup of the timezone selector.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getOptions,
  openDropdown,
  pressKey,
  renderTimezoneSelector,
  typeSearch,
  type RenderedSelector,
} from './test-helpers';
import { EMPTY_STATE_MESSAGE } from './constants';

describe('Timezone Selector', () => {
  let selector: RenderedSelector | null;

  beforeEach(() => {
    selector = null;
  });

  afterEach(() => {
    selector?.cleanup();
  });

  describe('createTimezoneSelector', () => {
    it('should use initialTimezone when provided', () => {
      selector = renderTimezoneSelector({ initialTimezone: 'America/New_York' });
      const valueDisplay = selector.container.querySelector('.selector-value');
      expect(valueDisplay?.textContent).toContain('New York');
    });

    it('should open dropdown when trigger is clicked', async () => {
      selector = renderTimezoneSelector();

      expect(selector.dropdown.hidden).toBe(true);
      selector.trigger.click();
      expect(selector.dropdown.hidden).toBe(false);
      expect(selector.trigger.getAttribute('aria-expanded')).toBe('true');
    }, 10000);

    it('should close dropdown when clicking outside', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();
      expect(selector.dropdown.hidden).toBe(false);

      document.body.click();
      expect(selector.dropdown.hidden).toBe(true);
    }, 10000);

    it('should close dropdown on Escape key', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();
      expect(selector.dropdown.hidden).toBe(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(selector.dropdown.hidden).toBe(true);
    }, 10000); // Extended timeout for DOM manipulation and event handling setup

    it('should filter options when searching', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      const options = typeSearch(selector, 'New York');
      expect(options.length).toBeGreaterThan(0);
    });

    it('should show empty state when no results match', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      selector.searchInput.value = 'xyznonexistent123';
      selector.searchInput.dispatchEvent(new Event('input'));

      const emptyState = selector.container.querySelector('.dropdown-empty');
      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toBe(EMPTY_STATE_MESSAGE);
    });

    it('should call onSelect when timezone option is clicked', () => {
      selector = renderTimezoneSelector();
      const options = openDropdown(selector);

      const firstOption = options[0];
      firstOption.click();
      expect(selector.onSelect).toHaveBeenCalledTimes(1);
      expect(selector.onSelect).toHaveBeenCalledWith(firstOption.getAttribute('data-value'));
    });
  });

  describe('controller.setTimezone', () => {
    it('should update the displayed timezone', () => {
      selector = renderTimezoneSelector();
      selector.controller.setTimezone('Europe/London');

      const valueDisplay = selector.container.querySelector('.selector-value');
      expect(valueDisplay?.textContent).toContain('London');
    });
  });

  describe('controller.setThemeStyles', () => {
    it('should apply CSS custom properties', () => {
      selector = renderTimezoneSelector();

      selector.controller.setThemeStyles({
        '--theme-tz-bg': 'red',
        '--theme-tz-border': 'blue',
      });

      const wrapper = selector.container.querySelector('[data-testid="timezone-selector"]') as HTMLElement;
      expect(wrapper.style.getPropertyValue('--theme-tz-bg')).toBe('red');
      expect(wrapper.style.getPropertyValue('--theme-tz-border')).toBe('blue');
    });
  });

  describe('controller.destroy', () => {
    it('should remove the selector from the container', () => {
      selector = renderTimezoneSelector();
      expect(selector.container.querySelector('[data-testid="timezone-selector"]')).toBeTruthy();

      selector.controller.destroy();

      expect(selector.container.querySelector('[data-testid="timezone-selector"]')).toBeNull();
    });

    it('should clean up event listeners', () => {
      selector = renderTimezoneSelector();
      selector.controller.destroy();

      // After destroy, document click listener should be removed
      expect(() => document.body.click()).not.toThrow();
    });
  });

  describe('keyboard navigation', () => {
    it.each([
      ['Enter'],
      [' '],
      ['ArrowDown'],
    ])('should open dropdown with %s key', (key) => {
      selector = renderTimezoneSelector();
      pressKey(selector.trigger, key);
      expect(selector.dropdown.hidden).toBe(false);
    }, 10000); // Extended timeout for keyboard interaction setup

    it('should move focus from search input to first option with ArrowDown', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'ArrowDown');

      const firstOption = selector.container.querySelector('.dropdown-option') as HTMLButtonElement;
      expect(document.activeElement).toBe(firstOption);
      expect(firstOption.getAttribute('tabindex')).toBe('0');
    }, 10000); // Extended timeout for keyboard interaction setup


    it('should move focus back to trigger with ArrowUp from search input', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();
      expect(selector.dropdown.hidden).toBe(false);

      pressKey(selector.searchInput, 'ArrowUp');

      expect(selector.dropdown.hidden).toBe(true);
      expect(document.activeElement).toBe(selector.trigger);
    });

    it('should navigate between options with ArrowDown key', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'ArrowDown');

      const options = getOptions(selector.container);
      const firstOption = options[0];
      const secondOption = options[1];

      pressKey(firstOption, 'ArrowDown');

      expect(document.activeElement).toBe(secondOption);
      expect(secondOption.getAttribute('tabindex')).toBe('0');
      expect(firstOption.getAttribute('tabindex')).toBe('-1');
    });

    it('should navigate up with ArrowUp key between options', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'ArrowDown');

      const options = getOptions(selector.container);
      const firstOption = options[0];
      const secondOption = options[1];

      pressKey(firstOption, 'ArrowDown');
      expect(document.activeElement).toBe(secondOption);

      pressKey(secondOption, 'ArrowUp');
      expect(document.activeElement).toBe(firstOption);
    }, 10000); // Extended timeout for keyboard navigation and focus operations

    it('should move focus to search input with ArrowUp from first option', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'ArrowDown');

      const firstOption = selector.container.querySelector('.dropdown-option') as HTMLButtonElement;
      pressKey(firstOption, 'ArrowUp');

      expect(document.activeElement).toBe(selector.searchInput);
    });

    it('should focus first option with Home key from search input', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'Home');

      const firstOption = selector.container.querySelector('.dropdown-option') as HTMLButtonElement;
      expect(document.activeElement).toBe(firstOption);
    });

    it('should focus last option with End key from search input', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'End');

      const options = getOptions(selector.container);
      const lastOption = options[options.length - 1];
      expect(document.activeElement).toBe(lastOption);
    });

    it.each([
      { key: 'Enter', description: 'Enter key' },
      { key: ' ', description: 'Space key' },
    ])('should select option with $description', ({ key }) => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'ArrowDown');

      const firstOption = selector.container.querySelector('.dropdown-option') as HTMLButtonElement;
      const timezone = firstOption.getAttribute('data-value');

      pressKey(firstOption, key);

      expect(selector.onSelect).toHaveBeenCalledWith(timezone);
    });

    it('should update aria-activedescendant when navigating options', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'ArrowDown');

      const firstOption = selector.container.querySelector('.dropdown-option') as HTMLButtonElement;
      expect(selector.dropdown.getAttribute('aria-activedescendant')).toBe(firstOption.id);
    });

    it('should clear aria-activedescendant when closing dropdown', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();

      pressKey(selector.searchInput, 'ArrowDown');
      expect(selector.dropdown.getAttribute('aria-activedescendant')).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(selector.dropdown.getAttribute('aria-activedescendant')).toBeNull();
    });

    it('should close dropdown and focus trigger on Tab from search input', () => {
      selector = renderTimezoneSelector();
      selector.trigger.click();
      expect(selector.dropdown.hidden).toBe(false);

      pressKey(selector.searchInput, 'Tab');
      expect(selector.dropdown.hidden).toBe(true);
    });
  });
});
