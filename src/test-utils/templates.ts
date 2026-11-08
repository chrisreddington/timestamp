/**
 * Template HTML strings for JSDOM test environment.
 *
 * These templates mirror those in index.html and are injected into the DOM
 * before tests run. This allows template-based components to work in JSDOM.
 *
 * @remarks
 * Templates are defined once in index.html (source of truth).
 * This file exports the same HTML for test injection.
 * When adding templates to index.html, add matching strings here.
 *
 * Templates are injected into document.head (not body) to survive
 * cleanupDOM() calls that clear document.body.innerHTML.
 */

/**
 * Completion message section template.
 * Used by landing-page/dom-builders.ts buildCompletionMessageSection()
 */
export const COMPLETION_MESSAGE_TEMPLATE = `
<template id="completion-message-template">
  <section class="landing-form-section landing-message-section" data-testid="landing-message-section">
    <div class="landing-section-title" id="landing-message-label">Completion Message</div>
    <textarea 
      id="landing-completion-message"
      class="landing-message-input"
      data-testid="landing-completion-message"
      aria-labelledby="landing-message-label"
      maxlength="200"
      placeholder="Leave blank for default message"
    ></textarea>
  </section>
</template>`;

/**
 * Search section template for theme picker.
 * Used by theme-picker/search-section.ts buildSearchSection()
 */
export const SEARCH_SECTION_TEMPLATE = `
<template id="search-section-template">
  <div class="theme-selector-search-section">
    <input
      type="search"
      id="theme-search"
      class="theme-selector-search-input"
      placeholder="Search by name or author..."
      aria-label="Search themes"
      aria-describedby="search-hint"
      data-testid="theme-search-input"
    />
    <span id="search-hint" class="sr-only">
      Type to filter themes. Use arrow keys to navigate results.
    </span>
  </div>
</template>`;

/**
 * Theme grid container template.
 * Used by theme-picker/containers.ts buildThemesContainer()
 */
export const THEMES_CONTAINER_TEMPLATE = `
<template id="themes-container-template">
  <div
    class="theme-selector-grid"
    data-testid="theme-selector-grid"
    role="grid"
    aria-label="Theme selector"
    aria-rowcount="0"
  ></div>
</template>`;

/**
 * Sentinel element template for lazy loading.
 * Used by theme-picker/containers.ts createSentinel()
 */
export const SENTINEL_TEMPLATE = `
<template id="sentinel-template">
  <div class="theme-selector-sentinel" data-testid="theme-selector-sentinel"></div>
</template>`;

/**
 * Results count live region template.
 * Used by theme-picker/search-section.ts buildResultsCount()
 */
export const RESULTS_COUNT_TEMPLATE = `
<template id="results-count-template">
  <div
    class="theme-selector-results-count"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  ></div>
</template>`;

/**
 * Date section template for landing page.
 * Used by landing-page/dom-builders.ts buildDateSection()
 */
export const DATE_SECTION_TEMPLATE = `
<template id="date-section-template">
  <section class="landing-form-section" data-testid="landing-date-section">
    <div class="landing-section-title" id="landing-date-label">
      Target Date &amp; Time
    </div>
    <input 
      type="datetime-local" 
      id="landing-date-picker"
      class="landing-date-input"
      data-testid="landing-date-picker"
      aria-labelledby="landing-date-label"
      aria-describedby="landing-date-error"
      required
    />
    <span 
      id="landing-date-error" 
      class="landing-field-error" 
      role="alert"
      hidden
    ></span>
  </section>
</template>`;

/**
 * Timer section template for landing page.
 * Used by landing-page/dom-builders.ts buildTimerSection()
 */
export const TIMER_SECTION_TEMPLATE = `
<template id="timer-section-template">
  <section class="landing-form-section" data-testid="landing-timer-section">
    <div class="landing-section-title">Duration</div>
    <div class="landing-duration-group">
      <div class="landing-duration-field">
        <input 
          type="number" 
          class="landing-duration-input"
          min="0"
          step="1"
          placeholder="00"
          data-testid="landing-duration-hours"
          aria-label="Hours"
          aria-describedby="landing-duration-error"
        />
        <span class="landing-duration-label">Hours</span>
      </div>
      <div class="landing-duration-field">
        <input 
          type="number" 
          class="landing-duration-input"
          min="0"
          step="1"
          placeholder="00"
          data-testid="landing-duration-minutes"
          aria-label="Minutes"
          aria-describedby="landing-duration-error"
        />
        <span class="landing-duration-label">Minutes</span>
      </div>
      <div class="landing-duration-field">
        <input 
          type="number" 
          class="landing-duration-input"
          min="0"
          step="1"
          placeholder="00"
          data-testid="landing-duration-seconds"
          aria-label="Seconds"
          aria-describedby="landing-duration-error"
        />
        <span class="landing-duration-label">Seconds</span>
      </div>
    </div>
    <div 
      id="landing-duration-preview"
      class="landing-duration-preview"
      data-testid="landing-duration-preview"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden="true"
    ></div>
    <span 
      id="landing-duration-error" 
      class="landing-field-error" 
      role="alert"
      hidden
    ></span>
  </section>
</template>`;

/**
 * Share menu template for countdown buttons.
 * Used by countdown-buttons/share/share-menu-dom.ts createShareMenuDOM()
 */
export const SHARE_MENU_TEMPLATE = `
<template id="share-menu-template">
  <div class="share-menu-container" data-testid="share-menu">
    <button 
      type="button"
      class="countdown-button share-button share-menu-trigger"
      data-testid="share-button"
      aria-label="Copy countdown URL to clipboard"
      aria-haspopup="menu"
      aria-expanded="false"
      tabindex="0"
    >
      <span class="share-menu-button-text">Share</span>
    </button>
    <div class="share-menu-dropdown" role="menu" aria-label="Share options">
      <button type="button" role="menuitem" data-testid="share-selected-timezone" data-original-label="Selected timezone" tabindex="-1" class="share-menu-item">
        <span class="share-menu-item-label">Selected timezone</span>
      </button>
      <button type="button" role="menuitem" data-testid="share-local-timezone" data-original-label="My local timezone" tabindex="-1" class="share-menu-item">
        <span class="share-menu-item-label">My local timezone</span>
      </button>
      <button type="button" role="menuitem" data-testid="share-without-timezone" data-original-label="Their timezone" tabindex="-1" class="share-menu-item">
        <span class="share-menu-item-label">Their timezone</span>
      </button>
    </div>
  </div>
</template>`;

/**
 * Simple share button template for timer/absolute modes.
 * Used by countdown-buttons/share/share-button.ts createSimpleShareButton()
 */
export const SIMPLE_SHARE_BUTTON_TEMPLATE = `
<template id="simple-share-button-template">
  <button 
    type="button"
    tabindex="0"
    class="countdown-button share-button"
    data-testid="share-button"
    aria-label="Copy countdown URL to clipboard"
  >
    <span class="share-button-text">Share</span>
  </button>
</template>`;

/**
 * Mobile menu hamburger button template.
 * Used by mobile-menu/index.ts createHamburgerButton()
 */
export const MOBILE_MENU_BUTTON_TEMPLATE = `
<template id="mobile-menu-button-template">
  <button 
    type="button"
    tabindex="0"
    class="mobile-menu-button"
    data-testid="mobile-menu-button"
    aria-label="Open menu"
    aria-expanded="false"
    aria-haspopup="dialog"
  ></button>
</template>`;

/**
 * Mobile menu overlay template.
 * Used by mobile-menu/index.ts createOverlay()
 */
export const MOBILE_MENU_OVERLAY_TEMPLATE = `
<template id="mobile-menu-overlay-template">
  <div class="mobile-menu-overlay" data-testid="mobile-menu-overlay" role="dialog" aria-modal="true" aria-label="Countdown options">
    <div class="mobile-menu-header">
      <h2 class="mobile-menu-title">Countdown Options</h2>
      <button class="mobile-menu-close" data-testid="mobile-menu-close" aria-label="Close menu" tabindex="0"></button>
    </div>
    <div class="mobile-menu-content" data-testid="mobile-menu-content">
      <section class="mobile-menu-section" data-section="actions" aria-label="Actions"></section>
      <section class="mobile-menu-section" data-section="colormode" aria-label="Color Mode"></section>
      <section class="mobile-menu-section" data-section="timezone" aria-label="Timezone"></section>
      <section class="mobile-menu-section" data-section="worldmap" aria-label="World Map"></section>
    </div>
  </div>
</template>`;

/**
 * Color mode toggle template.
 * Used by color-mode-toggle/color-mode-toggle.ts createColorModeToggle()
 */
export const COLOR_MODE_TOGGLE_TEMPLATE = `
<template id="color-mode-toggle-template">
  <div class="color-mode-toggle" data-testid="color-mode-toggle">
    <div class="color-mode-toggle-group" role="radiogroup" aria-label="Color mode">
      <button type="button" class="color-mode-toggle-option" data-testid="color-mode-toggle-light" data-mode="light" role="radio" aria-checked="false" tabindex="-1">
        <span class="color-mode-toggle-label">Light</span>
      </button>
      <button type="button" class="color-mode-toggle-option" data-testid="color-mode-toggle-dark" data-mode="dark" role="radio" aria-checked="false" tabindex="-1">
        <span class="color-mode-toggle-label">Dark</span>
      </button>
      <button type="button" class="color-mode-toggle-option" data-testid="color-mode-toggle-system" data-mode="system" role="radio" aria-checked="false" tabindex="-1">
        <span class="color-mode-toggle-label">System</span>
      </button>
    </div>
  </div>
</template>`;

/**
 * Timezone selector shell template.
 * Used by timezone-selector/dom-builders.ts buildSelectorDOM()
 */
export const TIMEZONE_SELECTOR_TEMPLATE = `
<template id="timezone-selector-template">
  <div class="timezone-selector">
    <button type="button" class="timezone-selector-trigger" data-testid="timezone-selector-trigger" aria-haspopup="listbox" aria-expanded="false" tabindex="0">
      <div class="selector-text">
        <span class="selector-label">Timezone</span>
        <span class="selector-value"></span>
      </div>
    </button>
    <div class="timezone-dropdown" role="listbox" hidden>
      <div class="dropdown-search">
        <input type="search" class="search-input" placeholder="Search timezones..." aria-label="Search timezones" />
      </div>
      <div class="dropdown-list" data-testid="timezone-dropdown-list"></div>
    </div>
  </div>
</template>`;

/**
 * PWA install dialog template.
 * Used by pwa/install-prompt/dom-builders.ts createDialog()
 */
export const PWA_INSTALL_DIALOG_TEMPLATE = `
<template id="pwa-install-dialog-template">
  <div class="install-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="install-prompt-title" aria-describedby="install-prompt-description">
    <h2 id="install-prompt-title" class="install-prompt-title">Install Timestamp</h2>
    <p id="install-prompt-description" class="install-prompt-description"></p>
    <div class="install-prompt-button-container"></div>
  </div>
</template>`;

/**
 * Timer controls template.
 * Used by countdown-buttons/timer-controls.ts createTimerControls()
 */
export const TIMER_CONTROLS_TEMPLATE = `
<template id="timer-controls-template">
  <div class="timer-controls" data-testid="timer-controls">
    <span aria-live="polite" aria-atomic="true" class="sr-only"></span>
    <button type="button" class="countdown-button countdown-button--icon-only timer-control-button" data-testid="timer-play-pause" aria-label="Pause timer" aria-pressed="false" tabindex="0"></button>
    <button type="button" class="countdown-button countdown-button--icon-only timer-control-button" data-testid="timer-reset" aria-label="Reset timer to original duration" tabindex="0"></button>
  </div>
</template>`;

/**
 * Offline indicator template.
 * Used by pwa/offline-indicator.ts createOfflineIndicator()
 */
export const OFFLINE_INDICATOR_TEMPLATE = `
<template id="offline-indicator-template">
  <div class="offline-indicator" role="status" aria-live="polite" aria-atomic="true" data-testid="offline-indicator">
    <span class="offline-indicator__icon" aria-hidden="true"></span>
    <span></span>
  </div>
</template>`;

/**
 * Mode selector template for landing page.
 * Used by landing-page/dom-builders.ts buildModeSelector()
 */
export const MODE_SELECTOR_TEMPLATE = `
<template id="mode-selector-template">
  <fieldset class="landing-mode-fieldset" data-testid="landing-mode-selector">
    <legend>Mode</legend>
    <div class="landing-mode-group"></div>
  </fieldset>
</template>`;

/**
 * Landing footer template.
 * Used by landing-page/dom-builders.ts buildFooter()
 */
export const LANDING_FOOTER_TEMPLATE = `
<template id="landing-footer-template">
  <footer class="landing-footer" data-testid="landing-footer">
    <div class="landing-footer-content">
      <div class="landing-footer-attribution">
        Made with ❤️ by 
        <a href="https://chrisreddington.com" target="_blank" rel="noopener noreferrer">Chris Reddington</a>
        and
        <a href="https://github.com/features/copilot" target="_blank" rel="noopener noreferrer" class="landing-footer-copilot-link"></a>
      </div>
      
      <div class="landing-footer-powered">
        <div class="landing-footer-powered-label">Powered by</div>
        <div class="landing-footer-tech-list"></div>
      </div>
      
      <div class="landing-footer-repo">
        <a href="https://github.com/chrisreddington/timestamp" target="_blank" rel="noopener noreferrer" class="landing-footer-repo-link landing-footer-star-link" data-testid="landing-footer-star-link">
          <span>Star on GitHub</span>
        </a>
        <a href="https://github.com/chrisreddington/timestamp/blob/main/docs/THEME_DEVELOPMENT.md" target="_blank" rel="noopener noreferrer" class="landing-footer-repo-link landing-footer-theme-link">
          <span>Contribute a Theme</span>
        </a>
        <a href="third-party-licenses.txt" target="_blank" rel="noopener" class="landing-footer-repo-link" data-testid="landing-footer-licenses-link">
          <span>Third-party licenses</span>
        </a>
      </div>
    </div>
  </footer>
</template>`;

/**
 * Theme modal template for picker dialog.
 * Used by theme-picker/picker-modal.ts buildModal()
 */
export const THEME_MODAL_TEMPLATE = `
<template id="theme-modal-template">
  <div class="theme-modal-overlay" data-testid="theme-modal-overlay">
    <div class="theme-modal" role="dialog" aria-modal="true" data-testid="theme-modal">
      <div class="theme-modal-header">
        <h2 id="theme-modal-title" class="theme-modal-title">Select Theme</h2>
        <button type="button" class="theme-modal-close" aria-label="Close theme selector" data-testid="theme-modal-close"></button>
      </div>
      <div class="theme-modal-body"></div>
    </div>
  </div>
</template>`;

/**
 * Contribute card template for theme picker grid.
 * Used by theme-picker/cards.ts createContributeCard()
 */
export const CONTRIBUTE_CARD_TEMPLATE = `
<template id="contribute-card-template">
  <div class="contribute-theme-row" role="row" data-testid="contribute-theme-card">
    <div class="contribute-theme-cell" role="gridcell">
      <a class="contribute-theme-card" href="https://github.com/chrisreddington/timestamp/blob/main/docs/THEME_DEVELOPMENT.md" target="_blank" rel="noopener noreferrer" aria-label="Contribute a theme - view theme development guide (opens in new tab)" tabindex="-1">
        <div class="contribute-theme-icon" aria-hidden="true"></div>
        <div class="contribute-theme-content">
          <span class="contribute-theme-title">Contribute a theme</span>
        </div>
      </a>
    </div>
  </div>
</template>`;

/**
 * Toast stack container template.
 * Used by toast/dom-builders.ts createToastStackContainer()
 */
export const TOAST_STACK_TEMPLATE = `
<template id="toast-stack-template">
  <div class="toast-stack" aria-label="Notifications" data-testid="toast-stack"></div>
</template>`;

/**
 * Toast element template.
 * Used by toast/dom-builders.ts createToastElement()
 */
export const TOAST_ELEMENT_TEMPLATE = `
<template id="toast-element-template">
  <div class="toast" role="status" aria-live="polite">
    <div class="toast__content">
      <span class="toast__icon" aria-hidden="true"></span>
      <span class="toast__message"></span>
    </div>
    <div class="toast__actions"></div>
  </div>
</template>`;

/**
 * World map template.
 * Used by world-map/index.ts createWorldMap()
 */
export const WORLD_MAP_TEMPLATE = `
<template id="world-map-template">
  <figure class="world-map-wrapper" data-testid="world-map" role="group" aria-label="World map showing day and night regions with city markers indicating countdown celebration status">
    <div class="world-map-container">
      <svg class="world-map" viewBox="0 0 400 200" aria-hidden="true" data-testid="world-map-svg">
        <!-- Subtle grid for reference -->
        <g class="map-grid">
          <line x1="0" y1="100" x2="400" y2="100" />
          <line x1="100" y1="0" x2="100" y2="200" />
          <line x1="200" y1="0" x2="200" y2="200" />
          <line x1="300" y1="0" x2="300" y2="200" />
        </g>
        
        <!-- Continent shapes (d attribute set via JS) -->
        <g class="continents">
          <path class="continent" d="" />
        </g>
        
        <!-- Night overlay - updated dynamically -->
        <path class="night-overlay" d="" data-testid="night-overlay" />
      </svg>
      
      <!-- City markers overlay -->
      <div class="city-markers" data-testid="city-markers"></div>
    </div>
  </figure>
</template>`;

/**
 * Tooltip template.
 * Used by tooltip/tooltip.ts createTooltip()
 */
export const TOOLTIP_TEMPLATE = `
<template id="tooltip-template">
  <div class="tooltip" role="tooltip" aria-hidden="true"></div>
</template>`;

/**
 * All templates as a single string for injection.
 * Import and use in vitest.setup.ts to inject all templates at once.
 */
export const ALL_TEMPLATES = [
  COMPLETION_MESSAGE_TEMPLATE,
  SEARCH_SECTION_TEMPLATE,
  THEMES_CONTAINER_TEMPLATE,
  SENTINEL_TEMPLATE,
  RESULTS_COUNT_TEMPLATE,
  DATE_SECTION_TEMPLATE,
  TIMER_SECTION_TEMPLATE,
  SHARE_MENU_TEMPLATE,
  SIMPLE_SHARE_BUTTON_TEMPLATE,
  MOBILE_MENU_BUTTON_TEMPLATE,
  MOBILE_MENU_OVERLAY_TEMPLATE,
  COLOR_MODE_TOGGLE_TEMPLATE,
  TIMEZONE_SELECTOR_TEMPLATE,
  PWA_INSTALL_DIALOG_TEMPLATE,
  TIMER_CONTROLS_TEMPLATE,
  OFFLINE_INDICATOR_TEMPLATE,
  MODE_SELECTOR_TEMPLATE,
  LANDING_FOOTER_TEMPLATE,
  THEME_MODAL_TEMPLATE,
  CONTRIBUTE_CARD_TEMPLATE,
  TOAST_STACK_TEMPLATE,
  TOAST_ELEMENT_TEMPLATE,
  WORLD_MAP_TEMPLATE,
  TOOLTIP_TEMPLATE,
].join('\n');

/** Marker ID for the template container in document.head */
const TEMPLATE_CONTAINER_ID = 'test-templates-container';

/**
 * Inject all templates into document.head.
 * Using head instead of body ensures templates survive cleanupDOM() calls.
 * Call this in vitest.setup.ts or in individual test files.
 */
export function injectTemplates(): void {
  // Skip if already injected
  if (document.getElementById(TEMPLATE_CONTAINER_ID)) {
    return;
  }

  const container = document.createElement('div');
  container.id = TEMPLATE_CONTAINER_ID;
  container.innerHTML = ALL_TEMPLATES;

  // Inject into head to survive body.innerHTML = '' cleanup
  document.head.appendChild(container);
}

/**
 * Remove injected templates from document.head.
 * Call this in afterEach cleanup if needed.
 */
export function removeTemplates(): void {
  const container = document.getElementById(TEMPLATE_CONTAINER_ID);
  if (container) {
    container.remove();
  }
}
