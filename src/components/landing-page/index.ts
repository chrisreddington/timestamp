/**
 * Landing page component for configuring countdowns before launching a theme.
 * Provides accessible controls for mode selection, validation, and theme preview selection.
 *
 * This is a slim coordinator that delegates to extracted modules:
 * - background-manager: Theme background lifecycle, visibility, resize
 * - form-state: Config ⇄ DOM field synchronization
 * - interaction-controller: Event binding, keyboard navigation, cleanup
 * - dom-builders: DOM element construction
 * - event-handlers: Event handler factories
 */

import '../../styles/layouts/landing-page.scss';

import { findCityByTimezone } from '@app/data/cities';
import { applyThemeColorOverrides } from '@app/orchestrator/ui/theme-color-manager';
import { getModeConfig } from '@core/config/mode-config';
import { getResolvedColorMode } from '@core/preferences/color-mode';
import { getUserTimezone } from '@core/time/timezone';
import { convertWallClockToAbsolute, createNextOccurrence } from '@core/time/wall-clock-conversion';
import type { CountdownConfig, CountdownMode, ThemeId } from '@core/types';
import { DEFAULT_THEME_ID, getThemeColorOverrides, getThemeDisplayName } from '@themes/registry';

import { COLOR_MODE_CHANGE_EVENT, type ColorModeChangeDetail, createColorModeToggle } from '../color-mode-toggle';
import { createThemeSelector, type ThemeSelectorController } from '../theme-picker/index';
import { createTimezoneSelector, type TimezoneSelectorController } from '../timezone-selector';
import { type BackgroundManagerController, createBackgroundManager } from './background-manager';
// Extracted modules
import {
    buildCompletionMessageSection,
    buildDateSection,
    buildFooter,
    buildModeSelector,
    buildTimerSection,
} from './dom-builders';
import {
    clearActiveErrorToast,
    createModeChangeHandler,
    createThemeSelectHandler,
    type EventHandlerContext,
} from './event-handlers';
import {
    createFormController,
    type FormController,
    type LandingPageFormState,
    toLocalInputValue,
} from './form-controller';
import { createShadowCalculator, type ShadowCalculatorController } from './shadow-calculator';

/**
 * Options for creating a landing page instance.
 */
export interface LandingPageOptions {
  /** Optional configuration to pre-fill form fields (mode, theme, timezone, etc.) */
  initialConfig?: Partial<CountdownConfig>;
  /** Callback invoked when user clicks start with valid configuration */
  onStart: (config: CountdownConfig) => void;
}

/**
 * Controller returned from `createLandingPage`.
 */
export interface LandingPageController {
  /** Render landing page into container and initialize all components */
  mount(container: HTMLElement): void;
  /** Clean up all event listeners, controllers, and DOM elements */
  destroy(): void;
  /** Update form fields with new configuration values */
  setConfig(config: Partial<CountdownConfig>): void;
  /** Promise resolving when theme background finishes rendering (testing utility) */
  waitForBackgroundReady(): Promise<void>;
}

/**
 * Create landing page controller.
 * @returns Controller with mount, destroy, setConfig, and waitForBackgroundReady methods
 */
export function createLandingPage(options: LandingPageOptions): LandingPageController {
  const initialTimezone = options.initialConfig?.timezone ?? getUserTimezone();
  const initialState: LandingPageFormState = {
    mode: options.initialConfig?.mode ?? 'wall-clock',
    theme: options.initialConfig?.theme ?? DEFAULT_THEME_ID,
    timezone: initialTimezone,
    showWorldMap: true,
  };

  let containerRef: HTMLElement | null = null;
  let rootEl: HTMLElement | null = null;
  let destroyed = false;

  // DOM references
  let dateInput: HTMLInputElement;
  let hoursInput: HTMLInputElement;
  let minutesInput: HTMLInputElement;
  let secondsInput: HTMLInputElement;
  let completionMessageInput: HTMLTextAreaElement;
  let statusRegion: HTMLElement;
  let startButton: HTMLButtonElement;
  let dateSection: HTMLElement;
  let timerSection: HTMLElement;
  let timezoneSection: HTMLElement;
  let worldMapToggle: HTMLElement;
  let modeRadios: Record<CountdownMode, HTMLInputElement>;
  let modeFieldset: HTMLElement;
  let dateError: HTMLElement;
  let durationError: HTMLElement;
  let durationPreview: HTMLElement;

  // Component controllers
  let timezoneSelectorController: TimezoneSelectorController | null = null;
  let themeSelectorController: ThemeSelectorController | null = null;
  let colorModeToggleEl: HTMLElement | null = null;
  let shadowCalculatorController: ShadowCalculatorController | null = null;

  // Extracted module controllers
  let backgroundManager: BackgroundManagerController | null = null;
  let formController: FormController | null = null;

  /**
   * Build the header section with color mode toggle.
   */
  function buildHeaderWithToggle(): HTMLElement {
    const header = document.createElement('header');
    header.className = 'landing-header';
    header.setAttribute('data-testid', 'landing-header');

    // Create header content container
    const headerContent = document.createElement('div');
    headerContent.className = 'landing-header-content';
    headerContent.innerHTML = `
      <h1 class="landing-title">Timestamp</h1>
      <p class="landing-subtitle">Your stamp on time</p>
      <p class="landing-description">Enjoy New Year's, product launches or pomodoro breaks with gorgeous themes you can share instantly. Open source, ready for you to contribute!</p>
    `;

    // Create color mode toggle
    colorModeToggleEl = createColorModeToggle();

    // Assemble header
    header.appendChild(colorModeToggleEl);
    header.appendChild(headerContent);

    return header;
  }

  /** Get display name for a timezone */
  function getTimezoneDisplayName(tz: string): string {
    const city = findCityByTimezone(tz);
    if (city) return city.name;
    return tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
  }

  /**
   * Build the timezone selector section using the shared createTimezoneSelector component.
   * This provides consistent keyboard navigation and accessibility across both landing page and countdown view.
   */
  function buildTimezoneSelector(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'landing-timezone-section landing-form-section';
    section.setAttribute('data-testid', 'landing-timezone-section');

    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'landing-timezone-wrapper';

    // NOTE: Use the shared timezone selector component in inline mode (has its own "Timezone" label)
    timezoneSelectorController = createTimezoneSelector(selectorContainer, {
      initialTimezone: initialState.timezone,
      inline: true,
      onSelect: (tz: string) => {
        initialState.timezone = tz;
        announce(`Timezone changed to ${getTimezoneDisplayName(tz)}`);

        // Update date input to New Year in new timezone using canonical wall-clock conversion
        const config = getModeConfig(initialState.mode);
        if (config.isWallClock) {
          const wallClockNewYear = createNextOccurrence(0, 1);
          const newYearDate = convertWallClockToAbsolute(wallClockNewYear, tz);
          dateInput.value = toLocalInputValue(newYearDate);
        }
      },
    });

    section.append(selectorContainer);
    timezoneSection = section;

    return section;
  }

  // Build mode selector and extract radio references
  function buildAndSetupModeSelector(): HTMLElement {
    const fieldset = buildModeSelector();
    modeFieldset = fieldset;

    modeRadios = {
      'wall-clock': fieldset.querySelector('#mode-wall-clock') as HTMLInputElement,
      absolute: fieldset.querySelector('#mode-absolute') as HTMLInputElement,
      timer: fieldset.querySelector('#mode-timer') as HTMLInputElement,
    };

    // Roving tabindex initialization is handled by interaction controller
    return fieldset;
  }

  // Build date section and extract element references
  function buildAndSetupDateSection(): HTMLElement {
    const section = buildDateSection();

    dateInput = section.querySelector('#landing-date-picker') as HTMLInputElement;
    dateError = section.querySelector('#landing-date-error') as HTMLElement;

    return section;
  }

  // Build timer section and extract element references
  function buildAndSetupTimerSection(): HTMLElement {
    const section = buildTimerSection();

    hoursInput = section.querySelector('[data-testid="landing-duration-hours"]') as HTMLInputElement;
    minutesInput = section.querySelector('[data-testid="landing-duration-minutes"]') as HTMLInputElement;
    secondsInput = section.querySelector('[data-testid="landing-duration-seconds"]') as HTMLInputElement;
    durationError = section.querySelector('#landing-duration-error') as HTMLElement;
    durationPreview = section.querySelector('#landing-duration-preview') as HTMLElement;

    return section;
  }

  // Build completion message section and extract element references
  function buildAndSetupCompletionMessage(): HTMLElement {
    const section = buildCompletionMessageSection();
    completionMessageInput = section.querySelector('#landing-completion-message') as HTMLTextAreaElement;
    return section;
  }

  function buildThemeSelector(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'landing-form-section landing-theme-section';
    section.setAttribute('data-testid', 'landing-theme-selector');

    const sectionLabel = document.createElement('div');
    sectionLabel.className = 'landing-section-title';
    sectionLabel.textContent = 'Theme';

    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'landing-theme-selector-wrapper';

    // Use the shared theme selector component in inline mode
    themeSelectorController = createThemeSelector({
      currentTheme: initialState.theme,
      onSelect: (themeId) => {
        handleThemeSelect(themeId);
      },
      showLivePreview: true,
    });

    selectorContainer.appendChild(themeSelectorController.getElement());
    section.append(sectionLabel, selectorContainer);

    return section;
  }

  function handleThemeSelect(theme: ThemeId): void {
    const context = createEventContext();
    const handler = createThemeSelectHandler(context);
    handler(theme);
  }

  // Background rendering is now handled by background-manager module

  /** Create and configure root container element with theme data */
  function createRootContainer(theme: ThemeId): HTMLElement {
    const root = document.createElement('div');
    root.setAttribute('data-testid', 'landing-page');
    root.setAttribute('data-theme', theme);
    root.style.position = 'relative';
    root.style.minHeight = '100vh';
    root.style.width = '100%';
    return root;
  }

  /** Create theme background container element */
  function createThemeBackground(theme: ThemeId): HTMLElement {
    const themeBackground = document.createElement('div');
    themeBackground.className = `landing-theme-background landing-theme-background--${theme}`;
    themeBackground.setAttribute('aria-hidden', 'true');
    themeBackground.setAttribute('data-testid', 'landing-theme-background');
    themeBackground.setAttribute('data-theme-id', theme);
    return themeBackground;
  }

  /** Create wrapper and card container elements */
  function createWrapperAndCard(): { wrapper: HTMLElement; card: HTMLElement; main: HTMLElement } {
    const wrapper = document.createElement('div');
    wrapper.className = 'landing-wrapper';
    wrapper.setAttribute('data-testid', 'landing-wrapper');

    const card = document.createElement('div');
    card.className = 'landing-card';
    card.setAttribute('data-testid', 'landing-card');

    const main = document.createElement('main');
    main.setAttribute('aria-label', 'Countdown configuration');
    main.className = 'landing-main';

    return { wrapper, card, main };
  }

  /** Build all form sections and assemble form content */
  function buildFormSections(): { formContent: HTMLElement; footer: HTMLElement; header: HTMLElement } {
    const header = buildHeaderWithToggle();
    const modeSelector = buildAndSetupModeSelector();
    dateSection = buildAndSetupDateSection();
    timerSection = buildAndSetupTimerSection();
    const themeSelector = buildThemeSelector();
    buildTimezoneSelector();
    worldMapToggle = buildWorldMapToggle();
    shadowCalculatorController = createShadowCalculator();
    const shadowCalculatorSection = shadowCalculatorController.getElement();
    const completionMessage = buildAndSetupCompletionMessage();
    
    // Reuse global accessibility status region
    const globalStatusRegion = document.getElementById('a11y-status');
    if (!globalStatusRegion) {
      throw new Error('Missing global #a11y-status region in index.html');
    }
    statusRegion = globalStatusRegion;

    // Create start button
    startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'landing-start-button';
    startButton.setAttribute('data-testid', 'landing-start-button');
    startButton.setAttribute('tabindex', '0');
    startButton.textContent = 'Start Countdown';

    const footer = buildFooter();

    const formContent = document.createElement('div');
    formContent.className = 'landing-form-content';
    formContent.append(
      themeSelector,
      modeSelector,
      dateSection,
      timerSection,
      timezoneSection,
      worldMapToggle,
      shadowCalculatorSection,
      completionMessage,
      startButton
    );

    return { formContent, footer, header };
  }

  /** Initialize background manager and render initial theme */
  function initializeBackground(container: HTMLElement, card: HTMLElement, theme: ThemeId): void {
    backgroundManager = createBackgroundManager();
    backgroundManager.initialize(container, { exclusionElement: card });
    backgroundManager.render(theme);
  }

  /** Initialize form controller with all dependencies */
  function initializeFormController(): void {
    formController = createFormController(
      {
        dateInput,
        hoursInput,
        minutesInput,
        secondsInput,
        completionMessageInput,
        dateSection,
        timerSection,
        timezoneSection,
        worldMapToggle,
        startButton,
        modeRadios,
        modeFieldset,
      },
      {
        themeSelectorController,
        timezoneSelectorController,
        backgroundManager,
      },
      {
        onModeChange: handleModeChange,
        onThemeChange: (theme: ThemeId) => {
          backgroundManager?.render(theme);
          announce(`Theme changed to ${getThemeDisplayName(theme)}`);
        },
        createEventContext,
      }
    );

    formController.initializeForm(options.initialConfig, initialState);
    formController.initializeModeNavigation(initialState.mode);
    formController.bindEvents();
  }

  /** Setup color mode change listener */
  function setupColorModeListener(): void {
    if (!colorModeToggleEl) return;

    colorModeToggleEl.addEventListener(COLOR_MODE_CHANGE_EVENT, ((event: CustomEvent<ColorModeChangeDetail>) => {
      const resolvedMode = getResolvedColorMode(event.detail.mode);
      const colors = getThemeColorOverrides(initialState.theme, resolvedMode);
      applyThemeColorOverrides(colors, resolvedMode);
      themeSelectorController?.updateColorMode();
      announce(`Color mode changed to ${event.detail.mode}`);
    }) as EventListener);
  }

  /** Apply initial theme colors based on current color mode */
  function applyInitialThemeColors(): void {
    const initialResolvedMode = getResolvedColorMode();
    const initialColors = getThemeColorOverrides(initialState.theme, initialResolvedMode);
    applyThemeColorOverrides(initialColors, initialResolvedMode);
  }

  function buildWorldMapToggle(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'landing-form-section landing-world-map-section';
    section.setAttribute('data-testid', 'landing-world-map-section');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'landing-map-toggle is-on';
    toggle.setAttribute('data-testid', 'landing-map-toggle');
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', 'true');
    toggle.setAttribute('aria-label', 'Show world map on countdown');
    // NOTE: Safari requires explicit tabindex for keyboard navigation on buttons
    toggle.setAttribute('tabindex', '0');

    toggle.innerHTML = `
      <span class="landing-map-toggle-label">
        <span>🗺️</span>
        <span>Show World Map</span>
      </span>
      <span class="landing-map-toggle-switch"></span>
    `;

    toggle.addEventListener('click', () => {
      initialState.showWorldMap = !initialState.showWorldMap;
      toggle.classList.toggle('is-on', initialState.showWorldMap);
      toggle.setAttribute('aria-checked', initialState.showWorldMap ? 'true' : 'false');
      announce(`World map ${initialState.showWorldMap ? 'enabled' : 'disabled'}`);
    });

    section.append(toggle);
    return section;
  }

  // DOM builders are now imported from landing-page/dom-builders module

  function mount(container: HTMLElement): void {
    containerRef = container;

    // Remove countdown-specific attributes from container
    container.removeAttribute('data-theme');
    container.removeAttribute('role');
    container.removeAttribute('aria-label');
    container.removeAttribute('tabindex');

    // Create DOM structure
    const root = createRootContainer(initialState.theme);
    rootEl = root;
    const themeBackground = createThemeBackground(initialState.theme);
    const { wrapper, card, main } = createWrapperAndCard();
    const { formContent, footer, header } = buildFormSections();

    // Assemble DOM hierarchy
    main.append(formContent);
    card.append(header, main);
    wrapper.append(card, footer);
    root.append(themeBackground, wrapper);
    container.appendChild(root);

    // Initialize components
    initializeBackground(themeBackground, card, initialState.theme);
    initializeFormController();
    setupColorModeListener();
    applyInitialThemeColors();
  }

  function handleModeChange(mode: CountdownMode): void {
    const context = createEventContext();
    const handler = createModeChangeHandler(context);
    handler(mode);
    formController?.updateStartButtonLabel(mode);
    // Update roving tabindex to match the new mode
    formController?.updateModeNavigation(mode);
  }

  function toggleMode(mode: CountdownMode): void {
    formController?.toggleMode(mode, initialState);
  }

  // Create event handler context for all handlers
  function createEventContext(): EventHandlerContext {
    return {
      state: initialState,
      elements: {
        dateSection,
        timerSection,
        timezoneSection,
        worldMapToggle,
        startButton,
        dateInput,
        hoursInput,
        minutesInput,
        secondsInput,
        completionMessageInput,
        dateError,
        durationError,
        durationPreview,
        statusRegion,
      },
      callbacks: {
        onModeToggle: toggleMode,
        onThemeSelect: (theme: ThemeId) => {
          backgroundManager?.render(theme);
          // Apply theme colors to landing page UI (respect current color mode)
          const resolvedMode = getResolvedColorMode();
          const colors = getThemeColorOverrides(theme, resolvedMode);
          applyThemeColorOverrides(colors, resolvedMode);
          // Update data-theme attribute for CSS scoping
          if (rootEl) {
            rootEl.setAttribute('data-theme', theme);
          }
          announce(`Theme changed to ${getThemeDisplayName(theme)}`);
        },
        onTimezoneSelect: (tz: string) => {
          announce(`Timezone changed to ${getTimezoneDisplayName(tz)}`);
          // Update date input to New Year in new timezone using canonical wall-clock conversion
          const config = getModeConfig(initialState.mode);
          if (config.isWallClock) {
            const wallClockNewYear = createNextOccurrence(0, 1);
            const newYearDate = convertWallClockToAbsolute(wallClockNewYear, tz);
            dateInput.value = toLocalInputValue(newYearDate);
          }
        },
        onStart: options.onStart,
        announce,
      },
    };
  }

  function announce(message: string): void {
    statusRegion.textContent = message;
  }

  function setConfig(config: Partial<CountdownConfig>): void {
    formController?.setConfig(config, initialState);
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    // Clean up any active error toast
    clearActiveErrorToast();

    // Clean up form controller (handles timezone, theme selector, roving, and background manager)
    if (formController) {
      formController.destroy();
      formController = null;
    }

    if (shadowCalculatorController) {
      shadowCalculatorController.destroy();
      shadowCalculatorController = null;
    }

    // Clear controller references (already destroyed by form controller)
    timezoneSelectorController = null;
    themeSelectorController = null;
    backgroundManager = null;

    if (rootEl && containerRef?.contains(rootEl)) {
      rootEl.remove();
    } else {
      containerRef?.replaceChildren();
    }
    containerRef = null;
    rootEl = null;
  }

  function waitForBackgroundReady(): Promise<void> {
    return backgroundManager?.waitForReady() ?? Promise.resolve();
  }

  return { mount, destroy, setConfig, waitForBackgroundReady };
}
