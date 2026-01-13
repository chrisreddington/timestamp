/**
 * Theme Orchestrator - coordinates theme switching with state preservation and smooth transitions.
 * Slim coordinator that delegates to extracted modules.
 */

import { getModeConfig } from '@core/config/mode-config';
import { createStateManager, type StateManager } from '@core/state';
import { getTimeRemaining } from '@core/time/time';
import { getUserTimezone } from '@core/time/timezone';
import { hasWallClockTimeReached } from '@core/time/wall-clock-conversion';
import type { CountdownConfig, CountdownMode, ThemeConfig, ThemeId, TimePageRenderer } from '@core/types';
import { buildShareUrls, type ShareTargets } from '@core/url';
import { type AccessibilityManager, createAccessibilityManager } from '@core/utils/accessibility';
import { DEFAULT_THEME_ID } from '@themes/registry';

import { requestFullscreen, setFullscreenTimerPlaying } from '@/components/countdown-buttons/fullscreen-manager';

import { transitionToCelebrated } from './celebration-transitions';
import { createPageController, type PageController } from './controllers';
import { cleanupKeyboardShortcuts, initKeyboardShortcuts } from './keyboard-shortcuts';
import { getCountdownAccessibleName, setupThemeContainer } from './theme-manager/theme-focus-preservation';
import { createThemeRenderer, getCelebrationDisplay, getThemeConfig } from './theme-manager/theme-loader-factory';
import { createThemeTransitionManager, type ThemeTransitionManager } from './theme-manager/theme-switcher';
import { initializeTargetDate } from './time-manager/countdown-target-calculator';
import { createTimeEventHandlers, type TimeEventHandlers } from './time-manager/event-handlers';
import { createTimeLoop, type TimeLoop } from './time-manager/tick-scheduler';
import { handlePlayPause, handleReset } from './time-manager/timer-playback-controls';
import { createTimezoneManager, type TimezoneManager } from './time-manager/timezone-state-manager';
import type { OrchestratorOptions } from './types';
import { hideLoadingElement, prepareContainer, restoreContainer } from './ui/container-preparation';
import { applyThemeColors, initializeColorMode, setupColorModeListener } from './ui/theme-color-manager';
import { type ChromeController, createChromeController } from './ui/ui-chrome-visibility-manager';
import {
    createOptionalComponents,
    createUIComponents,
    destroyOptionalComponents,
    destroyUIComponents,
    setupModalHandlers,
    type UIComponents,
    type UIFactoryOptions,
} from './ui/ui-factory';

// Re-export for external consumers
export type { OrchestratorOptions } from './types';

/** Orchestrator controller interface. */
export interface Orchestrator {
  start(): Promise<void>;
  destroy(): void;
  switchTheme(themeId: ThemeId): Promise<void>;
  getCurrentTheme(): ThemeId;
  getCurrentTimezone(): string;
  setTimezone(timezone: string): void;
}

/** Create the theme orchestrator. */
export function createOrchestrator(options: OrchestratorOptions): Orchestrator {
  const { container } = options;

  // Initialize timezone and target date
  const initialTimezone: string = options.config?.timezone ?? getUserTimezone();
  const mode: CountdownMode = options.config?.mode ?? (options.config?.durationSeconds ? 'timer' : 'wall-clock');
  const modeConfig = getModeConfig(mode);
  // eslint-disable-next-line prefer-const -- targetDate and wallClockTarget are reassigned via callbacks
  let { targetDate, wallClockTarget } = initializeTargetDate(options.config, initialTimezone, modeConfig.isDurationBased);

  // Timer mode: store original duration for reset functionality
  const originalDurationMs = options.config?.durationSeconds ? options.config.durationSeconds * 1000 : null;

  // Initialize state and accessibility managers
  const initialTheme = options.config?.theme ?? options.initialTheme ?? DEFAULT_THEME_ID;
  const stateManager: StateManager = createStateManager({
    initialTheme,
    targetDate,
    countdownMode: options.config?.mode,
    completionMessage: options.config?.completionMessage,
    durationSeconds: options.config?.durationSeconds,
    initialTimezone,
  });
  const accessibilityManager: AccessibilityManager = createAccessibilityManager();

  // Theme state
  let currentTheme: TimePageRenderer | null = null;
  let currentThemeId: ThemeId = stateManager.getState().selectedTheme;

  // Module instances (initialized in start())
  let timeLoop: TimeLoop | null = null;
  let timezoneManager: TimezoneManager | null = null;
  let themeTransitionManager: ThemeTransitionManager | null = null;
  let chromeController: ChromeController | null = null;
  let eventHandlers: TimeEventHandlers | null = null;
  let uiComponents: UIComponents | null = null;
  let cleanupModalHandlers: (() => void) | null = null;
  let cleanupColorModeListener: (() => void) | null = null;

  // Reduced-motion controller (manages unified lifecycle for theme renderers)
  const timePageController: PageController = createPageController({
    getCurrentRenderer: () => currentTheme,
    removeAttributeOnDestroy: true,
  });

  // Hide loading element
  hideLoadingElement();

  async function mountInitialTheme(params: {
    container: HTMLElement;
    currentThemeId: ThemeId;
  }): Promise<{ currentTheme: TimePageRenderer; currentThemeId: ThemeId }> {
    const theme = await createThemeRenderer(params.currentThemeId, targetDate);
    const mountContext = timePageController.getMountContext();
    theme.mount(params.container, mountContext);
    
    // Update countdown immediately after mount to prevent showing default "00" values
    const initialTime = getTimeRemaining(targetDate);
    if (initialTime.total > 0) {
      theme.updateTime(initialTime);
    }
    
    return { currentTheme: theme, currentThemeId: params.currentThemeId };
  }

  async function setupThemeAndMount(): Promise<string> {
    ({ currentTheme, currentThemeId } = await mountInitialTheme({
      container,
      currentThemeId,
    }));

    const initialAriaLabel = getCountdownAccessibleName(null, false);
    setupThemeContainer(container, currentThemeId, initialAriaLabel);
    return initialAriaLabel;
  }

  function initializeManagers(): void {
    // Create timezone manager with direct callbacks
    timezoneManager = createTimezoneManager({
      initialTimezone,
      wallClockTarget,
      mode,
      getCurrentThemeId: () => currentThemeId,
      config: options.config,
      container,
      stateManager,
      callbacks: {
        getCurrentTheme: () => currentTheme,
        getCelebrationDisplay: (td) => getCelebrationDisplay(options.config, td),
        getTargetDate: () => targetDate,
        setTargetDate: (date) => { targetDate = date; },
        setComplete: (isComplete) => stateManager.setComplete(isComplete),
        triggerCountdownUpdate: () => timeLoop?.tick(),
        getLastTime: () => timeLoop?.getLastTime() ?? null,
        isComplete: () => stateManager.getState().isComplete,
        updateWorldMap: (tz) => uiComponents?.worldMap?.setTimezone(tz),
      },
    });

    // Create theme transition manager with direct callbacks
    themeTransitionManager = createThemeTransitionManager({
      container,
      getCurrentTheme: () => currentTheme,
      setCurrentTheme: (theme, id) => { currentTheme = theme; currentThemeId = id; },
      getCurrentThemeId: () => currentThemeId,
      getLastTime: () => timeLoop?.getLastTime() ?? null,
      isComplete: () => stateManager.getState().isComplete,
      loadTheme: (id) => createThemeRenderer(id, timezoneManager?.getTargetDate() ?? targetDate),
      loadThemeConfig: (id) => getThemeConfig(id),
      getCelebrationDisplay: () => getCelebrationDisplay(options.config, timezoneManager?.getTargetDate() ?? targetDate),
      announceThemeChange: (name) => accessibilityManager.announceThemeChange(name),
      setLastAriaLabel: (label) => eventHandlers?.setLastAriaLabel(label),
      setThemeInState: (themeId) => stateManager.setTheme(themeId),
      config: options.config,
      getCurrentTimezone: () => timezoneManager?.getCurrentTimezone() ?? initialTimezone,
      getWallClockTarget: () => timezoneManager?.getWallClockTarget() ?? wallClockTarget,
      getTargetDate: () => timezoneManager?.getTargetDate() ?? options.config?.targetDate ?? new Date(),
      getMountContext: () => timePageController.getMountContext(),
      onThemeSwitchComplete: (newThemeId, newConfig) => {
        if (uiComponents) destroyOptionalComponents(uiComponents, newConfig);
        handleThemeSwitchComplete(newThemeId, newConfig);
      },
    });
  }

  function buildUiFactoryOptions(initialThemeId: ThemeId): UIFactoryOptions {
    return {
      initialTheme: initialThemeId,
      container,
      mode,
      showWorldMap: options.config?.showWorldMap,
      getShareTargets: createShareTargetsGetter(),
      onBack: options.onBack,
      onThemeSwitch: performThemeSwitch,
      onTimezoneSelect: (tz: string) => handleTimezoneChange(tz),
      onCitySelect: (tz: string) => handleTimezoneChange(tz),
      // Timer mode controls
      onTimerPlayPauseToggle: handleTimerPlayPauseToggle,
      onTimerReset: handleTimerReset,
    };
  }

  function createShareTargetsGetter(): () => ShareTargets {
    return () => {
      if (!options.config?.targetDate) {
        return {
          withSelectedTimezone: window.location.href,
          withLocalTimezone: window.location.href,
          withoutTimezone: window.location.href,
        };
      }

      const currentTimezone = timezoneManager?.getCurrentTimezone() ?? initialTimezone;
      const updatedConfig: CountdownConfig = {
        ...options.config,
        timezone: currentTimezone,
        theme: currentThemeId,
      };
      return buildShareUrls(updatedConfig);
    };
  }

  /**
   * Handle timezone changes from UI (selector or world map).
   */
  function handleTimezoneChange(timezone: string): void {
    timezoneManager?.setTimezone(timezone);
    uiComponents?.timezoneSelector?.setTimezone(timezone);
  }

  /** Timer control dependencies (reused for play/pause and reset). */
  const getTimerControlDeps = () => ({
    mode,
    originalDurationMs,
    timeLoop,
    stateManager,
    container,
    uiComponents,
    currentTheme,
    getTargetDate: () => targetDate,
    updateTargetDate: (nextDate: Date) => { targetDate = nextDate; },
  });

  /** Handle timer play/pause toggle (timer mode only). */
  function handleTimerPlayPauseToggle(isPlaying: boolean): void {
    handlePlayPause(isPlaying, getTimerControlDeps());
  }

  /** Handle timer reset (timer mode only). */
  function handleTimerReset(): void {
    handleReset(getTimerControlDeps());
  }

  async function setupUiLayerAndChrome(): Promise<void> {
    // Skip ALL UI chrome when hideChrome is set (for video recording)
    if (options.config?.hideChrome) {
      return;
    }

    const uiFactoryOptions = buildUiFactoryOptions(currentThemeId);
    
    const ui = createUIComponents(uiFactoryOptions);
    uiComponents = ui;
    cleanupModalHandlers = setupModalHandlers(ui.buttonContainer);
    const themeConfig = await getThemeConfig(currentThemeId);
    createOptionalComponents(ui, initialTimezone, uiFactoryOptions, themeConfig, wallClockTarget ?? undefined);

    if (ui.colorModeToggle) {
      cleanupColorModeListener = setupColorModeListener(
        ui.colorModeToggle,
        () => currentThemeId
      );
    }

    initializeColorMode(currentThemeId);

    chromeController = createChromeController({
      container,
      mode,
      hasBackButton: !!options.onBack,
      showWorldMap: options.config?.showWorldMap !== false,
      onOverlayStateChange: (active) => {
        // Notify theme to pause/resume expensive animations when overlay is active
        const prefersReducedMotion = timePageController.isReducedMotionActive();
        currentTheme?.onAnimationStateChange({
          shouldAnimate: !active && !prefersReducedMotion,
          prefersReducedMotion,
          reason: 'overlay-open',
        });
      },
    });
    chromeController.init(ui);
  }

  /**
   * Check if countdown has already completed on initial load.
   * Handles all modes: timer, absolute, and wall-clock.
   * @returns true if already celebrated
   */
  function checkAndHandleInitialCelebration(): boolean {
    // Wall-clock mode: check if timezone has reached target
    if (modeConfig.timezoneRelevantDuringCountdown && wallClockTarget) {
      if (!hasWallClockTimeReached(wallClockTarget, initialTimezone)) {
        return false;
      }
    } else {
      // Timer/absolute modes: check if target date is in the past
      if (targetDate.getTime() > Date.now()) {
        return false;
      }
    }
    
    // Already completed - skip animation, go directly to celebrated state
    transitionToCelebrated(stateManager, container, initialTimezone);
    
    const { message, fullMessage } = getCelebrationDisplay(options.config, targetDate);
    currentTheme?.onCelebrated?.({ message, fullMessage });
    
    const completionLabel = getCountdownAccessibleName(null, true);
    container.setAttribute('aria-label', completionLabel);
    
    return true;
  }

  function startRuntime(): void {
    checkAndHandleInitialCelebration();
    
    timeLoop = createTimeLoop({
      getTargetDate: () => targetDate,
      onTick: (time) => eventHandlers?.handleTick(time),
      onComplete: () => eventHandlers?.handleComplete(),
      isComplete: () => stateManager.getCelebrationState() !== 'counting',
    });
    timeLoop.start();

    // Initialize keyboard shortcuts
    initKeyboardShortcuts({
      mode,
      onTogglePlayPause: () => {
        // Get current playing state from TimeLoop (source of truth) and toggle it
        const currentlyPaused = timeLoop?.isPaused() ?? false;
        const newPlaying = currentlyPaused; // If paused, we want to play (true). If playing, we want to pause (false)
        // Sync both regular and fullscreen timer controls
        uiComponents?.timerControls?.setPlaying(newPlaying);
        setFullscreenTimerPlaying(newPlaying);
        handleTimerPlayPauseToggle(newPlaying);
      },
      onReset: () => {
        handleTimerReset();
      },
      onToggleFullscreen: async () => {
        // F key toggles fullscreen in all modes (not just timer)
        await requestFullscreen();
      },
    });

    stateManager.subscribe(handleStateChange);
    accessibilityManager.announceLoaded();
  }

  async function performThemeSwitch(newThemeId: ThemeId): Promise<void> {
    if (themeTransitionManager) {
      return themeTransitionManager.switchTheme(newThemeId);
    }
  }

  function handleThemeSwitchComplete(newThemeId: ThemeId, newConfig: ThemeConfig): void {
    const currentTimezone = timezoneManager?.getCurrentTimezone() ?? initialTimezone;
    const currentWallClockTarget = timezoneManager?.getWallClockTarget() ?? wallClockTarget;

    applyThemeColors(newThemeId);

    if (uiComponents) {
      uiComponents.themeSwitcher?.setTheme(newThemeId);
      uiComponents.favoriteButton?.setTheme(newThemeId);

      const factoryOptions: UIFactoryOptions = {
        initialTheme: newThemeId,
        container,
        mode,
        showWorldMap: options.config?.showWorldMap,
        onBack: options.onBack,
        onThemeSwitch: performThemeSwitch,
      };
      createOptionalComponents(uiComponents, currentTimezone, factoryOptions, newConfig, currentWallClockTarget ?? undefined);
    }
  }

  function handleStateChange(newState: ReturnType<StateManager['getState']>): void {
    if (newState.selectedTheme !== currentThemeId) {
      performThemeSwitch(newState.selectedTheme);
    }
  }

  return {
    async start(): Promise<void> {
      prepareContainer(container, accessibilityManager);
      timePageController.init();

      const initialAriaLabel = await setupThemeAndMount();
      
      // Create time event handlers directly
      eventHandlers = createTimeEventHandlers({
        container,
        getCurrentTheme: () => currentTheme,
        getCurrentThemeId: () => currentThemeId,
        stateManager,
        accessibilityManager,
        getTimezoneManager: () => timezoneManager,
        initialTimezone,
        config: options.config,
        getCelebrationDisplay: (targetDate) => getCelebrationDisplay(options.config, targetDate),
      });
      eventHandlers.setLastAriaLabel(initialAriaLabel);
      
      initializeManagers();
      await setupUiLayerAndChrome();
      startRuntime();
    },

    async destroy(): Promise<void> {
      restoreContainer(container);

      timeLoop?.stop();
      timeLoop = null;

      // Cleanup keyboard shortcuts
      cleanupKeyboardShortcuts();

      chromeController?.destroy();
      chromeController = null;

      if (themeTransitionManager) {
        themeTransitionManager.abort();
        const pending = themeTransitionManager.getPendingSwitch();
        if (pending) await pending;
        themeTransitionManager = null;
      }

      cleanupModalHandlers?.();
      cleanupModalHandlers = null;

      cleanupColorModeListener?.();
      cleanupColorModeListener = null;

      if (uiComponents) {
        destroyUIComponents(uiComponents);
        uiComponents = null;
      }

      if (currentTheme) {
        await currentTheme.destroy();
        currentTheme = null;
      }

      timePageController.destroy();

      stateManager.destroy();
      accessibilityManager.destroy();
      timezoneManager = null;
      eventHandlers = null;

      container.innerHTML = '';
    },

    switchTheme: performThemeSwitch,

    getCurrentTheme(): ThemeId {
      return currentThemeId;
    },

    getCurrentTimezone(): string {
      return timezoneManager?.getCurrentTimezone() ?? initialTimezone;
    },

    setTimezone(timezone: string): void {
      timezoneManager?.setTimezone(timezone);
      uiComponents?.timezoneSelector?.setTimezone(timezone);
    },
  };
}
