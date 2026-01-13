/**
 * Theme Picker - searchable, keyboard-accessible UI for selecting countdown themes.
 * Features tabbed interface (All/Favorites), progressive rendering, search/sort, and accessibility.
 * Includes picker button for runtime theme switching and modal dialog wrapper.
 */

import '../../styles/components/theme-selector.scss';

import { getResolvedColorMode } from '@core/preferences/color-mode';
import type { ThemeId } from '@core/types';
import { createVisuallyHiddenElement } from '@core/utils/accessibility';
import {
  createRovingTabindex,
  type RovingTabindexController,
} from '@core/utils/accessibility/roving-tabindex';
import { getThemeDisplayName } from '@themes/registry';
import { getPreviewUrls } from '@themes/registry/preview-map';

import {
  buildResultsCount,
  buildSearchSection,
  buildThemesContainer,
  createContributeCard,
  createSentinel,
  createThemeCard,
  destroyAllTooltips,
  setupColorModeVideoListener,
  updateFavoriteButton,
  updateVideosForColorMode,
} from './card-builder';
import {
  getCurrentFavorites,
  toggleThemeFavorite,
} from './favorites-manager';
import {
  createCardKeydownHandler,
  createSearchKeydownHandler,
} from './keyboard-nav';
import {
  filterThemes,
  getResultsCountText,
  handleSearchInput,
} from './search-filter';
import { buildSortDropdown } from './sort-dropdown';
import { getDefaultSortConfig, sortThemes } from './sort-themes';
import { buildTabList, buildTabPanel, type TabController, type TabPanelController } from './tabs';
import type {
  ThemeSelectorController,
  ThemeSelectorOptions,
  ThemeSelectorState,
  ThemeSortConfig,
  ThemeTab,
} from './types';

export { createThemePicker } from './picker-button';
export type { ThemeSwitcherController as ThemePickerController, ThemeSwitcherOptions as ThemePickerOptions } from './picker-button';
export type { ModalController, ThemeSwitcherModalOptions as ThemePickerModalOptions } from './picker-modal';
export type { ThemeSelectorController, ThemeSelectorOptions } from './types';

/** Number of cards to render immediately */
const INITIAL_RENDER_COUNT = 12;
/** Selector for grid rows (theme cards and contribute card) */
const ROVING_ITEM_SELECTOR = '[role="row"]';
/** Debounce for screen reader announcements (ms) */
const ANNOUNCE_DEBOUNCE_MS = 100;
/** Delay before resetting announcement text (ms) - allows screen readers to finish reading */
const ANNOUNCEMENT_RESET_DELAY_MS = 3000;

/**
 * Debounce timeout for aria-live announcements.
 * Prevents duplicate announcements when multiple state changes occur in the same tick.
 */
let announceTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Create a theme selector component.
 * @returns Controller for managing the theme selector
 */
export function createThemeSelector(
  options: ThemeSelectorOptions
): ThemeSelectorController {
  const state: ThemeSelectorState = {
    currentTheme: options.currentTheme,
    searchQuery: '',
    focusedIndex: -1,
    filteredThemes: [],
    favorites: getCurrentFavorites(),
    sortConfig: getDefaultSortConfig(),
    activeTab: 'themes',
  };

  let rootEl: HTMLElement | null = null;
  let searchInput: HTMLInputElement | null = null;
  let resultsCountEl: HTMLElement | null = null;
  let themesContainer: HTMLElement | null = null;
  let favoritesContainer: HTMLElement | null = null;
  let observer: IntersectionObserver | null = null;
  let rovingController: RovingTabindexController | null = null;
  let sortDropdown: { container: HTMLElement; trigger: HTMLButtonElement; updateSort: (config: ThemeSortConfig) => void; destroy: () => void } | null = null;
  let sortButton: HTMLButtonElement | null = null;
  let tabController: TabController | null = null;
  let themesPanel: TabPanelController | null = null;
  let favoritesPanel: TabPanelController | null = null;
  let ariaLiveRegion: HTMLElement | null = null;

  const handleSearchKeydown = createSearchKeydownHandler(
    () => rovingController,
    () => state.filteredThemes.length + 1,
    () => sortButton
  );

  const handleCardKeydown = createCardKeydownHandler(
    handleCardClick,
    () => searchInput,
    handleFavoriteToggle,
    () => rovingController
  );

  /**
   * Announce message to screen readers via aria-live region (debounced).
   * @param message - Message to announce
   */
  function announce(message: string): void {
    if (!ariaLiveRegion) return;

    // Clear any pending announcement
    if (announceTimeout) {
      clearTimeout(announceTimeout);
      announceTimeout = null;
    }

    announceTimeout = setTimeout(() => {
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = message;
      }
      announceTimeout = null;
    }, ANNOUNCE_DEBOUNCE_MS);
  }

  /** Build root element structure. @returns Root element with all UI components */
  function buildElement(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'theme-selector';
    root.setAttribute('data-testid', 'theme-selector');

    ariaLiveRegion = createVisuallyHiddenElement('div', {
      role: 'status',
      ariaLive: 'polite',
      ariaAtomic: true,
      applyInlineStyles: true,
    });

    const searchResult = buildSearchSection(handleSearchInputChange, handleSearchKeydown);
    searchInput = searchResult.searchInput;

    sortDropdown = buildSortDropdown(state.sortConfig, handleSortChange);
    sortButton = sortDropdown.trigger;

    const searchSortRow = document.createElement('div');
    searchSortRow.className = 'theme-selector-search-sort-row';
    searchSortRow.append(searchResult.section, sortDropdown.container);

    resultsCountEl = buildResultsCount();

    tabController = buildTabList({
      tabs: [
        { id: 'themes', label: 'All Themes', selected: state.activeTab === 'themes' },
        { id: 'favorites', label: 'Favorites', selected: state.activeTab === 'favorites' },
      ],
      onTabChange: handleTabChange,
    });

    themesContainer = buildThemesContainer();
    themesPanel = buildTabPanel({
      id: 'themes',
      visible: state.activeTab === 'themes',
      content: themesContainer,
    });

    favoritesContainer = buildThemesContainer();
    favoritesPanel = buildTabPanel({
      id: 'favorites',
      visible: state.activeTab === 'favorites',
      content: favoritesContainer,
    });

    root.append(
      ariaLiveRegion,
      searchSortRow,
      resultsCountEl,
      tabController.getTabList(),
      themesPanel.getPanel(),
      favoritesPanel.getPanel()
    );
    rootEl = root;

    filterThemes(state);
    applySorting();
    renderActiveTab();
    
    // Set up listener for color mode changes to update video previews
    setupColorModeVideoListener();

    return root;
  }

  /**
   * Handle tab change.
   * @param tabId - Tab identifier to activate
   */
  function handleTabChange(tabId: ThemeTab): void {
    state.activeTab = tabId;
    
    if (tabId === 'themes') {
      themesPanel?.show();
      favoritesPanel?.hide();
    } else {
      favoritesPanel?.show();
      themesPanel?.hide();
    }

    renderActiveTab();
  }

  /**
   * Handle sort configuration change.
   * @param config - New sort configuration
   */
  function handleSortChange(config: ThemeSortConfig): void {
    state.sortConfig = config;
    applySorting();
    renderActiveTab();
  }

  /** Apply current sort configuration to filtered themes. */
  function applySorting(): void {
    state.filteredThemes = sortThemes(state.filteredThemes, state.sortConfig);
  }

  /** Handle search input changes. */
  function handleSearchInputChange(): void {
    handleSearchInput(searchInput, state);
    filterThemes(state);
    applySorting();
    renderActiveTab();
  }

  /** Update results count screen reader announcement. */
  function updateResultsCount(): void {
    if (!resultsCountEl) return;
    resultsCountEl.textContent = getResultsCountText(state);
  }

  /** Render active tab content. */
  function renderActiveTab(): void {
    if (state.activeTab === 'themes') {
      renderAllThemes();
    } else {
      renderFavorites();
    }
    updateResultsCount();
  }

  /** Render all themes in Themes tab. */
  function renderAllThemes(): void {
    if (!themesContainer) return;

    themesContainer.innerHTML = '';

    state.filteredThemes.slice(0, INITIAL_RENDER_COUNT).forEach((themeId, index) => {
      const isLcpCandidate = index === 0;
      const card = createThemeCard(
        themeId,
        index,
        state.currentTheme,
        handleCardClick,
        handleFavoriteToggle,
        handleCardKeydown,
        isLcpCandidate
      );
      themesContainer!.appendChild(card);
    });

    if (state.filteredThemes.length > INITIAL_RENDER_COUNT) {
      const sentinel = createSentinel();
      themesContainer.appendChild(sentinel);

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            renderRemainingThemes(
              INITIAL_RENDER_COUNT,
              state.filteredThemes.slice(INITIAL_RENDER_COUNT)
            );
            observer?.disconnect();
          }
        });
      });

      observer.observe(sentinel);
    }

    const contributeCard = createContributeCard();
    themesContainer.appendChild(contributeCard);

    initRovingTabindex();
  }

  /** Render favorites in Favorites tab. */
  function renderFavorites(): void {
    if (!favoritesContainer) return;

    favoritesContainer.innerHTML = '';

    const favoriteThemes = state.filteredThemes.filter((id) =>
      state.favorites.includes(id)
    );

    if (favoriteThemes.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'theme-selector-empty-state';
      emptyMessage.setAttribute('data-testid', 'theme-selector-empty-state');
      emptyMessage.textContent = 'Mark your favorites with ❤️';
      emptyMessage.style.cssText = `
        text-align: center;
        padding: 48px 24px;
        color: var(--color-text-muted);
        font-size: 16px;
      `;

      const contributeCard = createContributeCard();
      favoritesContainer.appendChild(emptyMessage);
      favoritesContainer.appendChild(contributeCard);
    } else {
      favoriteThemes.forEach((themeId, index) => {
        const card = createThemeCard(
          themeId,
          index,
          state.currentTheme,
          handleCardClick,
          handleFavoriteToggle,
          handleCardKeydown
        );
        favoritesContainer!.appendChild(card);
      });

      const contributeCard = createContributeCard();
      favoritesContainer.appendChild(contributeCard);
    }

    initRovingTabindex();
  }

  /**
   * Render remaining themes (called via IntersectionObserver).
   * @param startIndex - Starting index for theme array
   * @param themes - Array of theme IDs to render
   */
  function renderRemainingThemes(
    startIndex: number,
    themes: ThemeId[]
  ): void {
    if (!themesContainer) return;

    const sentinel = themesContainer.querySelector('.theme-selector-sentinel');
    if (sentinel) {
      sentinel.remove();
    }

    themes.forEach((themeId, index) => {
      const globalIndex = startIndex + index;
      const card = createThemeCard(
        themeId,
        globalIndex,
        state.currentTheme,
        handleCardClick,
        handleFavoriteToggle,
        handleCardKeydown
      );
      themesContainer!.appendChild(card);
    });

    rovingController?.refresh();
  }

  /**
   * Handle favorite toggle. When item is moved, focus stays on next item in original position.
   * @param themeId - Theme identifier
   * @param button - Button element that was clicked
   */
  function handleFavoriteToggle(themeId: ThemeId, button: HTMLElement): void {
    const result = toggleThemeFavorite(themeId);

    updateFavoriteButton(button, result.isFavorite);

    const name = getThemeDisplayName(themeId);
    const action = result.isFavorite ? 'Favorited' : 'Unfavorited';
    announce(`${action} ${name}`);

    if (result.announcement && resultsCountEl) {
      resultsCountEl.textContent = result.announcement;
      setTimeout(() => updateResultsCount(), ANNOUNCEMENT_RESET_DELAY_MS);
    }

    state.favorites = getCurrentFavorites();

    if (state.activeTab === 'favorites') {
      renderActiveTab();
      if (rovingController) {
        const activeContainer = favoritesContainer;
        const totalItems = activeContainer?.querySelectorAll(ROVING_ITEM_SELECTOR).length ?? 0;
        const newIndex = Math.min(state.focusedIndex, Math.max(0, totalItems - 1));
        rovingController.focusIndex(newIndex);
      }
    }
  }

  /**
   * Handle card click.
   * @param themeId - Theme identifier
   */
  function handleCardClick(themeId: ThemeId): void {
    setSelected(themeId);
    options.onSelect(themeId);
    
    const name = getThemeDisplayName(themeId);
    announce(`Selected ${name}`);
  }

  /**
   * Initialize roving tabindex controller for active tab.
   * @remarks Grid Pattern: roving tabindex manages focus across rows
   */
  function initRovingTabindex(): void {
    if (rovingController) {
      rovingController.destroy();
      rovingController = null;
    }

    const activeContainer = state.activeTab === 'themes' ? themesContainer : favoritesContainer;
    if (!activeContainer) return;

    const initialIndex = 0;

    const selector = '[role="row"] > [role="gridcell"]:first-child:is([tabindex]), [role="row"] > [role="gridcell"]:first-child:not([tabindex]) > a';
    
    rovingController = createRovingTabindex({
      container: activeContainer,
      selector,
      initialIndex,
      wrap: false,
      orientation: 'vertical',
      useActivedescendant: false,
      onFocusChange: (index) => {
        state.focusedIndex = index;
      },
    });
  }

  /**
   * Set selected theme.
   * @param themeId - Theme identifier
   */
  function setSelected(themeId: ThemeId): void {
    state.currentTheme = themeId;

    const allCards = rootEl?.querySelectorAll('.theme-selector-card');
    allCards?.forEach((card) => {
      const row = card.closest('[role="row"]');
      const cardThemeId = row?.getAttribute('data-theme-id');
      const isSelected = cardThemeId === themeId;
      card.setAttribute('aria-selected', isSelected ? 'true' : 'false');

      if (isSelected) {
        card.classList.add('theme-selector-card--selected');
      } else {
        card.classList.remove('theme-selector-card--selected');
      }
    });
  }

  /** Get root element. @returns Root element (builds if not yet created) */
  function getElement(): HTMLElement {
    if (!rootEl) {
      return buildElement();
    }
    return rootEl;
  }

  /** Update theme card preview images and videos based on current color mode. */
  function updateColorMode(): void {
    if (!rootEl) return;

    const colorMode = getResolvedColorMode();
    const cards = rootEl.querySelectorAll<HTMLElement>('.theme-selector-card[role="gridcell"]');

    cards.forEach((card) => {
      const row = card.closest('[role="row"]');
      const themeId = row?.getAttribute('data-theme-id');
      if (themeId) {
        const { url1x, url2x } = getPreviewUrls(themeId, colorMode);
        
        const previewImg = card.querySelector<HTMLImageElement>('.theme-selector-card-preview-img');
        if (previewImg) {
          previewImg.src = url1x;
          previewImg.srcset = `${url1x} 426w, ${url2x} 852w`;
        }
      }
    });
    
    // Also update video sources for the new color mode
    updateVideosForColorMode();
  }

  /** Destroy component and clean up resources. */
  function destroy(): void {
    if (announceTimeout) {
      clearTimeout(announceTimeout);
      announceTimeout = null;
    }

    destroyAllTooltips();

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (rovingController) {
      rovingController.destroy();
      rovingController = null;
    }

    if (sortDropdown) {
      sortDropdown.destroy();
      sortDropdown = null;
    }
    sortButton = null;

    if (tabController) {
      tabController.destroy();
      tabController = null;
    }

    themesPanel = null;
    favoritesPanel = null;

    if (rootEl && rootEl.parentElement) {
      rootEl.remove();
    }

    rootEl = null;
    searchInput = null;
    resultsCountEl = null;
    themesContainer = null;
    favoritesContainer = null;
    ariaLiveRegion = null;
  }

  return {
    getElement,
    setSelected,
    updateColorMode,
    destroy,
  };
}
