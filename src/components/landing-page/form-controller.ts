/**
 * Landing Page Form Controller
 * Unified controller managing form state synchronization, user interactions, and component lifecycle.
 * Consolidates form-state and interaction-controller responsibilities.
 */

import { getModeConfig, MODE_ORDER } from '@core/config/mode-config';
import { convertWallClockToAbsolute, createNextOccurrence } from '@core/time/wall-clock-conversion';
import type { CountdownConfig, CountdownMode, ThemeId } from '@core/types';
import {
  createRovingTabindex,
  type RovingTabindexController,
} from '@core/utils/accessibility/roving-tabindex';

import type { ThemeSelectorController } from '../theme-picker/index';
import type { TimezoneSelectorController } from '../timezone-selector';
import type { BackgroundManagerController } from './background-manager';
import {
  createDurationPreviewHandler,
  createInputChangeHandler,
  createStartHandler,
  type EventHandlerContext,
} from './event-handlers';
import { getDateModeDefaultMessage } from './validation';

/**
 * References to form input elements.
 */
export interface FormElements {
  /** Datetime-local input for target date */
  dateInput: HTMLInputElement;
  /** Hours input for timer duration */
  hoursInput: HTMLInputElement;
  /** Minutes input for timer duration */
  minutesInput: HTMLInputElement;
  /** Seconds input for timer duration */
  secondsInput: HTMLInputElement;
  /** Textarea for completion message */
  completionMessageInput: HTMLTextAreaElement;
  /** Date/time input section container */
  dateSection: HTMLElement;
  /** Timer duration inputs section container */
  timerSection: HTMLElement;
  /** Timezone selector section container */
  timezoneSection: HTMLElement;
  /** World map toggle button container */
  worldMapToggle: HTMLElement;
  /** Start countdown button */
  startButton: HTMLButtonElement;
  /** Mode radio button elements by mode type */
  modeRadios: Record<CountdownMode, HTMLInputElement>;
  /** Mode selector fieldset container */
  modeFieldset: HTMLElement;
}

/**
 * Component controllers managed by the form controller.
 */
export interface ManagedControllers {
  /** Theme selector component controller (null if not initialized) */
  themeSelectorController: ThemeSelectorController | null;
  /** Timezone selector component controller (null if not initialized) */
  timezoneSelectorController: TimezoneSelectorController | null;
  /** Background manager for theme rendering (null if not initialized) */
  backgroundManager: BackgroundManagerController | null;
}

/**
 * Landing page state.
 */
export interface LandingPageFormState {
  /** Selected countdown mode (wall-clock, absolute, or timer) */
  mode: CountdownMode;
  /** Selected theme identifier */
  theme: ThemeId;
  /** IANA timezone identifier (e.g., 'America/New_York') */
  timezone: string;
  /** Whether world map should be shown during countdown */
  showWorldMap: boolean;
}

/**
 * Callbacks for form state changes.
 */
export interface FormControllerCallbacks {
  /** Invoked when user changes countdown mode */
  onModeChange: (mode: CountdownMode) => void;
  /** Invoked when user selects a different theme */
  onThemeChange: (theme: ThemeId) => void;
  /** Factory function creating event handler context with current state */
  createEventContext: () => EventHandlerContext;
}

/**
 * Unified form controller interface.
 */
export interface FormController {
  // State management
  /** Populate form fields from initial config and state */
  initializeForm(config: Partial<CountdownConfig> | undefined, state: LandingPageFormState): void;
  /** Update specific form fields from partial config */
  setConfig(config: Partial<CountdownConfig>, state: LandingPageFormState): void;
  /** Show/hide sections based on selected mode */
  toggleMode(mode: CountdownMode, state: LandingPageFormState): void;
  /** Update start button text based on mode */
  updateStartButtonLabel(mode: CountdownMode): void;
  
  // Interaction management
  /** Attach all event listeners to form elements */
  bindEvents(): void;
  /** Set up roving tabindex for mode selector keyboard navigation */
  initializeModeNavigation(initialMode: CountdownMode): void;
  /** Update focus to match currently selected mode */
  updateModeNavigation(mode: CountdownMode): void;
  /** Remove all event listeners and destroy managed controllers */
  destroy(): void;
  /** Get mode roving controller (testing utility) */
  getModeRovingController(): RovingTabindexController | null;
}

/**
 * Convert Date to datetime-local input format.
 * @param date - Date to convert
 * @returns Local datetime string (YYYY-MM-DDTHH:mm)
 */
export function toLocalInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Split total seconds into hours, minutes, and seconds for form display.
 * @param totalSeconds - Total duration in seconds
 * @returns Tuple of [hours, minutes, seconds] as strings
 */
function splitSecondsToFields(totalSeconds: number): [string, string, string] {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [String(hours), String(minutes), String(seconds)];
}

/**
 * Set visibility state for a form section with proper ARIA attributes.
 * @param section - Section element to update
 * @param isVisible - Whether section should be visible
 */
function setSectionVisibility(section: HTMLElement, isVisible: boolean): void {
  section.hidden = !isVisible;
  if (isVisible) {
    section.removeAttribute('inert');
    section.setAttribute('aria-hidden', 'false');
  } else {
    section.setAttribute('inert', 'true');
    section.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Create unified form controller for managing form fields and interactions.
 * @param elements - Form input element references
 * @param controllers - Component controller references
 * @param callbacks - State change callbacks
 * @returns Controller with initialize, bindEvents, and destroy methods
 */
export function createFormController(
  elements: FormElements,
  controllers: ManagedControllers,
  callbacks: FormControllerCallbacks
): FormController {
  let modeRovingController: RovingTabindexController | null = null;
  let boundHandlers: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];

  /**
   * Add an event listener and track it for cleanup.
   */
  function addTrackedListener(
    element: EventTarget,
    event: string,
    handler: EventListener
  ): void {
    element.addEventListener(event, handler);
    boundHandlers.push({ element, event, handler });
  }

  /**
   * Remove all tracked event listeners.
   */
  function removeTrackedListeners(): void {
    for (const { element, event, handler } of boundHandlers) {
      element.removeEventListener(event, handler);
    }
    boundHandlers = [];
  }

  return {
    // State management methods
    initializeForm(config: Partial<CountdownConfig> | undefined, state: LandingPageFormState): void {
      // Mode - ensure valid mode type for radio selection
      const requestedMode = state.mode;
      const safeMode: CountdownMode = MODE_ORDER.includes(requestedMode as CountdownMode)
        ? (requestedMode as CountdownMode)
        : MODE_ORDER[0];
      elements.modeRadios[safeMode].checked = true;
      this.toggleMode(safeMode, state);

      // Date input
      const wallClockNewYear = createNextOccurrence(0, 1);
      const initialDate = config?.targetDate ?? convertWallClockToAbsolute(wallClockNewYear, state.timezone);
      elements.dateInput.value = toLocalInputValue(initialDate);

      // Timer inputs
      if (config?.durationSeconds) {
        const [h, m, s] = splitSecondsToFields(config.durationSeconds);
        elements.hoursInput.value = h;
        elements.minutesInput.value = m;
        elements.secondsInput.value = s;
      }

      // Message - config stores plain text, use directly
      if (config?.completionMessage) {
        elements.completionMessageInput.value = config.completionMessage;
      }

      this.updateStartButtonLabel(safeMode);
    },

    setConfig(config: Partial<CountdownConfig>, state: LandingPageFormState): void {
      if (config.mode) {
        callbacks.onModeChange(config.mode);
        elements.modeRadios[config.mode].checked = true;
      }

      if (config.targetDate) {
        elements.dateInput.value = toLocalInputValue(config.targetDate);
      }

      if (typeof config.durationSeconds === 'number') {
        const [h, m, s] = splitSecondsToFields(config.durationSeconds);
        elements.hoursInput.value = h;
        elements.minutesInput.value = m;
        elements.secondsInput.value = s;
      }

      if (config.completionMessage) {
        // Config stores plain text, use directly
        elements.completionMessageInput.value = config.completionMessage;
      }

      if (config.theme) {
        state.theme = config.theme;
        if (controllers.themeSelectorController) {
          controllers.themeSelectorController.setSelected(config.theme);
        }
        callbacks.onThemeChange(config.theme);
      }

      if (config.timezone) {
        state.timezone = config.timezone;
        if (controllers.timezoneSelectorController) {
          controllers.timezoneSelectorController.setTimezone(config.timezone);
        }
      }

      if (typeof config.showWorldMap === 'boolean') {
        state.showWorldMap = config.showWorldMap;
        const toggleButton = elements.worldMapToggle.querySelector('.landing-map-toggle') as HTMLButtonElement;
        if (toggleButton) {
          toggleButton.classList.toggle('is-on', config.showWorldMap);
          toggleButton.setAttribute('aria-checked', config.showWorldMap ? 'true' : 'false');
        }
      }
    },

    toggleMode(mode: CountdownMode, state: LandingPageFormState): void {
      state.mode = mode;

      // Timer: only duration inputs
      // Absolute: date/time + timezone picker (no world map - same moment globally)
      // Wall-clock: date/time + timezone picker + world map
      const config = getModeConfig(mode);
      const showDateSection = config.hasDateInput;
      const showTimerSection = config.isDurationBased;
      const showTimezoneSection = config.timezoneRelevantDuringConfiguration;
      const showWorldMapToggle = config.worldMapAvailable;

      setSectionVisibility(elements.dateSection, showDateSection);
      setSectionVisibility(elements.timerSection, showTimerSection);
      setSectionVisibility(elements.timezoneSection, showTimezoneSection);
      setSectionVisibility(elements.worldMapToggle, showWorldMapToggle);
    },

    updateStartButtonLabel(mode: CountdownMode): void {
      const config = getModeConfig(mode);
      elements.startButton.setAttribute('aria-label', `Start ${mode} countdown`);
      elements.startButton.textContent = config.startButtonText;
    },

    // Interaction management methods
    initializeModeNavigation(initialMode: CountdownMode): void {
      // CRITICAL: Radio groups require special handling to work in Safari.
      // Only the checked radio has tabindex="0" (tabbable), others have tabindex="-1".
      // This creates a single tab stop while ensuring Safari can tab to the group.
      const initialIndex = MODE_ORDER.indexOf(initialMode);
      modeRovingController = createRovingTabindex({
        container: elements.modeFieldset,
        selector: 'input[type="radio"]',
        initialIndex,
        wrap: true, // Radio groups typically wrap
        orientation: 'horizontal', // Modes arranged horizontally
      });
    },

    updateModeNavigation(mode: CountdownMode): void {
      // Map mode to radio button index using MODE_ORDER
      const newIndex = MODE_ORDER.indexOf(mode);
      modeRovingController?.focusIndex(newIndex);
    },

    bindEvents(): void {
      const context = callbacks.createEventContext();

      // Mode change handlers
      addTrackedListener(elements.modeRadios['wall-clock'], 'change', () => {
        callbacks.onModeChange('wall-clock');
      });
      addTrackedListener(elements.modeRadios.absolute, 'change', () => {
        callbacks.onModeChange('absolute');
      });
      addTrackedListener(elements.modeRadios.timer, 'change', () => {
        callbacks.onModeChange('timer');
      });

      // Start button handler
      const startHandler = createStartHandler(context);
      addTrackedListener(elements.startButton, 'click', startHandler);

      // Input change handlers to clear validation errors
      const dateChangeHandler = createInputChangeHandler(context, 'date');
      addTrackedListener(elements.dateInput, 'input', dateChangeHandler);

      // Update completion message placeholder based on whether target is New Year's midnight
      const datePlaceholderHandler = () => {
        const dateValue = elements.dateInput.value;
        if (dateValue) {
          const targetDate = new Date(dateValue);
          if (!isNaN(targetDate.getTime())) {
            elements.completionMessageInput.placeholder = getDateModeDefaultMessage(targetDate);
          }
        }
      };
      addTrackedListener(elements.dateInput, 'input', datePlaceholderHandler);
      // Also update on initial load
      datePlaceholderHandler();

      const durationChangeHandler = createInputChangeHandler(context, 'duration');
      addTrackedListener(elements.hoursInput, 'input', durationChangeHandler);
      addTrackedListener(elements.minutesInput, 'input', durationChangeHandler);
      addTrackedListener(elements.secondsInput, 'input', durationChangeHandler);

      // Duration preview handlers (debounced)
      const durationPreviewHandler = createDurationPreviewHandler(context);
      addTrackedListener(elements.hoursInput, 'input', durationPreviewHandler);
      addTrackedListener(elements.minutesInput, 'input', durationPreviewHandler);
      addTrackedListener(elements.secondsInput, 'input', durationPreviewHandler);

      // NOTE: Timezone and theme selection events are handled by their respective component controllers
    },

    destroy(): void {
      // Remove tracked event listeners
      removeTrackedListeners();

      // Clean up timezone selector controller
      if (controllers.timezoneSelectorController) {
        controllers.timezoneSelectorController.destroy();
        controllers.timezoneSelectorController = null;
      }

      // Clean up theme selector controller
      if (controllers.themeSelectorController) {
        controllers.themeSelectorController.destroy();
        controllers.themeSelectorController = null;
      }

      // Clean up mode roving tabindex controller
      if (modeRovingController) {
        modeRovingController.destroy();
        modeRovingController = null;
      }

      // Clean up background manager
      if (controllers.backgroundManager) {
        controllers.backgroundManager.destroy();
        controllers.backgroundManager = null;
      }
    },

    getModeRovingController(): RovingTabindexController | null {
      return modeRovingController;
    },
  };
}
