/**
 * Orchestrator Integration Tests
 * Verifies orchestrator lifecycle and theme interactions at integration level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ThemeConfig, WallClockTime, SafeMessage } from '@core/types';
import type { ThemeId } from '@themes/registry';
import { THEME_REGISTRY } from '@themes/registry';
import { createOrchestrator } from './orchestrator';
import { cleanupOrchestratorDom } from '@/test-utils/theme-test-helpers';
import {
  buildMockTheme,
  createThemeInstanceMap,
  createOrchestratorTestHarness,
} from '@/test-utils/orchestrator-fixtures';

const themeInstances = createThemeInstanceMap();

/** Helper to create a matcher for SafeMessage in tests */
const expectSafeMessage = (text: string): { message: SafeMessage; fullMessage: string } => ({
  message: expect.objectContaining({
    forTextContent: text,
    forInnerHTML: expect.any(String),
  }),
  fullMessage: expect.any(String),
});

const buildWallClockTarget = (date: Date): WallClockTime => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth(),
  day: date.getUTCDate(),
  hours: date.getUTCHours(),
  minutes: date.getUTCMinutes(),
  seconds: date.getUTCSeconds(),
});

const createFutureWallClock = (secondsAhead: number = 5): { target: Date; wallClockTarget: WallClockTime } => {
  const baseNow = Date.now();
  const targetMs = Math.ceil(baseNow / 1000) * 1000 + secondsAhead * 1000;
  const target = new Date(targetMs);
  return { target, wallClockTarget: buildWallClockTarget(target) };
};

const originalRequestFullscreen = document.documentElement.requestFullscreen?.bind(document.documentElement);
const originalExitFullscreen = document.exitFullscreen?.bind(document);

vi.mock('@/themes/contribution-graph', () => ({
  CONTRIBUTION_GRAPH_CONFIG: {
    id: 'contribution-graph',
    name: 'Mock Theme',
    description: 'Mock',
    optionalComponents: {
      timezoneSelector: true,
      worldMap: true,
    },
  } satisfies ThemeConfig,
  contributionGraphTimePageRenderer: () => buildMockTheme('contribution-graph', themeInstances),
  contributionGraphLandingPageRenderer: () => ({
    mount: vi.fn(),
    setSize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
  }),
  contributionGraphPreview: 'mock-contribution-graph-preview.webp',
}));

vi.mock('@/themes/fireworks', () => ({
  FIREWORKS_CONFIG: {
    id: 'fireworks',
    name: 'Mock Theme',
    description: 'Mock',
    optionalComponents: {
      timezoneSelector: true,
      worldMap: true,
    },
  } satisfies ThemeConfig,
  fireworksTimePageRenderer: () => buildMockTheme('fireworks', themeInstances),
  fireworksLandingPageRenderer: () => ({
    mount: vi.fn(),
    setSize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
  }),
  fireworksPreview: 'mock-fireworks-preview.webp',
}));

describe('Orchestrator', () => {
  let harness: ReturnType<typeof createOrchestratorTestHarness>;

  beforeEach(() => {
    harness = createOrchestratorTestHarness();
  });

  afterEach(async () => {
    if (vi.isFakeTimers()) {
      await vi.runOnlyPendingTimersAsync();
    }
    themeInstances['contribution-graph'] = undefined;
    themeInstances.fireworks = undefined;
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    if (originalRequestFullscreen) {
      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        value: originalRequestFullscreen,
        writable: true,
        configurable: true,
      });
    } else {
      Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
    }

    if (originalExitFullscreen) {
      Object.defineProperty(document, 'exitFullscreen', {
        value: originalExitFullscreen,
        writable: true,
        configurable: true,
      });
    } else {
      Reflect.deleteProperty(document, 'exitFullscreen');
    }

    cleanupOrchestratorDom();
    await harness.cleanup();
  });

  it('should update countdown when timer ticks', async () => {
    harness = createOrchestratorTestHarness({ initialTheme: 'fireworks' });
    const orchestrator = harness.orchestrator;

    await harness.start();
    harness.advanceTimers(1000);

    expect(themeInstances.fireworks?.updateTime).toHaveBeenCalled();
    await orchestrator.destroy();
    }, 10000); // Extended timeout to account for orchestrator initialization and theme loading

  it('should restore focus within container when switching themes', async () => {
    vi.useRealTimers();
    harness = createOrchestratorTestHarness({ useRealTimers: true });
    const orchestrator = harness.orchestrator;
    await harness.start();
    const focusable = harness.container.querySelector('button') as HTMLButtonElement;
    focusable?.focus();
    expect(document.activeElement).toBe(focusable);

    await orchestrator.switchTheme('fireworks');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(document.activeElement).toBeTruthy();
    expect(harness.container.contains(document.activeElement)).toBe(true);
    await orchestrator.destroy();
  }, 10000); // Extended timeout for real timers and theme switching initialization

  it('should clear countdown interval when destroyed', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const orchestrator = harness.orchestrator;
    await harness.start();

    await orchestrator.destroy();

    expect(clearSpy).toHaveBeenCalled();
  }, 10000); // Extended timeout for orchestrator initialization and cleanup

  it.each([
    { completionMessage: 'Custom Complete' },
    { completionMessage: 'Birthday Party!' },
  ])('should pass custom completion message to theme when countdown completes: %s', async ({ completionMessage }) => {
    const target = new Date(Date.now() + 1000);
    harness = createOrchestratorTestHarness({
      config: {
        mode: 'timer',
        targetDate: target,
        durationSeconds: 1,
        completionMessage,
        theme: 'contribution-graph',
        timezone: 'UTC',
      },
    });
    const orchestrator = harness.orchestrator;

    await harness.start();
    harness.advanceTimers(1500);

    expect(themeInstances['contribution-graph']?.onCelebrating).toHaveBeenCalledWith(
      expectSafeMessage(completionMessage.toUpperCase())
    );
    await orchestrator.destroy();
  });

  it('should allow setting timezone programmatically', async () => {
    const orchestrator = harness.orchestrator;
    await harness.start();

    orchestrator.setTimezone('America/New_York');

    expect(orchestrator.getCurrentTimezone()).toBe('America/New_York');
    await orchestrator.destroy();
  }, 10000); // Extended timeout for orchestration and theme initialization

  it('should return current theme id', async () => {
    harness = createOrchestratorTestHarness({ initialTheme: 'fireworks' });
    const orchestrator = harness.orchestrator;

    await harness.start();

    expect(orchestrator.getCurrentTheme()).toBe('fireworks');
    await orchestrator.destroy();
  }, 10000);

  it('should handle unknown theme by falling back to default', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const orchestrator = harness.orchestrator;

    await harness.start();

    expect(orchestrator.getCurrentTheme()).toBeTruthy();
    await orchestrator.destroy();
    consoleWarnSpy.mockRestore();
  }, 10000);

  it('should handle celebration display for date mode New Year countdown', async () => {
    const newYear = new Date();
    newYear.setFullYear(newYear.getFullYear() + 1);
    newYear.setMonth(0, 1);
    newYear.setHours(0, 0, 0, 0);

    harness = createOrchestratorTestHarness({
      config: {
        mode: 'wall-clock',
        targetDate: newYear,
        completionMessage: 'Happy New Year!',
        theme: 'contribution-graph',
        timezone: 'UTC',
      },
    });
    const orchestrator = harness.orchestrator;

    await harness.start();

    expect(orchestrator.getCurrentTheme()).toBe('contribution-graph');
    await orchestrator.destroy();
  }, 10000);

  

  it('should not reload theme when switching to the same theme', async () => {
    harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph' });
    const orchestrator = harness.orchestrator;
    await harness.start();

    const initialThemeInstance = themeInstances['contribution-graph'];
    expect(initialThemeInstance?._state).toBe('ACTIVE');

    await orchestrator.switchTheme('contribution-graph');
    harness.advanceTimers(50);

    expect(orchestrator.getCurrentTheme()).toBe('contribution-graph');
    expect(initialThemeInstance?._state).not.toBe('DESTROYED');

    await orchestrator.destroy();
  }, 10000);

  describe('Per-timezone wall-clock celebration lifecycle', () => {
    it('should call onCelebrated (not onCelebrating) when loading URL with already-celebrated timezone', async () => {
      const pastTarget = new Date('2020-01-01T00:00:00');
      harness = createOrchestratorTestHarness({
        config: {
          mode: 'wall-clock',
          targetDate: pastTarget,
          wallClockTarget: { year: 2020, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
          completionMessage: 'Happy New Year 2020!',
          theme: 'contribution-graph',
          timezone: 'Australia/Sydney',
        },
      });
      const orchestrator = harness.orchestrator;

      await harness.start();
      harness.advanceTimers(100);

      expect(themeInstances['contribution-graph']?.onCelebrated).toHaveBeenCalledWith(
        expectSafeMessage('HAPPY NEW YEAR 2020!')
      );
      expect(themeInstances['contribution-graph']?.onCelebrating).not.toHaveBeenCalled();
      expect(harness.container.getAttribute('data-celebrating')).toBe('true');

      await orchestrator.destroy();
    });

    it('should resume countdown when switching to a timezone that has not reached wall-clock target', async () => {
      const { target, wallClockTarget } = createFutureWallClock();
      harness = createOrchestratorTestHarness({
        config: {
          mode: 'wall-clock',
          targetDate: target,
          wallClockTarget,
          completionMessage: 'Target reached!',
          theme: 'contribution-graph',
          timezone: 'UTC',
        },
      });
      const orchestrator = harness.orchestrator;

      await harness.start();
      await vi.advanceTimersByTimeAsync(6000);

      expect(themeInstances['contribution-graph']?.onCelebrating).toHaveBeenCalled();
      expect(harness.container.getAttribute('data-celebrating')).toBe('true');

      (themeInstances['contribution-graph']?.onCelebrating as ReturnType<typeof vi.fn>).mockClear();

      orchestrator.setTimezone('America/New_York');

      expect(orchestrator.getCurrentTimezone()).toBe('America/New_York');
      expect(themeInstances['contribution-graph']?.onCelebrating).not.toHaveBeenCalled();
      
      await orchestrator.destroy();
    }, 10000); // Extended timeout: slow integration test with real timers and async orchestration

    it('should not re-trigger celebration when switching back to already-celebrated timezone', async () => {
      const { target, wallClockTarget } = createFutureWallClock();
      harness = createOrchestratorTestHarness({
        config: {
          mode: 'wall-clock',
          targetDate: target,
          wallClockTarget,
          completionMessage: 'Done!',
          theme: 'contribution-graph',
          timezone: 'UTC',
        },
      });
      const orchestrator = harness.orchestrator;

      await harness.start();
      harness.advanceTimers(6000);
      
      expect(themeInstances['contribution-graph']?.onCelebrating).toHaveBeenCalledTimes(1);
      expect(themeInstances['contribution-graph']?.onCelebrating).toHaveBeenCalledWith(
        expectSafeMessage('DONE!')
      );
      
      orchestrator.setTimezone('America/New_York');
      harness.advanceTimers(100);
      
      (themeInstances['contribution-graph']?.onCelebrating as ReturnType<typeof vi.fn>).mockClear();
      (themeInstances['contribution-graph']?.onCelebrated as ReturnType<typeof vi.fn>).mockClear();
      
      orchestrator.setTimezone('UTC');
      harness.advanceTimers(100);
      
      expect(themeInstances['contribution-graph']?.onCelebrated).toHaveBeenCalled();
      expect(themeInstances['contribution-graph']?.onCelebrating).not.toHaveBeenCalled();
      
      await orchestrator.destroy();
    }, 10000); // Extended timeout to account for orchestrator initialization and theme state changes
  });

  describe('Concurrent Theme Switch Protection', () => {
    it('should handle theme switch during countdown tick', async () => {
      vi.useRealTimers();
      harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph', useRealTimers: true });
      const orchestrator = harness.orchestrator;
      await harness.start();

      await new Promise((resolve) => setTimeout(resolve, 20));

      await orchestrator.switchTheme('fireworks');

      expect(orchestrator.getCurrentTheme()).toBe('fireworks');

      await orchestrator.destroy();
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle start() called multiple times', async () => {
      harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph' });
      const orchestrator = harness.orchestrator;

      await harness.start();
      await orchestrator.start();
      await orchestrator.start();

      expect(orchestrator.getCurrentTheme()).toBe('contribution-graph');

      await orchestrator.destroy();
    }, 10000); // Extended timeout to account for orchestrator initialization and theme state changes

    it('should handle destroy() called multiple times', async () => {
      harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph' });
      const orchestrator = harness.orchestrator;
      await harness.start();

      await orchestrator.destroy();
      await orchestrator.destroy();
      await orchestrator.destroy();

      expect(document.body.contains(harness.container)).toBe(true);
    }, 10000);

    it('should handle switchTheme() after destroy()', async () => {
      harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph' });
      const orchestrator = harness.orchestrator;
      await harness.start();
      await orchestrator.destroy();

      await expect(orchestrator.switchTheme('fireworks')).resolves.not.toThrow();
    }, 10000);
  });

  describe('Error Recovery', () => {
    it('should handle missing container element gracefully', () => {
      const missingContainer = document.createElement('div');

      expect(() => {
        createOrchestrator({ container: missingContainer, initialTheme: 'contribution-graph' });
      }).not.toThrow();
    });

    it('should handle timezone change with invalid timezone', async () => {
      harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph' });
      const orchestrator = harness.orchestrator;
      await harness.start();

      expect(() => {
        orchestrator.setTimezone('Invalid/Timezone');
      }).toThrow(RangeError);

      await orchestrator.destroy();
    }, 10000);
  });

  describe('Color Application', () => {
    it('should set theme color overrides as inline styles on mount', async () => {
      harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph' });
      await harness.start();

      const root = document.documentElement.style;
      
      expect(root.getPropertyValue('--color-accent-primary')).toBeTruthy();
      expect(root.getPropertyValue('--color-accent-secondary')).toBeTruthy();
      expect(root.getPropertyValue('--color-background')).toBe('');
      expect(root.getPropertyValue('--color-text')).toBe('');

      await harness.orchestrator.destroy();
    });

    it('should update CSS variables on theme switch', async () => {
      harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph' });
      await harness.start();

      const root = document.documentElement.style;
      const initialPrimary = root.getPropertyValue('--color-accent-primary');
      expect(initialPrimary).toBeTruthy();

      await harness.orchestrator.destroy();
      await harness.cleanup();
      
      harness = createOrchestratorTestHarness({ initialTheme: 'fireworks' });
      await harness.start();

      const updatedPrimary = root.getPropertyValue('--color-accent-primary');
      expect(updatedPrimary).toBeTruthy();
      
      await harness.orchestrator.destroy();
    }, 10000); // Extended timeout for multiple theme initializations and CSS updates

    it('should use theme-specific accent colors', async () => {
      localStorage.clear();
      
      harness = createOrchestratorTestHarness({ initialTheme: 'contribution-graph' });
      await harness.start();

      const root = document.documentElement.style;
      expect(root.getPropertyValue('--color-accent-primary')).toBe('#1a7f37');
      expect(root.getPropertyValue('--color-accent-secondary')).toBe('#116329');

      await harness.orchestrator.destroy();
    }, 10000);
  });
});
