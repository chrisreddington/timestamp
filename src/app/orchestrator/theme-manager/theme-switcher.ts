/**
 * Theme Switcher Manager - async theme switching with abort, focus preservation, and URL sync.
 * 5-phase process: Preparation → Loading → Mounting → Destruction → Finalization.
 */

import { buildConfigForUrlSync } from '@core/config/url-sync-helpers';
import { measureAsync } from '@core/perf/perf-monitor';
import { getTimeRemaining } from '@core/time/time';
import type { CountdownConfig, MountContext, ThemeConfig, ThemeId, TimePageRenderer, TimeRemaining, WallClockTime } from '@core/types';
import { syncThemeToUrl } from '@core/url';
import { getThemeDisplayName } from '@themes/registry';

import type { CelebrationDisplay } from '../types';
import {
    getCountdownAccessibleName,
    preserveFocusWithin,
    restoreFocusWithin,
    setupThemeContainer,
} from './theme-focus-preservation';

/** Minimum time between theme switches (ms) to prevent rapid toggling */
const MIN_SWITCH_INTERVAL_MS = 100;

/** Options for creating a theme transition manager. */
export interface ThemeTransitionOptions {
  container: HTMLElement;
  getCurrentTheme: () => TimePageRenderer | null;
  setCurrentTheme: (theme: TimePageRenderer, themeId: ThemeId) => void;
  getCurrentThemeId: () => ThemeId;
  getLastTime: () => TimeRemaining | null;
  isComplete: () => boolean;
  loadTheme: (themeId: ThemeId) => Promise<TimePageRenderer>;
  loadThemeConfig: (themeId: ThemeId) => Promise<ThemeConfig>;
  getCelebrationDisplay: () => CelebrationDisplay;
  announceThemeChange: (themeName: string) => void;
  setLastAriaLabel: (label: string) => void;
  setThemeInState: (themeId: ThemeId) => void;
  config?: CountdownConfig;
  getCurrentTimezone: () => string;
  /** Get wall clock target. Returns null for timer/absolute modes. */
  getWallClockTarget: () => WallClockTime | null;
  getTargetDate: () => Date;
  getMountContext: () => MountContext;
  onThemeSwitchComplete?: (newThemeId: ThemeId, newConfig: ThemeConfig) => void;
}

/** Theme transition manager interface. */
export interface ThemeTransitionManager {
  /** Switch to a new theme with smooth transition */
  switchTheme(newThemeId: ThemeId): Promise<void>;
  
  /** Abort any pending theme switch */
  abort(): void;
  
  /** Get pending switch promise (if any) */
  getPendingSwitch(): Promise<void> | null;
  
  /** Check if theme switch is allowed (respects minimum interval) */
  canSwitch(): boolean;
}

/**
 * Create a theme transition manager.
 * @param options - Configuration for the transition manager
 * @returns A theme transition manager
 */
export function createThemeTransitionManager(
  options: ThemeTransitionOptions
): ThemeTransitionManager {
  const {
    container,
    getCurrentTheme,
    setCurrentTheme,
    getCurrentThemeId,
    getLastTime,
    isComplete,
    loadTheme,
    loadThemeConfig,
    getCelebrationDisplay,
    announceThemeChange,
    setLastAriaLabel,
    setThemeInState,
    config,
    getCurrentTimezone,
    getTargetDate,
    getMountContext,
    onThemeSwitchComplete,
  } = options;

  let pendingSwitch: Promise<void> | null = null;
  let lastSwitchTime = 0;
  let switchGeneration = 0;
  let abortController: AbortController | null = null;

  async function performSwitch(
    newThemeId: ThemeId,
    signal: AbortSignal,
    requestGeneration: number
  ): Promise<void> {
    const currentTimeSnapshot = getLastTime();
    const wasComplete = isComplete();
    
    // CRITICAL: Preserve focus before destroying to maintain keyboard navigation context
    const preservedFocus = preserveFocusWithin(container);

    // Load new theme config and destroy optional components
    const newConfig = await loadThemeConfig(newThemeId);
    if (signal.aborted || requestGeneration !== switchGeneration) {
      return;
    }

    // Create new theme instance
    const newTheme = await loadTheme(newThemeId);
    if (signal.aborted || requestGeneration !== switchGeneration) {
      await newTheme.destroy();
      return;
    }

    // Prepare in off-screen container for smooth transition
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = 
      'visibility: hidden; position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
    document.body.appendChild(tempContainer);

    if (signal.aborted || requestGeneration !== switchGeneration) {
      tempContainer.remove();
      await newTheme.destroy();
      return;
    }

    // Mount new theme in temp container
    const mountContext = getMountContext();
    newTheme.mount(tempContainer, mountContext);
    
    // Set container attributes
    const ariaLabel = getCountdownAccessibleName(currentTimeSnapshot, wasComplete);
    setupThemeContainer(tempContainer, newThemeId, ariaLabel);

    // Restore appropriate state
    if (wasComplete) {
      const { message, fullMessage } = getCelebrationDisplay();
      newTheme.onCelebrated({ message, fullMessage });
    } else {
      // Always update countdown when not complete, computing fresh time if needed
      // This prevents showing default "00:00:00" values when lastTime is null
      const timeToDisplay = currentTimeSnapshot ?? getTimeRemaining(getTargetDate());
      newTheme.updateTime(timeToDisplay);
    }

    // Check for abort
    if (signal.aborted || requestGeneration !== switchGeneration) {
      await newTheme.destroy();
      tempContainer.remove();
      return;
    }

    // Swap themes in main container (single RAF for smooth 60fps transition)
    await new Promise<void>((resolve) => {
      requestAnimationFrame(async () => {
        const currentTheme = getCurrentTheme();
        
        // Destroy old theme and swap in one frame for instant visual transition
        if (currentTheme) {
          await currentTheme.destroy();
        }

        const newChildren = Array.from(tempContainer.childNodes);
        container.replaceChildren(...newChildren);
        tempContainer.remove();

        // Update current theme reference
        setCurrentTheme(newTheme, newThemeId);

        newTheme.updateContainer(container);
        
        // Re-apply container attributes
        const finalAriaLabel = getCountdownAccessibleName(currentTimeSnapshot, wasComplete);
        setupThemeContainer(container, newThemeId, finalAriaLabel);
        setLastAriaLabel(finalAriaLabel);

        resolve();
      });
    });

    // Check for abort again
    if (signal.aborted || requestGeneration !== switchGeneration) {
      const currentTheme = getCurrentTheme();
      await currentTheme?.destroy();
      return;
    }

    // Update state
    setThemeInState(newThemeId);

    // Notify UI components
    if (onThemeSwitchComplete) {
      onThemeSwitchComplete(newThemeId, newConfig);
    }

    // Announce theme change
    const themeName = getThemeDisplayName(newThemeId);
    announceThemeChange(themeName);

    // Sync URL
    if (config) {
      const updatedConfig: CountdownConfig = buildConfigForUrlSync(config, {
        theme: newThemeId,
        timezone: getCurrentTimezone(),
      });
      syncThemeToUrl(newThemeId, updatedConfig);
    }

    // Restore focus
    restoreFocusWithin(container, preservedFocus);
  }

  return {
    async switchTheme(newThemeId: ThemeId): Promise<void> {
      // Skip if selecting the same theme
      if (newThemeId === getCurrentThemeId()) {
        return;
      }

      const now = Date.now();
      if (now - lastSwitchTime < MIN_SWITCH_INTERVAL_MS) {
        return;
      }

      // Wait for any pending switch
      if (pendingSwitch) {
        await pendingSwitch;
      }

      lastSwitchTime = now;
      const requestGeneration = ++switchGeneration;

      // Abort any in-progress switch
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();
      const signal = abortController.signal;

      pendingSwitch = (async () => {
        try {
          await measureAsync(
            `theme-switch-${newThemeId}`,
            () => performSwitch(newThemeId, signal, requestGeneration)
          );
        } finally {
          pendingSwitch = null;
        }
      })();

      return pendingSwitch;
    },

    abort(): void {
      abortController?.abort();
    },

    getPendingSwitch(): Promise<void> | null {
      return pendingSwitch;
    },

    canSwitch(): boolean {
      return Date.now() - lastSwitchTime >= MIN_SWITCH_INTERVAL_MS;
    },
  };
}
