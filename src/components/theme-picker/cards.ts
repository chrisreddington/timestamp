import { getResolvedColorMode } from '@core/preferences/color-mode';
import type { ThemeId } from '@core/types';
import { cloneTemplate, getIconSvg } from '@core/utils/dom';
import {
  getThemeAuthor,
  getThemeDependencies,
  getThemeDisplayName,
  isNewTheme,
} from '@themes/registry';
import { getPreviewUrls, getVideoUrls } from '@themes/registry/preview-map';

import { COLOR_MODE_CHANGE_EVENT } from '@/components/color-mode-toggle';
import { createTooltip, type TooltipController } from '@/components/tooltip';

import { getFavoriteHeartSVG, isThemeFavorite } from './favorites-manager';
import {
  prefersReducedMotion,
  VideoPlaybackController,
} from './video-playback-controller';

const tooltipControllers = new Map<string, TooltipController>();

/** Global video playback controller instance */
let videoController: VideoPlaybackController | null = null;

/** Cleanup function for color mode change listener */
let colorModeCleanup: (() => void) | null = null;

/**
 * Get or create the global video playback controller.
 * @returns VideoPlaybackController instance
 */
export function getVideoController(): VideoPlaybackController {
  if (!videoController) {
    videoController = new VideoPlaybackController();
  }
  return videoController;
}

/**
 * Destroy the global video controller.
 * Called when theme picker is closed.
 */
export function destroyVideoController(): void {
  if (videoController) {
    videoController.destroy();
    videoController = null;
  }
  if (colorModeCleanup) {
    colorModeCleanup();
    colorModeCleanup = null;
  }
}

/**
 * Update all theme preview videos to match the current color mode.
 * Called when user toggles between light/dark mode.
 */
export function updateVideosForColorMode(): void {
  const colorMode = getResolvedColorMode();
  const videos = document.querySelectorAll<HTMLVideoElement>('.theme-selector-card-preview-video');
  
  for (const video of videos) {
    const themeId = video.closest('[data-theme-id]')?.getAttribute('data-theme-id');
    if (!themeId) continue;
    
    const { url1x } = getPreviewUrls(themeId, colorMode);
    const { webm: videoUrl } = getVideoUrls(themeId, colorMode);
    
    // Update poster and video source
    video.poster = url1x;
    video.dataset.poster = url1x;
    video.dataset.src = videoUrl;
    
    // If video is currently loaded, update src too
    if (video.src && video.src !== '') {
      video.src = videoUrl;
    }
  }
}

/**
 * Set up listener for color mode changes to update video previews.
 * Should be called once when theme picker modal opens.
 */
export function setupColorModeVideoListener(): void {
  if (colorModeCleanup) return; // Already set up
  
  const handler = () => {
    updateVideosForColorMode();
  };
  
  document.addEventListener(COLOR_MODE_CHANGE_EVENT, handler);
  
  colorModeCleanup = () => {
    document.removeEventListener(COLOR_MODE_CHANGE_EVENT, handler);
  };
}

/** Destroy all tracked tooltips. Call when theme selector is destroyed. */
export function destroyAllTooltips(): void {
  for (const controller of tooltipControllers.values()) {
    controller.destroy();
  }
  tooltipControllers.clear();
}

/** Pause all playing videos. Call when theme picker modal closes. */
export function pauseAllVideos(): void {
  videoController?.pauseAll();
}

/**
 * Create "Contribute a theme" card element.
 *
 * @remarks
 * Static structure defined in index.html as `<template id="contribute-card-template">`.
 * Clones template and injects plus icon. Always displayed at end of grid.
 * Uses Grid Pattern: row with single gridcell containing the link.
 *
 * @returns Row element containing the contribute card
 */
export function createContributeCard(): HTMLElement {
  const row = cloneTemplate<HTMLElement>('contribute-card-template');
  const iconContainer = row.querySelector('.contribute-theme-icon') as HTMLElement;
  const card = row.querySelector('.contribute-theme-card') as HTMLAnchorElement;

  iconContainer.innerHTML = getIconSvg('plus', 24);

  // NOTE: Space key must trigger click for keyboard accessibility (default only triggers on Enter)
  card.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === ' ') {
      event.preventDefault();
      card.click();
    }
  });

  return row;
}

/**
 * Create theme card element.
 * @param themeId - Theme identifier
 * @param index - Card index for data attributes
 * @param currentTheme - Currently selected theme
 * @param onCardClick - Theme selection callback
 * @param onFavoriteToggle - Favorite toggle callback
 * @param onCardKeydown - Keyboard navigation handler
 * @param isLcpCandidate - Whether this card should be prioritized for LCP
 * @returns Row element with three gridcells (select, favorite, author)
 * @remarks Uses APG Grid Pattern: card is a row with three gridcells
 */
export function createThemeCard(
  themeId: ThemeId,
  index: number,
  currentTheme: ThemeId,
  onCardClick: (themeId: ThemeId) => void,
  onFavoriteToggle: (themeId: ThemeId, button: HTMLElement) => void,
  onCardKeydown: (e: KeyboardEvent) => void,
  isLcpCandidate = false
): HTMLElement {
  const isSelected = themeId === currentTheme;
  const row = document.createElement('div');
  row.className = 'theme-selector-row';
  row.setAttribute('role', 'row');
  row.setAttribute('data-theme-id', themeId);
  row.setAttribute('data-index', String(index));
  row.setAttribute('data-testid', `theme-card-${themeId}`);

  const colorMode = getResolvedColorMode();
  const { url1x } = getPreviewUrls(themeId, colorMode);
  const { webm: videoUrl } = getVideoUrls(themeId, colorMode);
  const themeName = getThemeDisplayName(themeId);
  
  const selectCell = document.createElement('div');
  selectCell.className = isSelected
    ? 'theme-selector-card theme-selector-card--selected'
    : 'theme-selector-card';
  selectCell.setAttribute('role', 'gridcell');
  selectCell.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  selectCell.setAttribute('tabindex', '-1');
  // Accessible name for the card containing the video preview
  selectCell.setAttribute('aria-label', `${themeName} - Preview video`);
  
  // Create video element with poster fallback
  const previewVideo = document.createElement('video');
  previewVideo.className = 'theme-selector-card-preview-video';
  previewVideo.poster = url1x;
  previewVideo.muted = true;
  previewVideo.playsInline = true;
  previewVideo.setAttribute('preload', 'none');
  previewVideo.setAttribute('aria-hidden', 'true');
  previewVideo.setAttribute('data-testid', `theme-video-${themeId}`);
  previewVideo.width = 426;
  previewVideo.height = 240;
  // Store video source for lazy loading - controller will set src when needed
  previewVideo.dataset.src = videoUrl;
  previewVideo.dataset.poster = url1x;
  
  // For LCP candidate, prioritize poster image loading
  if (isLcpCandidate) {
    // Create a hidden img to preload the poster with high priority
    const posterPreload = document.createElement('img');
    posterPreload.src = url1x;
    posterPreload.setAttribute('fetchpriority', 'high');
    posterPreload.style.display = 'none';
    posterPreload.alt = '';
    selectCell.appendChild(posterPreload);
  }
  
  // Graceful degradation: on video error, poster remains visible
  previewVideo.addEventListener('error', () => {
    // Video failed to load, but poster is still visible
    previewVideo.dataset.error = 'true';
  });
  
  selectCell.appendChild(previewVideo);

  // Create play icon overlay (visible when paused, fades on play)
  // CSS handles hiding this when prefers-reduced-motion is enabled
  const playIconOverlay = document.createElement('div');
  playIconOverlay.className = 'theme-selector-card-play-icon';
  playIconOverlay.setAttribute('aria-hidden', 'true');
  playIconOverlay.innerHTML = getIconSvg('play', 32);
  selectCell.appendChild(playIconOverlay);

  // Wire up video playback controller
  const controller = getVideoController();
  controller.attach(previewVideo, url1x);
  
  // Handle hover/focus events for video playback (if not reduced motion)
  // Note: We check prefersReducedMotion() at interaction time, not creation time,
  // so this is reactive to preference changes. CSS also hides the play icon
  // via @media (prefers-reduced-motion: reduce) for immediate visual feedback.
  selectCell.addEventListener('mouseenter', () => {
    if (prefersReducedMotion()) return;
    controller.handleMouseEnter(previewVideo);
    playIconOverlay.classList.add('theme-selector-card-play-icon--hidden');
  });
  
  selectCell.addEventListener('mouseleave', () => {
    if (prefersReducedMotion()) return;
    controller.handleMouseLeave(previewVideo);
    playIconOverlay.classList.remove('theme-selector-card-play-icon--hidden');
  });
  
  selectCell.addEventListener('focus', () => {
    if (prefersReducedMotion()) return;
    controller.handleFocus(previewVideo);
    playIconOverlay.classList.add('theme-selector-card-play-icon--hidden');
  });
  
  selectCell.addEventListener('blur', () => {
    if (prefersReducedMotion()) return;
    controller.handleBlur(previewVideo);
    playIconOverlay.classList.remove('theme-selector-card-play-icon--hidden');
  });

  const overlay = document.createElement('div');
  overlay.className = 'theme-selector-card-overlay';

  const content = document.createElement('div');
  content.className = 'theme-selector-card-content';

  const name = document.createElement('div');
  name.className = 'theme-selector-card-name';
  name.textContent = themeName;

  const checkmark = document.createElement('div');
  checkmark.className = 'theme-selector-card-checkmark';
  checkmark.setAttribute('aria-hidden', 'true');
  checkmark.innerHTML = getIconSvg('check', 16);

  // NEW badge: positioned top-left (opposite checkmark)
  if (isNewTheme(themeId)) {
    const newBadge = document.createElement('span');
    newBadge.className = 'theme-selector-badge theme-selector-badge--new';
    newBadge.textContent = 'NEW';
    newBadge.setAttribute('aria-label', 'New theme');
    selectCell.appendChild(newBadge);
  }

  content.appendChild(name);
  content.appendChild(checkmark);
  selectCell.append(overlay, content);

  selectCell.addEventListener('click', () => onCardClick(themeId));
  selectCell.addEventListener('keydown', onCardKeydown);

  // NOTE: Author section is optional - only rendered if theme has author metadata
  let authorCell: HTMLElement | null = null;
  const authorSection = buildAuthorSection(themeId, onCardKeydown);
  if (authorSection) {
    authorCell = document.createElement('div');
    authorCell.className = 'theme-selector-gridcell theme-selector-gridcell--author';
    authorCell.setAttribute('role', 'gridcell');
    authorCell.appendChild(authorSection);
  }

  const favCell = document.createElement('div');
  favCell.className = 'theme-selector-gridcell theme-selector-gridcell--favorite';
  favCell.setAttribute('role', 'gridcell');

  const favButton = createFavoriteButton(themeId, onFavoriteToggle, onCardKeydown);
  favCell.appendChild(favButton);

  row.appendChild(selectCell);
  if (authorCell) {
    row.appendChild(authorCell);
  }
  row.appendChild(favCell);
  const dependencies = getThemeDependencies(themeId);
  if (dependencies.length > 0) {
    const depNames = dependencies.map((d) => d.name).join(', ');
    const tooltipContent = `Powered by: ${depNames}`;
    
    // NOTE: Cleanup existing tooltip to prevent memory leaks on re-render
    const existingTooltip = tooltipControllers.get(themeId);
    if (existingTooltip) {
      existingTooltip.destroy();
    }
    
    const tooltip = createTooltip({
      trigger: selectCell,
      content: tooltipContent,
      position: 'bottom',
    });
    tooltipControllers.set(themeId, tooltip);
  }

  return row;
}

/**
 * Update visual state of favorite button.
 * @param button - Button element to update
 * @param isFavorited - Whether theme is favorited
 */
export function updateFavoriteButton(button: HTMLElement, isFavorited: boolean): void {
  button.setAttribute('aria-pressed', isFavorited ? 'true' : 'false');
  button.innerHTML = getFavoriteHeartSVG(isFavorited);
}

/**
 * Build author section with GitHub avatar and handle.
 * @param themeId - Theme identifier
 * @param onCardKeydown - Keyboard navigation handler
 * @returns Author link element or null if no author
 */
function buildAuthorSection(themeId: ThemeId, onCardKeydown: (e: KeyboardEvent) => void): HTMLElement | null {
  const author = getThemeAuthor(themeId);
  if (!author) return null;

  const authorSection = document.createElement('a');
  authorSection.className = 'theme-selector-card-author';
  authorSection.setAttribute('data-testid', `theme-author-${themeId}`);
  authorSection.setAttribute('href', `https://github.com/${author}`);
  authorSection.setAttribute('target', '_blank');
  authorSection.setAttribute('rel', 'noopener noreferrer');
  authorSection.setAttribute('aria-label', `View ${author}'s GitHub profile (opens in new tab)`);
  authorSection.tabIndex = -1;

  authorSection.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  authorSection.addEventListener('keydown', onCardKeydown);

  const avatar = document.createElement('img');
  avatar.className = 'theme-selector-card-author-avatar';
  avatar.src = `https://github.com/${author}.png?size=48`;
  avatar.alt = '';
  avatar.width = 20;
  avatar.height = 20;
  avatar.loading = 'lazy';
  avatar.onerror = () => {
    avatar.hidden = true;
  };

  const handle = document.createElement('span');
  handle.className = 'theme-selector-card-author-handle';
  handle.textContent = `@${author}`;

  authorSection.append(avatar, handle);
  return authorSection;
}

/**
 * Create favorite toggle button with heart icon.
 * @param themeId - Theme identifier
 * @param onFavoriteToggle - Favorite toggle callback
 * @param onCardKeydown - Keyboard navigation handler
 * @returns Button element
 */
function createFavoriteButton(
  themeId: ThemeId,
  onFavoriteToggle: (themeId: ThemeId, button: HTMLElement) => void,
  onCardKeydown: (e: KeyboardEvent) => void
): HTMLElement {
  const button = document.createElement('button');
  const isFavorited = isThemeFavorite(themeId);
  button.type = 'button';
  button.className = 'theme-selector-favorite-btn';
  button.setAttribute('aria-pressed', isFavorited ? 'true' : 'false');
  button.setAttribute('aria-label', `Toggle favorite for ${getThemeDisplayName(themeId)}`);
  button.setAttribute('data-testid', `favorite-btn-${themeId}`);
  button.tabIndex = -1;
  button.innerHTML = getFavoriteHeartSVG(isFavorited);

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    onFavoriteToggle(themeId, button);
  });
  button.addEventListener('keydown', onCardKeydown);

  return button;
}
