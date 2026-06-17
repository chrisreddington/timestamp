/**
 * Tests for update prompt component
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { createUpdatePrompt } from './update-prompt';
import type { UpdatePromptController } from './update-prompt';
import { attachServiceWorkerMocks, createServiceWorkerRegistrationMock } from './test-utils';

describe('UpdatePrompt', () => {
  let updatePrompt: UpdatePromptController;
  let mockRegistration: ServiceWorkerRegistration;
  let mockServiceWorker: ServiceWorker;

  const findListener = (mockFn: Mock, event: string): EventListener | undefined => {
    return (mockFn.mock.calls as [string, EventListener][]).find(([type]) => type === event)?.[1];
  };

  const waitForVisibility = async (visible: boolean) => {
    await vi.waitFor(() => {
      expect(updatePrompt.getElement().classList.contains('update-prompt-container--visible')).toBe(visible);
    });
  };

  const initAndAttach = async (options: { waiting?: ServiceWorker | null; dismissedAt?: number } = {}) => {
    if (options.waiting !== undefined) {
      mockRegistration.waiting = options.waiting;
    }

    if (options.dismissedAt !== undefined) {
      localStorage.setItem('pwa-update-dismissed', options.dismissedAt.toString());
    }

    updatePrompt.init();
    document.body.appendChild(updatePrompt.getElement());
    return updatePrompt.getElement();
  };

  const mockReducedMotion = () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });
  };

  beforeEach(() => {
    // Clear localStorage to ensure clean state
    localStorage.clear();

    const registrationMocks = createServiceWorkerRegistrationMock({ workerState: 'installing' });
    mockRegistration = registrationMocks.registration;
    mockServiceWorker = registrationMocks.serviceWorker;

    mockRegistration.installing = mockServiceWorker;
    mockRegistration.waiting = null;

    attachServiceWorkerMocks({ registration: mockRegistration, serviceWorker: mockServiceWorker });

    updatePrompt = createUpdatePrompt();
  });

  afterEach(() => {
    updatePrompt.destroy();
    localStorage.clear();
  });

  it('should create update prompt with correct structure', () => {
    const element = updatePrompt.getElement();

    expect(element.className).toBe('update-prompt-container');
    expect(element.getAttribute('aria-live')).toBe('assertive');
    expect(element.getAttribute('role')).toBe('status');

    const toast = element.querySelector('.update-prompt-toast');
    expect(toast).toBeTruthy();

    const refreshButton = element.querySelector('.update-prompt-refresh-btn');
    expect(refreshButton).toBeTruthy();
    expect(refreshButton?.textContent).toBe('Refresh');
  });

  it('should initialize and listen for updates', async () => {
    updatePrompt.init();

    // Wait for async registration check
    await vi.waitFor(() => {
      expect(navigator.serviceWorker.getRegistration).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Give time for the event listener to be added
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockRegistration.addEventListener).toHaveBeenCalledWith(
      'updatefound',
      expect.any(Function)
    );
  });

  it('should show prompt when service worker update is found', async () => {
    const element = await initAndAttach();

    expect(element.classList.contains('update-prompt-container--visible')).toBe(false);

    await vi.waitFor(() => {
      expect(mockRegistration.addEventListener).toHaveBeenCalled();
    });

    const updateFoundHandler = findListener(mockRegistration.addEventListener as Mock, 'updatefound');
    expect(updateFoundHandler).toBeTruthy();

    updateFoundHandler?.();

    const stateChangeHandler = findListener(mockServiceWorker.addEventListener as Mock, 'statechange');
    expect(stateChangeHandler).toBeTruthy();

    Object.defineProperty(mockServiceWorker, 'state', { value: 'installed', writable: true });
    stateChangeHandler?.({ target: mockServiceWorker } as Event);

    await waitForVisibility(true);
  });

  it('should show prompt if waiting worker already exists', async () => {
    await initAndAttach({ waiting: mockServiceWorker });
    await waitForVisibility(true);
  });

  it('should call skipWaiting and reload on refresh click', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    mockRegistration.waiting = mockServiceWorker;
    await initAndAttach();
    await waitForVisibility(true);

    const refreshButton = updatePrompt.getElement().querySelector('.update-prompt-refresh-btn') as HTMLButtonElement;
    expect(refreshButton).toBeTruthy();

    refreshButton.click();

    expect(mockServiceWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    // Simulate controllerchange event
    const swAddEventListenerCalls = (navigator.serviceWorker.addEventListener as any).mock.calls;
    const controllerChangeCall = swAddEventListenerCalls.find((call: any[]) => call[0] === 'controllerchange');
    
    if (controllerChangeCall) {
      const controllerChangeHandler = controllerChangeCall[1];
      controllerChangeHandler();
      expect(reloadMock).toHaveBeenCalled();
    }
  });

  it('should reload immediately on refresh when no worker is waiting', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    // Banner is shown (e.g. via the pwa:update-available event) but the waiting
    // worker has since activated, so registration.waiting is null at click time.
    mockRegistration.waiting = mockServiceWorker;
    await initAndAttach();
    await waitForVisibility(true);
    mockRegistration.waiting = null;

    const refreshButton = updatePrompt.getElement().querySelector('.update-prompt-refresh-btn') as HTMLButtonElement;
    refreshButton.click();

    expect(mockServiceWorker.postMessage).not.toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalled();
  });

  it('should hide the banner immediately when refresh is clicked', async () => {
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    });

    mockRegistration.waiting = mockServiceWorker;
    const element = await initAndAttach();
    await waitForVisibility(true);

    const refreshButton = element.querySelector('.update-prompt-refresh-btn') as HTMLButtonElement;
    refreshButton.click();

    await waitForVisibility(false);
  });

  it('should reload via fallback timer if controllerchange never fires', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    mockRegistration.waiting = mockServiceWorker;
    await initAndAttach();
    await waitForVisibility(true);

    vi.useFakeTimers();
    const refreshButton = updatePrompt.getElement().querySelector('.update-prompt-refresh-btn') as HTMLButtonElement;
    refreshButton.click();

    expect(mockServiceWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    // controllerchange is never dispatched; the fallback timer must still reload.
    expect(reloadMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(reloadMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should hide prompt on dismiss button click', async () => {
    mockRegistration.waiting = mockServiceWorker;
    const element = await initAndAttach();
    await waitForVisibility(true);

    const dismissButton = element.querySelector('button[aria-label="Dismiss update notification"]') as HTMLButtonElement;
    expect(dismissButton).toBeTruthy();

    dismissButton.click();

    await waitForVisibility(false);
  });

  it('should hide prompt on Escape key', async () => {
    mockRegistration.waiting = mockServiceWorker;
    await initAndAttach();
    await waitForVisibility(true);

    // Simulate Escape key
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escapeEvent);

    await waitForVisibility(false);
  });

  it('should not auto-hide - prompt stays visible until user acts', async () => {
    vi.useFakeTimers();
    
    mockRegistration.waiting = mockServiceWorker;
    const element = await initAndAttach();
    await waitForVisibility(true);

    // Fast-forward 30 seconds - prompt should still be visible
    vi.advanceTimersByTime(30000);

    // Prompt should still be visible (no auto-hide)
    expect(element.classList.contains('update-prompt-container--visible')).toBe(true);

    vi.useRealTimers();
  });

  it('should not show if recently dismissed', async () => {
    // Set a recent dismissal
    localStorage.setItem('pwa-update-dismissed', Date.now().toString());
    
    mockRegistration.waiting = mockServiceWorker;
    await initAndAttach();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(updatePrompt.getElement().classList.contains('update-prompt-container--visible')).toBe(false);
  });

  it('should show if dismissal is expired', async () => {
    // Set an old dismissal (3 hours ago, expiry is 2 hours)
    const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
    localStorage.setItem('pwa-update-dismissed', threeHoursAgo.toString());
    
    mockRegistration.waiting = mockServiceWorker;
    await initAndAttach();
    await waitForVisibility(true);
  });

  it('should store dismissal when dismiss button clicked', async () => {
    mockRegistration.waiting = mockServiceWorker;
    const element = await initAndAttach();
    await waitForVisibility(true);

    const dismissButton = element.querySelector('button[aria-label="Dismiss update notification"]') as HTMLButtonElement;
    dismissButton.click();

    await waitForVisibility(false);

    // Check that dismissal was stored
    expect(localStorage.getItem('pwa-update-dismissed')).toBeTruthy();
  });

  it('should show prompt when pwa:update-available event is dispatched', async () => {
    updatePrompt.init();
    document.body.appendChild(updatePrompt.getElement());

    const element = updatePrompt.getElement();
    expect(element.classList.contains('update-prompt-container--visible')).toBe(false);

    // Dispatch the custom event
    window.dispatchEvent(new CustomEvent('pwa:update-available', {
      detail: { registration: mockRegistration },
    }));

    await waitForVisibility(true);
  });

  it('should respect prefers-reduced-motion', async () => {
    mockReducedMotion();
    mockRegistration.waiting = mockServiceWorker;

    const element = await initAndAttach();

    await vi.waitFor(() => {
      expect(element.classList.contains('update-prompt-container--visible')).toBe(true);
      expect(element.classList.contains('update-prompt-container--no-animation')).toBe(true);
    });
  });

  it('should cleanup resources on destroy', async () => {
    const element = await initAndAttach();

    await vi.waitFor(() => {
      expect(mockRegistration.addEventListener).toHaveBeenCalled();
    });

    const parent = element.parentNode;

    updatePrompt.destroy();

    expect(mockRegistration.removeEventListener).toHaveBeenCalled();
    expect(parent?.contains(element)).toBe(false);
  });

  it('should not initialize twice', async () => {
    // Reset the mock to count calls properly
    const getRegistrationSpy = vi.fn().mockResolvedValue(mockRegistration);
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
      value: getRegistrationSpy,
      writable: true,
      configurable: true,
    });

    updatePrompt.init();
    updatePrompt.init();

    // Wait for registration check
    await vi.waitFor(() => {
      expect(getRegistrationSpy).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Should only be called once despite two init() calls
    expect(getRegistrationSpy).toHaveBeenCalledTimes(1);
  });
});
