import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELEBRATION_POLL_INTERVAL_MS } from './constants';
import type { WorldMapController } from './index';
import { createWorldMap } from './index';
import {
    NEW_YEAR_WALL_CLOCK,
    TEST_WALL_CLOCK_TARGET,
    renderWorldMap,
    type WorldMapHarness,
} from './test-helpers';

describe('World Map', () => {
  let harness: WorldMapHarness | null = null;
  let container: HTMLElement;
  let controller: WorldMapController | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    controller?.destroy();
    controller = null;
    container.remove();
    harness?.cleanup();
    harness = null;
    vi.useRealTimers();
  });

  describe('required wallClockTarget', () => {
    it('should throw an error when wallClockTarget is not provided', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      expect(() => {
        const invalidOptions = { initialTimezone: 'UTC' } as unknown as Parameters<typeof createWorldMap>[1];
        createWorldMap(container, invalidOptions);
      }).toThrow('createWorldMap requires a wallClockTarget option');
      container.remove();
    });
  });

  describe('City Marker Tab Order', () => {
    it('should render city markers in longitude order when initial timezone is UTC', () => {
      harness = renderWorldMap({ initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const markers = Array.from(harness.getMarkers());
      const cityIds = markers.map((marker) =>
        (marker.getAttribute('data-testid') ?? '').replace('city-marker-', '')
      );

      const expectedOrder = [
        'la',
        'chicago',
        'nyc',
        'utc',
        'london',
        'paris',
        'dubai',
        'shanghai',
        'tokyo',
        'sydney',
        'auckland',
      ];

      expect(cityIds).toEqual(expectedOrder);
    });

    it('should set tabindex zero on all city markers when initial timezone is UTC', () => {
      harness = renderWorldMap({ initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const markers = Array.from(harness.getMarkers());
      markers.forEach((marker) => {
        expect(marker.getAttribute('tabindex')).toBe('0');
      });
    });
  });

  describe('setTimezone', () => {
    it('should update selected marker when setTimezone is called', () => {
      harness = renderWorldMap({ initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      // Initially UTC should be selected
      const utcMarker = harness.container.querySelector('[data-testid="city-marker-utc"]');
      expect(utcMarker?.getAttribute('data-selected')).toBe('true');

      // Change to Tokyo
      harness.controller.setTimezone('Asia/Tokyo');

      // UTC should no longer be selected
      expect(utcMarker?.getAttribute('data-selected')).toBe('false');

      // Tokyo should be selected
      const tokyoMarker = harness.container.querySelector('[data-testid="city-marker-tokyo"]');
      expect(tokyoMarker?.getAttribute('data-selected')).toBe('true');
    });

    it('should deselect all markers when setTimezone is called with non-featured timezone', () => {
      harness = renderWorldMap({ initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });
      harness.controller.setTimezone('Africa/Cairo');

      const markers = harness.getMarkers();
      markers.forEach((marker) => {
        expect(marker.getAttribute('data-selected')).toBe('false');
      });
    });
  });

  describe('updateTerminator', () => {
    it('should update night overlay path when updateTerminator is called', () => {
      const mockTime = new Date('2024-06-21T12:00:00Z'); // Summer solstice noon UTC
      harness = renderWorldMap({
        initialTimezone: 'UTC',
        wallClockTarget: TEST_WALL_CLOCK_TARGET,
        getCurrentTime: () => mockTime,
      });

      const nightOverlay = harness.getNightOverlay();
      harness.controller.updateTerminator();

      expect(nightOverlay?.getAttribute('d')).toBeTruthy();
    });
  });

  describe('updateCelebrationStates', () => {
    it('sets celebrating state on the selected city marker at midnight', () => {
      // Set up a time when UTC has reached midnight
      // At 00:00 UTC on Jan 1, both UTC and London (Europe/London which is UTC+0 in winter) 
      // should be celebrating
      const mockTime = new Date('2025-01-01T00:00:00Z');
      
      // Select London as the initial timezone
      harness = renderWorldMap({
        initialTimezone: 'Europe/London',
        wallClockTarget: NEW_YEAR_WALL_CLOCK,
        getCurrentTime: () => mockTime,
      });

      harness.controller.updateCelebrationStates();

      // London marker should be both selected AND celebrating
      const londonMarker = harness.container.querySelector('[data-testid="city-marker-london"]');
      expect(londonMarker?.getAttribute('data-selected')).toBe('true');
      expect(londonMarker?.getAttribute('data-celebrating')).toBe('true');
      
      // UTC marker should also be celebrating
      const utcMarker = harness.container.querySelector('[data-testid="city-marker-utc"]');
      expect(utcMarker?.getAttribute('data-celebrating')).toBe('true');
    });

    it('should clear announcer after delay', () => {
      const mockTime = new Date('2024-12-31T11:00:00Z');
      controller = createWorldMap(container, {
        initialTimezone: 'UTC',
        wallClockTarget: NEW_YEAR_WALL_CLOCK,
        getCurrentTime: () => mockTime,
      });

      controller.updateCelebrationStates();

      const announcer = container.querySelector('[data-testid="celebration-announcer"]');

      // Advance timers to clear announcement
      vi.advanceTimersByTime(6000);

      expect(announcer?.textContent).toBe('');
    });
  });

  describe('setThemeStyles', () => {
    it('should apply CSS custom properties when setThemeStyles is called', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const themeStyles = {
        '--theme-map-continent': '#ff0000',
        '--theme-map-marker': '#00ff00',
      };

      controller.setThemeStyles(themeStyles);

      const wrapper = container.querySelector('.world-map-wrapper') as HTMLElement;
      expect(wrapper.style.getPropertyValue('--theme-map-continent')).toBe('#ff0000');
      expect(wrapper.style.getPropertyValue('--theme-map-marker')).toBe('#00ff00');
    });
  });

  describe('themeStyles option', () => {
    it('should apply initial theme styles when provided in options', () => {
      const themeStyles = {
        '--theme-map-continent': '#123456',
      };

      controller = createWorldMap(container, {
        initialTimezone: 'UTC',
        wallClockTarget: TEST_WALL_CLOCK_TARGET,
        themeStyles,
      });

      const wrapper = container.querySelector('.world-map-wrapper') as HTMLElement;
      expect(wrapper.style.getPropertyValue('--theme-map-continent')).toBe('#123456');
    });
  });

  describe('onCitySelect callback', () => {
    it('should call onCitySelect when a city marker is clicked', () => {
      const onCitySelect = vi.fn();
      controller = createWorldMap(container, {
        initialTimezone: 'UTC',
        wallClockTarget: TEST_WALL_CLOCK_TARGET,
        onCitySelect,
      });

      const tokyoMarker = container.querySelector('[data-testid="city-marker-tokyo"]') as HTMLElement;
      tokyoMarker.click();

      expect(onCitySelect).toHaveBeenCalledTimes(1);
      expect(onCitySelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tokyo',
          name: 'Tokyo',
          timezone: 'Asia/Tokyo',
        })
      );
    });

    it('should not throw when onCitySelect is not provided', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const tokyoMarker = container.querySelector('[data-testid="city-marker-tokyo"]') as HTMLElement;
      expect(() => tokyoMarker.click()).not.toThrow();
    });
  });

  describe('periodic updates', () => {
    it('should schedule terminator and celebration updates on interval', () => {
      const updateInterval = 1000;
      controller = createWorldMap(container, {
        initialTimezone: 'UTC',
        wallClockTarget: TEST_WALL_CLOCK_TARGET,
        updateInterval,
      });

      const nightOverlay = container.querySelector('[data-testid="night-overlay"]');

      // Advance just past one interval cycle
      vi.advanceTimersByTime(updateInterval + 100);

      // Path should exist (initial render + one update)
      expect(nightOverlay).toBeTruthy();
      expect(nightOverlay?.getAttribute('d')).toBeTruthy();
    });
  });

  describe('destroy', () => {
    it('should clear update interval when destroyed', () => {
      controller = createWorldMap(container, {
        initialTimezone: 'UTC',
        wallClockTarget: TEST_WALL_CLOCK_TARGET,
        updateInterval: 1000,
      });

      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      controller.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should remove wrapper element from DOM when destroyed', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      expect(container.querySelector('.world-map-wrapper')).toBeTruthy();

      controller.destroy();
      controller = null; // Prevent double cleanup in afterEach

      expect(container.querySelector('.world-map-wrapper')).toBeNull();
    });
  });

  describe('user timezone marking', () => {
    it('should mark user timezone city with data-user attribute', () => {
      // This test verifies the user timezone detection feature
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const userMarkers = Array.from(container.querySelectorAll('.city-marker')).filter(
        (marker) => marker.getAttribute('data-user') === 'true'
      );

      expect(userMarkers).toHaveLength(1);
      const [userMarker] = userMarkers;
      expect(userMarker.getAttribute('aria-label')).toContain(userMarker.getAttribute('data-timezone') ?? '');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes on wrapper', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const wrapper = container.querySelector('.world-map-wrapper');
      expect(wrapper?.getAttribute('role')).toBe('group');
      expect(wrapper?.getAttribute('aria-label')).toContain('World map');
    });

    it('should use generic countdown celebration label (not hardcoded New Year)', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const wrapper = container.querySelector('.world-map-wrapper');
      const ariaLabel = wrapper?.getAttribute('aria-label') ?? '';
      
      // Should use generic "countdown" terminology, not "New Year"
      expect(ariaLabel).toContain('countdown celebration status');
      expect(ariaLabel).not.toContain('New Year');
    });

    it('should have aria-hidden on the SVG element', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const svg = container.querySelector('[data-testid="world-map-svg"]');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });

    it('should have aria-label on city markers', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const tokyoMarker = container.querySelector('[data-testid="city-marker-tokyo"]');
      expect(tokyoMarker?.getAttribute('aria-label')).toBe('Tokyo - Asia/Tokyo');
    });

    it('should have live region for announcements', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const announcer = container.querySelector('[data-testid="celebration-announcer"]');
      expect(announcer?.getAttribute('aria-live')).toBe('polite');
      expect(announcer?.getAttribute('aria-atomic')).toBe('true');
    });
  });

  describe('Visibility and Resize Edge Cases', () => {
    it('should remain stable across visibility toggles and destruction', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      const setVisibility = (hidden: boolean) => {
        Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      };

      setVisibility(true);
      setVisibility(false);
      setVisibility(true);

      expect(controller).toBeDefined();

      controller.destroy();
      controller = null;

      expect(container.querySelector('.world-map-wrapper')).toBeNull();
    });

    it('should tolerate extreme and rapid resize events', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      Object.defineProperty(container, 'clientWidth', { value: 10, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 10, configurable: true });
      window.dispatchEvent(new Event('resize'));

      Object.defineProperty(container, 'clientWidth', { value: 10000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 10000, configurable: true });
      window.dispatchEvent(new Event('resize'));

      for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new Event('resize'));
      }

      expect(controller).toBeDefined();
    });
  });

  describe('Visibility observer and pause logic', () => {
    const createRect = (width: number, height: number): DOMRect =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect;

    const setupWithMocks = async (
      options: {
        attachContainer?: boolean;
        styleOverrides?: Partial<Pick<CSSStyleDeclaration, 'display' | 'visibility'>>;
        rect?: DOMRect;
        useIntersectionObserver?: boolean;
      } = {}
    ) => {
      vi.resetModules();

      const markerManager = {
        setTimezone: vi.fn(),
        updateCelebrationStates: vi.fn<unknown[], string[]>(() => []),
        getMarkerElements: vi.fn(() => [] as HTMLElement[]),
        destroy: vi.fn(),
      };

      const terminatorRenderer = {
        update: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        destroy: vi.fn(),
      };

      const announcer = {
        announceCelebration: vi.fn(),
        destroy: vi.fn(),
      };

      vi.doMock('./marker-manager', () => ({ createMarkerManager: vi.fn(() => markerManager) }));
      vi.doMock('./terminator-renderer', () => ({ createTerminatorRenderer: vi.fn(() => terminatorRenderer) }));
      vi.doMock('./announcer', () => ({ createAnnouncer: vi.fn(() => announcer) }));

      const originalIntersectionObserver = globalThis.IntersectionObserver;
      let observerInstance: { trigger: (entries: IntersectionObserverEntry[]) => void } | null = null;

      if (options.useIntersectionObserver) {
        class FakeIntersectionObserver implements IntersectionObserver {
          readonly root: Element | Document | null = null;
          readonly rootMargin: string = '0px';
          readonly thresholds: ReadonlyArray<number> = [0];
          #callback: IntersectionObserverCallback;

          constructor(callback: IntersectionObserverCallback) {
            this.#callback = callback;
            observerInstance = {
              trigger: (entries: IntersectionObserverEntry[]) => this.#callback(entries, this),
            };
          }

          observe = vi.fn();
          unobserve = vi.fn();
          disconnect = vi.fn();
          takeRecords(): IntersectionObserverEntry[] {
            return [];
          }
        }

        // @ts-expect-error test double
        globalThis.IntersectionObserver = FakeIntersectionObserver;
      } else {
        // Ensure fallback path
        // @ts-expect-error allow undefined for fallback
        globalThis.IntersectionObserver = undefined;
      }

      const styleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockImplementation(() => ({
          display: 'block',
          visibility: 'visible',
          ...(options.styleOverrides ?? {}),
        }) as unknown as CSSStyleDeclaration);

      const rectSpy = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(() => options.rect ?? createRect(100, 100));

      const { createWorldMap: createWorldMapWithMocks } = await import('./index');

      const localContainer = document.createElement('div');
      if (options.attachContainer !== false) {
        document.body.appendChild(localContainer);
      }

      const mapController = createWorldMapWithMocks(localContainer, {
        initialTimezone: 'UTC',
        wallClockTarget: TEST_WALL_CLOCK_TARGET,
      });

      const restore = () => {
        mapController.destroy();
        rectSpy.mockRestore();
        styleSpy.mockRestore();
        vi.doUnmock('./marker-manager');
        vi.doUnmock('./terminator-renderer');
        vi.doUnmock('./announcer');
        vi.resetModules();
        if (options.attachContainer !== false) {
          localContainer.remove();
        }
        globalThis.IntersectionObserver = originalIntersectionObserver;
      };

      return {
        controller: mapController,
        markerManager,
        terminatorRenderer,
        announcer,
        observerInstance,
        restore,
      };
    };

    it.each([
      {
        description: 'when element is disconnected from DOM',
        attachContainer: false,
        styleOverrides: { display: 'block', visibility: 'visible' },
        rect: createRect(100, 100),
      },
      {
        description: 'when display is none',
        styleOverrides: { display: 'none', visibility: 'visible' },
        rect: createRect(100, 100),
      },
      {
        description: 'when visibility is hidden',
        styleOverrides: { display: 'block', visibility: 'hidden' },
        rect: createRect(100, 100),
      },
      {
        description: 'when width or height is zero',
        styleOverrides: { display: 'block', visibility: 'visible' },
        rect: createRect(0, 100),
      },
    ])('should pause updates $description', async ({ attachContainer, styleOverrides, rect }) => {
      const { terminatorRenderer, controller, restore } = await setupWithMocks({
        attachContainer,
        styleOverrides,
        rect,
        useIntersectionObserver: true,
      });

      expect(terminatorRenderer.pause).toHaveBeenCalledTimes(1);
      expect(terminatorRenderer.resume).not.toHaveBeenCalled();

      restore();
    });

    it('should ignore visibility callback when entry is missing', async () => {
      const { terminatorRenderer, observerInstance, restore } = await setupWithMocks({
        useIntersectionObserver: true,
        styleOverrides: { display: 'none' },
      });

      observerInstance?.trigger([]);

      expect(terminatorRenderer.pause).toHaveBeenCalledTimes(1);
      restore();
    });

    it('should use fallback entry when IntersectionObserver is unavailable', async () => {
      const { terminatorRenderer, controller, restore } = await setupWithMocks({
        useIntersectionObserver: false,
        styleOverrides: { display: 'block', visibility: 'visible' },
      });

      controller.setVisible(false);
      expect(terminatorRenderer.pause).toHaveBeenCalledTimes(1);

      controller.setVisible(true);
      expect(terminatorRenderer.resume).toHaveBeenCalledTimes(1);

      restore();
    });

    it('should skip celebration interval ticks while paused', async () => {
      const { controller, markerManager, restore } = await setupWithMocks({
        useIntersectionObserver: true,
      });

      markerManager.updateCelebrationStates.mockClear();

      controller.pause();
      vi.advanceTimersByTime(CELEBRATION_POLL_INTERVAL_MS * 2);
      expect(markerManager.updateCelebrationStates).not.toHaveBeenCalled();

      controller.resume();
      vi.advanceTimersByTime(CELEBRATION_POLL_INTERVAL_MS);
      expect(markerManager.updateCelebrationStates).toHaveBeenCalledTimes(1);

      restore();
    });
  });

  describe('City Selection Edge Cases', () => {
    it('should handle rapid city selections', () => {
      controller = createWorldMap(container, { 
        initialTimezone: 'UTC', 
        wallClockTarget: TEST_WALL_CLOCK_TARGET
      });

      const tokyoMarker = container.querySelector('[data-testid="city-marker-tokyo"]') as HTMLElement;
      const nycMarker = container.querySelector('[data-testid="city-marker-nyc"]') as HTMLElement;
      const londonMarker = container.querySelector('[data-testid="city-marker-london"]') as HTMLElement;

      // Rapidly click different cities - should not crash
      tokyoMarker.click();
      nycMarker.click();
      londonMarker.click();

      // All markers should exist and be clickable
      expect(tokyoMarker).toBeDefined();
      expect(nycMarker).toBeDefined();
      expect(londonMarker).toBeDefined();
    });

    it('should handle setTimezone called multiple times with same timezone', () => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      // Call multiple times with same timezone
      controller.setTimezone('Asia/Tokyo');
      controller.setTimezone('Asia/Tokyo');
      controller.setTimezone('Asia/Tokyo');

      const tokyoMarker = container.querySelector('[data-testid="city-marker-tokyo"]');
      expect(tokyoMarker?.getAttribute('data-selected')).toBe('true');
    });
  });

  describe('Theme Styles Edge Cases', () => {
    it.each([
      {
        description: 'with empty object',
        action: (instance: WorldMapController) => instance.setThemeStyles({}),
      },
      {
        description: 'with multiple sequential updates',
        action: (instance: WorldMapController) => {
          instance.setThemeStyles({ primary: '#ff0000' });
          instance.setThemeStyles({ primary: '#00ff00' });
          instance.setThemeStyles({ primary: '#0000ff' });
        },
      },
      {
        description: 'after destroy is called',
        action: (instance: WorldMapController) => {
          instance.destroy();
          instance.setThemeStyles({ primary: '#ff0000' });
        },
      },
    ])('should not throw when setThemeStyles is invoked $description', ({ action }) => {
      controller = createWorldMap(container, { initialTimezone: 'UTC', wallClockTarget: TEST_WALL_CLOCK_TARGET });

      expect(() => action(controller as WorldMapController)).not.toThrow();
    });
  });

  describe('Celebration Class and Accessibility', () => {
    it('should add .city-celebrated class to markers when city is celebrating', () => {
      const mockTime = new Date('2025-01-01T00:00:00Z');
      harness = renderWorldMap({
        initialTimezone: 'UTC',
        wallClockTarget: NEW_YEAR_WALL_CLOCK,
        getCurrentTime: () => mockTime,
      });

      harness.controller.updateCelebrationStates();

      const utcMarker = harness.container.querySelector('[data-testid="city-marker-utc"]');
      expect(utcMarker?.classList.contains('city-celebrated')).toBe(true);
    });

    it('should remove .city-celebrated class when city is not celebrating', () => {
      // Use far-future target to ensure no celebration
      harness = renderWorldMap({
        initialTimezone: 'UTC',
        wallClockTarget: TEST_WALL_CLOCK_TARGET,
      });

      harness.controller.updateCelebrationStates();
      const utcMarker = harness.container.querySelector('[data-testid="city-marker-utc"]');
      expect(utcMarker?.classList.contains('city-celebrated')).toBe(false);
    });

    it('should update aria-label to include " — celebrated" when city is celebrating', () => {
      const mockTime = new Date('2025-01-01T00:00:00Z');
      harness = renderWorldMap({
        initialTimezone: 'UTC',
        wallClockTarget: NEW_YEAR_WALL_CLOCK,
        getCurrentTime: () => mockTime,
      });

      harness.controller.updateCelebrationStates();

      const utcMarker = harness.container.querySelector('[data-testid="city-marker-utc"]');
      const ariaLabel = utcMarker?.getAttribute('aria-label');
      expect(ariaLabel).toContain('— celebrated');
    });

    it('should have normal aria-label when city is not celebrating', () => {
      // Use far-future target to ensure no celebration
      harness = renderWorldMap({
        initialTimezone: 'UTC',
        wallClockTarget: TEST_WALL_CLOCK_TARGET,
      });

      const utcMarker = harness.container.querySelector('[data-testid="city-marker-utc"]');
      const ariaLabel = utcMarker?.getAttribute('aria-label');
      expect(ariaLabel).not.toContain('celebrated');
      expect(ariaLabel).toContain('UTC');
    });
  });
});

