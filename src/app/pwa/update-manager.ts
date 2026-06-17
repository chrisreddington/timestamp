/** Update Manager Module - Handles proactive service worker update checks and automatic refresh */

import { getServiceWorkerRegistration } from './registration';
import type { UpdateCheckConfig } from './types';

const DEFAULT_CHECK_INTERVAL = 60 * 1000;
const MIN_CHECK_INTERVAL = 30 * 1000;
/** Fallback delay before forcing a reload if `controllerchange` never fires */
const CONTROLLER_CHANGE_FALLBACK_DELAY_MS = 3000;

/**
 * Activates a waiting service worker and reloads when it takes control, with a
 * fallback timeout so the reload happens even if `controllerchange` never fires.
 * @param registration - Service worker registration containing waiting worker
 * @param options - Optional override for the reload fallback delay
 * @internal
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

/** Controller for managing service worker updates. */
export interface UpdateManagerController {
  /** Start periodic update checking */
  start(): void;
  /** Stop periodic update checking */
  stop(): void;
  /** Manually trigger an update check */
  checkForUpdate(): Promise<boolean>;
  /** Apply a pending update by reloading */
  applyUpdate(): void;
  /** Check if an update is currently available */
  isUpdateAvailable(): boolean;
}

/**
 * Creates an update manager controller. Periodically checks for updates and dispatches 'pwa:update-available' events.
 * @param config - Optional configuration for update check behavior
 * @public
 */
export function createUpdateManager(config: UpdateCheckConfig = {}): UpdateManagerController {
  const checkInterval = Math.max(
    config.checkInterval ?? DEFAULT_CHECK_INTERVAL,
    MIN_CHECK_INTERVAL
  );
  const autoReload = config.autoReload ?? false;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let registration: ServiceWorkerRegistration | null = null;
  let updateAvailable = false;
  let isApplyingUpdate = false;
  let visibilityChangeHandler: (() => void) | null = null;

  function checkWaitingWorker(): boolean {
    // CRITICAL: Only dispatch update event if there's a controller (not first install)
    if (registration?.waiting && navigator.serviceWorker.controller) {
      updateAvailable = true;
      dispatchUpdateEvent();
      return true;
    }
    return false;
  }

  function dispatchUpdateEvent(): void {
    window.dispatchEvent(new CustomEvent('pwa:update-available', {
      detail: { registration },
    }));
  }

  function handleUpdateFound(): void {
    const installingWorker = registration?.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      // NOTE: Only treat as update if there's an active controller (not first install)
      if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
        updateAvailable = true;
        dispatchUpdateEvent();

        if (autoReload) {
          applyUpdate();
        }
      }
    });
  }

  function applyUpdate(): void {
    if (!registration?.waiting || isApplyingUpdate) return;
    isApplyingUpdate = true;
    activateWaitingServiceWorker(registration);
  }

  async function checkForUpdate(): Promise<boolean> {
    if (!registration) {
      registration = await getServiceWorkerRegistration();
      if (!registration) return false;
      registration.addEventListener('updatefound', handleUpdateFound);
    }

    if (checkWaitingWorker()) return true;

    try {
      await registration.update();
      return checkWaitingWorker();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[UpdateManager] Update check failed:', error);
      }
      return false;
    }
  }

  return {
    start(): void {
      if (intervalId) return;

      checkForUpdate();

      intervalId = setInterval(() => {
        checkForUpdate();
      }, checkInterval);

      // Also check when page becomes visible
      if (!visibilityChangeHandler) {
        visibilityChangeHandler = () => {
          if (document.visibilityState === 'visible') {
            checkForUpdate();
          }
        };
        document.addEventListener('visibilitychange', visibilityChangeHandler);
      }

      if (import.meta.env.DEV) {
        console.log(`[UpdateManager] Started with ${checkInterval}ms interval`);
      }
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
        visibilityChangeHandler = null;
      }
    },

    checkForUpdate,

    applyUpdate,

    isUpdateAvailable(): boolean {
      return updateAvailable;
    },
  };
}
