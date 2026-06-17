/** Update Prompt Component - Shows a toast notification when a service worker update is available. */

import '@/styles/components/update-prompt.scss';

import { getServiceWorkerRegistration } from './registration';

const DISMISSED_KEY = 'pwa-update-dismissed';
const DISMISS_DURATION_MS = 2 * 60 * 60 * 1000;
const VISIBLE_CLASS = 'update-prompt-container--visible';
const NO_ANIMATION_CLASS = 'update-prompt-container--no-animation';
/**
 * Fallback delay before forcing a reload if `controllerchange` never fires.
 * Some scenarios (multiple tabs/clients, a worker that already activated) won't
 * emit `controllerchange` for this client, which would otherwise leave the
 * banner stuck on screen forever. The reload happens regardless after this.
 */
const CONTROLLER_CHANGE_FALLBACK_DELAY_MS = 3000;

/**
 * Activates a waiting SW and reloads when it takes control, with a fallback
 * timeout so the reload always happens even if `controllerchange` never fires.
 * @param registration - Service worker registration
 * @param options - Optional override for the reload fallback delay
 */
function activateWaitingServiceWorker(
  registration: ServiceWorkerRegistration,
  options: { reloadFallbackDelayMs?: number } = {}
): void {
  const waitingWorker = registration.waiting;
  if (!waitingWorker) return;

  let hasReloaded = false;

  const reload = (): void => {
    if (hasReloaded) return;
    hasReloaded = true;
    clearTimeout(fallbackTimer);
    navigator.serviceWorker.removeEventListener('controllerchange', reload);
    window.location.reload();
  };

  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  navigator.serviceWorker.addEventListener('controllerchange', reload);

  const fallbackDelay = options.reloadFallbackDelayMs ?? CONTROLLER_CHANGE_FALLBACK_DELAY_MS;
  const fallbackTimer = setTimeout(reload, fallbackDelay);
}

/** Controller for the update prompt component. */
export interface UpdatePromptController {
  /** Initialize and start listening for updates */
  init(): void;
  /** Get the DOM element */
  getElement(): HTMLElement;
  /** Cleanup resources */
  destroy(): void;
}

/** Creates an update prompt controller. Shows a toast when SW updates are available; respects reduced-motion and remembers dismissals. @public */
export function createUpdatePrompt(): UpdatePromptController {
  let registration: ServiceWorkerRegistration | null = null;
  let updateFoundHandler: (() => void) | null = null;
  let stateChangeHandler: ((event: Event) => void) | null = null;
  let updateAvailableHandler: ((event: Event) => void) | null = null;
  let isInitialized = false;

  function wasRecentlyDismissed(): boolean {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) return false;
      const dismissedAt = parseInt(dismissed, 10);
      return Date.now() - dismissedAt < DISMISS_DURATION_MS;
    } catch {
      return false;
    }
  }

  function markDismissed(): void {
    try {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    } catch { /* Storage unavailable */ }
  }

  function clearDismissed(): void {
    try {
      localStorage.removeItem(DISMISSED_KEY);
    } catch { /* Storage unavailable */ }
  }

  const container = document.createElement('div');
  container.className = 'update-prompt-container';
  container.setAttribute('aria-live', 'assertive');
  container.setAttribute('role', 'status');

  const toast = document.createElement('div');
  toast.className = 'update-prompt-toast';

  const message = document.createElement('span');
  message.className = 'update-prompt-message';
  message.textContent = 'A new version is available!';

  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh';
  refreshButton.className = 'update-prompt-refresh-btn';

  const dismissButton = document.createElement('button');
  dismissButton.textContent = '×';
  dismissButton.className = 'update-prompt-dismiss-btn';
  dismissButton.setAttribute('aria-label', 'Dismiss update notification');

  toast.appendChild(message);
  toast.appendChild(refreshButton);
  toast.appendChild(dismissButton);
  container.appendChild(toast);

  function syncMotionPreference(): void {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.classList.toggle(NO_ANIMATION_CLASS, prefersReducedMotion);
  }

  function show(): void {
    if (wasRecentlyDismissed()) {
      if (import.meta.env.DEV) console.log('[UpdatePrompt] Skipping - recently dismissed');
      return;
    }
    syncMotionPreference();
    void container.offsetHeight; // Force reflow for smooth transition
    container.classList.add(VISIBLE_CLASS);
  }

  function hide(): void {
    syncMotionPreference();
    container.classList.remove(VISIBLE_CLASS);
  }

  function handleRefresh(): void {
    clearDismissed();
    // Hide immediately so the banner can't get visually stuck if the reload is delayed.
    hide();
    if (registration?.waiting) {
      activateWaitingServiceWorker(registration);
    } else {
      // No waiting worker means the new version likely already activated (e.g. via
      // another tab/client). Reload to pick it up so the prompt resolves either way.
      window.location.reload();
    }
  }

  function handleDismiss(): void {
    markDismissed();
    hide();
  }

  function handleStateChange(event: Event): void {
    const serviceWorker = event.target as ServiceWorker;
    // NOTE: Only show for updates (not first install)
    if (serviceWorker.state === 'installed' && navigator.serviceWorker.controller) {
      show();
    }
  }

  function handleUpdateFound(): void {
    if (!registration?.installing) return;
    const installingWorker = registration.installing;
    if (stateChangeHandler) {
      installingWorker.removeEventListener('statechange', stateChangeHandler);
    }
    stateChangeHandler = handleStateChange;
    installingWorker.addEventListener('statechange', stateChangeHandler);
  }

  refreshButton.addEventListener('click', handleRefresh);
  dismissButton.addEventListener('click', handleDismiss);

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && container.classList.contains(VISIBLE_CLASS)) {
      handleDismiss();
    }
  };

  return {
    init(): void {
      if (isInitialized) return;
      isInitialized = true;

      updateAvailableHandler = () => {
        if (!wasRecentlyDismissed()) show();
      };
      window.addEventListener('pwa:update-available', updateAvailableHandler);

      getServiceWorkerRegistration()
        .then((swRegistration) => {
          if (!swRegistration) return;
          registration = swRegistration;
          if (swRegistration.waiting && !wasRecentlyDismissed()) show();
          updateFoundHandler = handleUpdateFound;
          swRegistration.addEventListener('updatefound', updateFoundHandler);
        })
        .catch((error) => {
          if (import.meta.env.DEV) console.error('[UpdatePrompt] Failed to get registration:', error);
        });

      document.addEventListener('keydown', handleKeyDown);
    },

    getElement(): HTMLElement {
      return container;
    },

    destroy(): void {
      if (!isInitialized) return;
      isInitialized = false;

      if (updateAvailableHandler) {
        window.removeEventListener('pwa:update-available', updateAvailableHandler);
        updateAvailableHandler = null;
      }
      if (registration && updateFoundHandler) {
        registration.removeEventListener('updatefound', updateFoundHandler);
        updateFoundHandler = null;
      }
      if (registration?.installing && stateChangeHandler) {
        registration.installing.removeEventListener('statechange', stateChangeHandler);
        stateChangeHandler = null;
      }

      refreshButton.removeEventListener('click', handleRefresh);
      dismissButton.removeEventListener('click', handleDismiss);
      document.removeEventListener('keydown', handleKeyDown);

      container.parentNode?.removeChild(container);
      registration = null;
    },
  };
}
