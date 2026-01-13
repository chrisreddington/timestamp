import type { ThemeId } from '@core/types';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThemeSelector } from './index';

// Shared mutable fixtures used by mocks
let mockFilteredThemes: ThemeId[] = [];
let currentFavorites: ThemeId[] = [];
let colorMode: 'light' | 'dark' = 'light';

const intersectionObserve = vi.fn();
const intersectionDisconnect = vi.fn();
let intersectionCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;

vi.mock('@core/utils/accessibility', () => ({
  createVisuallyHiddenElement: vi.fn((tag: string, opts: Record<string, unknown>) => {
    const el = document.createElement(tag);
    if (opts.role) el.setAttribute('role', String(opts.role));
    if (opts.ariaLive) el.setAttribute('aria-live', String(opts.ariaLive));
    if (opts.ariaAtomic) el.setAttribute('aria-atomic', String(opts.ariaAtomic));
    return el;
  }),
}));

vi.mock('@core/utils/accessibility/roving-tabindex', () => {
  const destroy = vi.fn();
  const refresh = vi.fn();
  const focusIndex = vi.fn();
  const createRovingTabindex = vi.fn((options: { container: HTMLElement }) => ({
    destroy,
    refresh,
    focusIndex,
    options,
  }));
  return { createRovingTabindex, RovingTabindexController: vi.fn() };
});

vi.mock('@core/preferences/color-mode', () => ({
  getResolvedColorMode: vi.fn(() => colorMode),
}));

vi.mock('@themes/registry/preview-map', () => ({
  getPreviewUrls: vi.fn((themeId: string, mode: string) => ({
    url1x: `preview-${themeId}-${mode}-1x`,
    url2x: `preview-${themeId}-${mode}-2x`,
  })),
}));

vi.mock('@themes/registry', () => ({
  getThemeDisplayName: vi.fn((themeId: string) => `Name ${themeId}`),
}));

vi.mock('./search-filter', () => {
  const filterThemes = vi.fn((state: { filteredThemes: ThemeId[] }) => {
    state.filteredThemes = [...mockFilteredThemes];
  });
  const handleSearchInput = vi.fn((input: HTMLInputElement | null, state: { searchQuery: string }) => {
    state.searchQuery = input?.value ?? '';
  });
  const getResultsCountText = vi.fn(() => `Results: ${mockFilteredThemes.length}`);
  return { filterThemes, handleSearchInput, getResultsCountText };
});

vi.mock('./favorites-manager', () => {
  const getCurrentFavorites = vi.fn(() => [...currentFavorites]);
  const toggleThemeFavorite = vi.fn((themeId: ThemeId) => {
    const isFavorite = currentFavorites.includes(themeId);
    currentFavorites = isFavorite
      ? currentFavorites.filter((fav) => fav !== themeId)
      : [...currentFavorites, themeId];
    const announcement = currentFavorites.length > 3 ? 'Favorite limit reached' : undefined;
    return { isFavorite: !isFavorite, announcement };
  });
  return { getCurrentFavorites, toggleThemeFavorite };
});

vi.mock('./card-builder', () => {
  const createThemeCard = vi.fn(
    (
      themeId: ThemeId,
      _index: number,
      _currentTheme: ThemeId,
      onClick: (id: ThemeId) => void,
      onFavoriteToggle: (id: ThemeId, button: HTMLElement) => void,
      onKeydown: (ev: KeyboardEvent) => void
    ) => {
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.setAttribute('data-theme-id', themeId);

      const cell = document.createElement('div');
      cell.setAttribute('role', 'gridcell');
      cell.className = 'theme-selector-card';
      cell.textContent = themeId;
      cell.addEventListener('click', () => onClick(themeId));
      cell.addEventListener('keydown', onKeydown);

      // Add img element for preview (all cards now use img)
      const previewImg = document.createElement('img');
      previewImg.className = 'theme-selector-card-preview-img';
      previewImg.src = `preview-${themeId}-light`; // Default to light mode
      cell.appendChild(previewImg);

      const favoriteButton = document.createElement('button');
      favoriteButton.className = 'favorite';
      favoriteButton.addEventListener('click', () => onFavoriteToggle(themeId, favoriteButton));
      (cell as unknown as { favoriteButton: HTMLElement }).favoriteButton = favoriteButton;

      row.append(cell, favoriteButton);
      return row;
    }
  );

  const buildSearchSection = vi.fn(
    (onInput: () => void, onKeydown: (ev: KeyboardEvent) => void) => {
      const section = document.createElement('div');
      const searchInput = document.createElement('input');
      searchInput.addEventListener('input', onInput);
      searchInput.addEventListener('keydown', onKeydown);
      section.appendChild(searchInput);
      return { section, searchInput };
    }
  );

  const buildResultsCount = vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'results-count';
    return el;
  });

  const buildThemesContainer = vi.fn(() => {
    const container = document.createElement('div');
    container.setAttribute('role', 'grid');
    return container;
  });

  const createSentinel = vi.fn(() => {
    const sentinel = document.createElement('div');
    sentinel.className = 'theme-selector-sentinel';
    return sentinel;
  });

  const updateFavoriteButton = vi.fn((button: HTMLElement, isFavorite: boolean) => {
    button.setAttribute('aria-pressed', String(isFavorite));
  });

  const createContributeCard = vi.fn(() => {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    cell.textContent = 'Contribute';
    row.appendChild(cell);
    return row;
  });

  const destroyAllTooltips = vi.fn();
  
  const setupColorModeVideoListener = vi.fn();
  const updateVideosForColorMode = vi.fn();

  return {
    createThemeCard,
    buildSearchSection,
    buildResultsCount,
    buildThemesContainer,
    createSentinel,
    updateFavoriteButton,
    createContributeCard,
    destroyAllTooltips,
    setupColorModeVideoListener,
    updateVideosForColorMode,
  };
});

vi.mock('./sort-dropdown', () => {
  const buildSortDropdown = vi.fn((config: unknown, onChange: (cfg: unknown) => void) => {
    const container = document.createElement('div');
    const trigger = document.createElement('button');
    trigger.className = 'sort-trigger';
    trigger.addEventListener('click', () => onChange(config as never));
    const updateSort = vi.fn();
    const destroy = vi.fn();
    return { container, trigger, updateSort, destroy };
  });
  return { buildSortDropdown };
});

vi.mock('./keyboard-nav', () => {
  const searchHandler = vi.fn();
  const cardHandler = vi.fn();
  return {
    createSearchKeydownHandler: vi.fn(() => searchHandler),
    createCardKeydownHandler: vi.fn(() => cardHandler),
  };
});

vi.mock('./tabs', () => {
  const buildTabList = vi.fn(({ tabs, onTabChange }: { tabs: { id: string; label: string }[]; onTabChange: (id: string) => void }) => {
    const list = document.createElement('div');
    list.setAttribute('role', 'tablist');
    tabs.forEach((tab) => {
      const btn = document.createElement('button');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-tab-id', tab.id);
      btn.textContent = tab.label;
      btn.addEventListener('click', () => onTabChange(tab.id));
      list.appendChild(btn);
    });
    return {
      getTabList: () => list,
      destroy: vi.fn(),
    };
  });

  const buildTabPanel = vi.fn(({ id, visible, content }: { id: string; visible: boolean; content: HTMLElement }) => {
    const panel = document.createElement('div');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('data-panel-id', id);
    panel.hidden = !visible;
    panel.appendChild(content);
    return {
      getPanel: () => panel,
      show: () => {
        panel.hidden = false;
      },
      hide: () => {
        panel.hidden = true;
      },
    };
  });

  return { buildTabList, buildTabPanel };
});

vi.mock('./sort-themes', () => ({
  sortThemes: vi.fn((themes: ThemeId[]) => [...themes].sort()),
  getDefaultSortConfig: vi.fn(() => ({ field: 'name', direction: 'asc' })),
}));

const resetIntersectionObserver = () => {
  intersectionObserve.mockClear();
  intersectionDisconnect.mockClear();
  intersectionCallback = null;
  function MockIntersectionObserver(callback: (entries: IntersectionObserverEntry[]) => void) {
    intersectionCallback = callback;
  }
  MockIntersectionObserver.prototype.observe = intersectionObserve;
  MockIntersectionObserver.prototype.disconnect = intersectionDisconnect;
  (global as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
};

const buildSelector = () => createThemeSelector({ currentTheme: 'theme-1', onSelect: vi.fn() });

describe('createThemeSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mockFilteredThemes = Array.from({ length: 14 }, (_v, i) => `theme-${i + 1}` as ThemeId);
    currentFavorites = ['theme-2'];
    colorMode = 'light';
    resetIntersectionObserver();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create root element with class and data-testid', () => {
      const selector = buildSelector();
      const el = selector.getElement();
      expect(el.className).toBe('theme-selector');
      expect(el.getAttribute('data-testid')).toBe('theme-selector');
    });

    it('should create aria-live region with exact attributes', () => {
      const selector = buildSelector();
      const el = selector.getElement();
      const live = el.querySelector('[role="status"]');
      expect(live).toBeTruthy();
      expect(live?.getAttribute('aria-live')).toBe('polite');
      expect(live?.getAttribute('aria-atomic')).toBe('true');
    });
  });

  describe('tab switching', () => {
    it('should show themes panel by default and hide favorites', () => {
      const selector = buildSelector();
      const el = selector.getElement();
      const themesPanel = el.querySelector('[data-panel-id="themes"]') as HTMLElement;
      const favoritesPanel = el.querySelector('[data-panel-id="favorites"]') as HTMLElement;
      expect(themesPanel.hidden).toBe(false);
      expect(favoritesPanel.hidden).toBe(true);
    });

    it('should show favorites panel when tab clicked', () => {
      const selector = buildSelector();
      const el = selector.getElement();
      const favoritesTab = el.querySelector('[data-tab-id="favorites"]') as HTMLButtonElement;
      favoritesTab.click();
      const favoritesPanel = el.querySelector('[data-panel-id="favorites"]') as HTMLElement;
      const themesPanel = el.querySelector('[data-panel-id="themes"]') as HTMLElement;
      expect(favoritesPanel.hidden).toBe(false);
      expect(themesPanel.hidden).toBe(true);
    });
  });

  describe('search filtering', () => {
    it('should update search query and call filter on input', async () => {
      const selector = buildSelector();
      const el = selector.getElement();
      const input = el.querySelector('input');
      expect(input).toBeTruthy();
      if (!input) throw new Error('input not found');
      input.value = 'fire';
      input.dispatchEvent(new Event('input'));
      const searchFilter = await import('./search-filter');
      expect(searchFilter.handleSearchInput).toHaveBeenCalled();
      expect(searchFilter.filterThemes).toHaveBeenCalled();
    });
  });

  describe('favorite toggle', () => {
    it('should update favorites and announce favorited string', async () => {
      vi.useFakeTimers();
      const selector = buildSelector();
      const el = selector.getElement();
      const firstCard = el.querySelector('.theme-selector-card') as HTMLElement & { favoriteButton?: HTMLElement };
      firstCard?.favoriteButton?.dispatchEvent(new Event('click'));
      await vi.runAllTimersAsync();
      const live = el.querySelector('[role="status"]');
      expect(live?.textContent).toContain('Favorited Name theme-1');
      const favoritesManager = await import('./favorites-manager');
      expect(favoritesManager.toggleThemeFavorite).toHaveBeenCalledWith('theme-1');
    });

    it('should surface favorite limit announcement in results count', async () => {
      vi.useFakeTimers();
      currentFavorites = ['theme-2', 'theme-3', 'theme-4'];
      const selector = buildSelector();
      const el = selector.getElement();

      const resultsCount = el.querySelector('.results-count');
      const firstCard = el.querySelector('.theme-selector-card') as HTMLElement & { favoriteButton?: HTMLElement };
      firstCard?.favoriteButton?.dispatchEvent(new Event('click'));

      expect(resultsCount?.textContent).toBe('Favorite limit reached');

      await vi.runAllTimersAsync();
      expect(resultsCount?.textContent).toBe(`Results: ${mockFilteredThemes.length}`);
    });

    it('should re-render favorites tab when active', () => {
      const selector = buildSelector();
      const el = selector.getElement();
      const favoritesTab = el.querySelector('[data-tab-id="favorites"]') as HTMLButtonElement;
      favoritesTab.click();
      const cards = el.querySelectorAll('[data-panel-id="favorites"] .theme-selector-card');
      expect(cards.length).toBe(currentFavorites.length);
      const emptyState = el.querySelector('[data-testid="theme-selector-empty-state"]');
      expect(emptyState).toBeNull();
      const favoriteButton = el.querySelector('[data-panel-id="favorites"] .theme-selector-card') as HTMLElement & { favoriteButton?: HTMLElement };
      favoriteButton?.favoriteButton?.dispatchEvent(new Event('click'));
      const emptyAfter = el.querySelector('[data-testid="theme-selector-empty-state"]');
      expect(emptyAfter).not.toBeNull();
    });

    it('should not re-render themes tab when toggling favorite there', () => {
      const selector = buildSelector();
      const el = selector.getElement();
      const initialCardCount = el.querySelectorAll('[data-panel-id="themes"] [role="row"]').length;
      const favoriteButton = el.querySelector('.theme-selector-card') as HTMLElement & { favoriteButton?: HTMLElement };
      favoriteButton?.favoriteButton?.dispatchEvent(new Event('click'));
      const afterCount = el.querySelectorAll('[data-panel-id="themes"] [role="row"]').length;
      expect(afterCount).toBe(initialCardCount);
    });
  });

  describe('card selection', () => {
    it('should call onSelect and set aria-selected correctly', () => {
      const onSelect = vi.fn();
      const selector = createThemeSelector({ currentTheme: 'theme-2', onSelect });
      const el = selector.getElement();
      const cards = Array.from(el.querySelectorAll('.theme-selector-card')) as HTMLElement[];
      cards[0].click();
      expect(onSelect).toHaveBeenCalledWith('theme-1');
      const selected = cards[0].getAttribute('aria-selected');
      const other = cards[1].getAttribute('aria-selected');
      expect(selected).toBe('true');
      expect(other).toBe('false');
    });
  });

  describe('progressive rendering', () => {
    it('should render initial batch and setup observer when more than initial count', () => {
      const selector = buildSelector();
      const el = selector.getElement();
      const rows = el.querySelectorAll('[data-panel-id="themes"] [role="row"]');
      expect(rows.length).toBe(12 + 1); // 12 cards + contribute card (sentinel not counted)
      expect(intersectionObserve).toHaveBeenCalledTimes(1);
    });

    it('should render remaining cards when sentinel intersects', () => {
      const selector = buildSelector();
      const el = selector.getElement();
      expect(intersectionCallback).toBeTruthy();
      intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
      const rows = el.querySelectorAll('[data-panel-id="themes"] [role="row"]');
      expect(rows.length).toBe(mockFilteredThemes.length + 1);
      expect(intersectionDisconnect).toHaveBeenCalled();
    });

    it('should not create observer when themes less than or equal to initial count', () => {
      mockFilteredThemes = Array.from({ length: 5 }, (_v, i) => `t-${i}` as ThemeId);
      const selector = buildSelector();
      selector.getElement();
      expect(intersectionObserve).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('should initialize roving tabindex for active tab', async () => {
      const selector = buildSelector();
      const el = selector.getElement();
      const rovingModule = await import('@core/utils/accessibility/roving-tabindex');
      const rovingMock = rovingModule.createRovingTabindex as unknown as Mock;
      expect(rovingMock).toHaveBeenCalled();
      const favoritesTab = el.querySelector('[data-tab-id="favorites"]') as HTMLButtonElement;
      favoritesTab.click();
      const lastCall = rovingMock.mock.calls[rovingMock.mock.calls.length - 1];
      expect(lastCall[0].container).toBe(el.querySelector('[data-panel-id="favorites"] [role="grid"]'));
    });
  });

  describe('aria live announcements', () => {
    it('should announce selection with debounce', async () => {
      vi.useFakeTimers();
      const selector = buildSelector();
      const el = selector.getElement();
      const firstCard = el.querySelector('.theme-selector-card') as HTMLElement;
      firstCard.click();
      await vi.runAllTimersAsync();
      const live = el.querySelector('[role="status"]');
      expect(live?.textContent).toBe('Selected Name theme-1');
    });
  });

  describe('color mode updates', () => {
    it('should update card img src and srcset using preview URLs', async () => {
      const selector = buildSelector();
      const el = selector.getElement();
      colorMode = 'dark';
      selector.updateColorMode();
      const card = el.querySelector('.theme-selector-card') as HTMLElement;
      const img = card.querySelector('.theme-selector-card-preview-img') as HTMLImageElement;
      expect(img.src).toContain('preview-theme-1-dark-1x');
      expect(img.srcset).toBe('preview-theme-1-dark-1x 426w, preview-theme-1-dark-2x 852w');
    });
  });

  describe('destroy', () => {
    it('should clean up observer, roving controller, sort dropdown, and timeouts', async () => {
      vi.useFakeTimers();
      const selector = buildSelector();
      const el = selector.getElement();
      const firstCard = el.querySelector('.theme-selector-card') as HTMLElement;
      firstCard.click();
      selector.destroy();
      vi.runAllTimers();
      expect(intersectionDisconnect).toHaveBeenCalled();
      const rovingModule = await import('@core/utils/accessibility/roving-tabindex');
      const sortDropdown = await import('./sort-dropdown');
      const rovingMock = rovingModule.createRovingTabindex as unknown as Mock;
      const sortMock = sortDropdown.buildSortDropdown as unknown as Mock;
      expect(rovingMock.mock.results[0].value.destroy).toHaveBeenCalled();
      expect(sortMock.mock.results[0].value.destroy).toHaveBeenCalled();
      expect((el.querySelector('[role="status"]') as HTMLElement | null)?.textContent).toBe('');
      expect(document.querySelector('.theme-selector')).toBeNull();
    });
  });
});
