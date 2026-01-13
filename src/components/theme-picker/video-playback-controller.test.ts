/**
 * Unit tests for VideoPlaybackController.
 * Tests state machine transitions, concurrent limits, and reduced motion support.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VideoPlaybackController,
  isMobileViewport,
  prefersReducedMotion
} from './video-playback-controller';

// =============================================================================
// Test Setup
// =============================================================================

// Mock window.matchMedia
const mockMatchMedia = vi.fn();
window.matchMedia = mockMatchMedia;

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Helper to create mock video element
function createMockVideo(src = 'test-video.webm'): HTMLVideoElement {
  const video = document.createElement('video');
  video.src = src;
  video.dataset.src = src;

  // Mock play/pause/load
  video.play = vi.fn().mockResolvedValue(undefined);
  video.pause = vi.fn();
  video.load = vi.fn();

  return video;
}

// Helper to setup default matchMedia mock
function setupMatchMedia(options: { reducedMotion?: boolean; mobile?: boolean } = {}) {
  mockMatchMedia.mockImplementation((query: string) => ({
    matches:
      query === '(prefers-reduced-motion: reduce)'
        ? options.reducedMotion ?? false
        : options.mobile ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  mockObserve.mockClear();
  mockUnobserve.mockClear();
  mockDisconnect.mockClear();
  setupMatchMedia();

  // Mock window dimensions for desktop
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('prefersReducedMotion', () => {
  it('should return true when reduced motion is preferred', () => {
    setupMatchMedia({ reducedMotion: true });
    expect(prefersReducedMotion()).toBe(true);
  });

  it('should return false when reduced motion is not preferred', () => {
    setupMatchMedia({ reducedMotion: false });
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('isMobileViewport', () => {
  it('should return true when viewport is mobile-sized', () => {
    Object.defineProperty(window, 'innerWidth', { value: 600 });
    expect(isMobileViewport()).toBe(true);
  });

  it('should return true at exactly mobile breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768 });
    expect(isMobileViewport()).toBe(true);
  });

  it('should return false when viewport is desktop-sized', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    expect(isMobileViewport()).toBe(false);
  });
});

// =============================================================================
// VideoPlaybackController Tests
// =============================================================================

describe('VideoPlaybackController', () => {
  let controller: VideoPlaybackController;

  beforeEach(() => {
    controller = new VideoPlaybackController();
  });

  afterEach(() => {
    controller.destroy();
  });

  describe('construction', () => {
    it('should create controller with default config', () => {
      expect(controller).toBeDefined();
    });

    it('should accept custom config', () => {
      const customController = new VideoPlaybackController({
        maxDesktopVideos: 3,
        maxMobileVideos: 2,
      });

      expect(customController).toBeDefined();
      customController.destroy();
    });

    it('should set up IntersectionObserver', () => {
      // Observer is created in constructor
      expect(mockObserve).not.toHaveBeenCalled(); // Not called until attach
    });
  });

  describe('attach/detach', () => {
    it('should attach video and set up observation', () => {
      const video = createMockVideo();

      controller.attach(video, 'poster.webp');

      expect(mockObserve).toHaveBeenCalledWith(video);
      expect(controller.getState(video)).toBe('idle');
    });

    it('should detach video and stop observation', () => {
      const video = createMockVideo();

      controller.attach(video, 'poster.webp');
      controller.detach(video);

      expect(mockUnobserve).toHaveBeenCalledWith(video);
    });

    it('should store poster URL in dataset', () => {
      const video = createMockVideo();

      controller.attach(video, 'poster.webp');

      expect(video.dataset.poster).toBe('poster.webp');
    });
  });

  describe('state machine transitions', () => {
    it('should transition from idle to loading on play', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);

      expect(controller.getState(video)).toBe('loading');
    });

    it('should transition from loading to playing on canplay', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      video.dispatchEvent(new Event('canplay'));

      expect(controller.getState(video)).toBe('playing');
    });

    it('should reset to idle on mouse leave', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      video.dispatchEvent(new Event('canplay'));
      controller.handleMouseLeave(video);

      expect(controller.getState(video)).toBe('idle');
      expect(video.pause).toHaveBeenCalled();
    });

    it('should reset video currentTime on leave', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      controller.handleMouseLeave(video);

      expect(video.currentTime).toBe(0);
    });
  });

  describe('concurrent playback limits', () => {
    it.each([
      { viewport: 'desktop', maxVideos: 2, innerWidth: 1024 },
      { viewport: 'mobile', maxVideos: 1, innerWidth: 600 },
    ])('should limit to $maxVideos concurrent videos on $viewport', ({ maxVideos, innerWidth }) => {
      Object.defineProperty(window, 'innerWidth', { value: innerWidth });

      const videos = Array.from({ length: 3 }, () => createMockVideo());

      videos.forEach((video) => controller.attach(video, 'poster.webp'));

      // Start all videos
      videos.forEach((video) => controller.handleMouseEnter(video));

      // Count active videos
      expect(controller.getActiveCount()).toBeLessThanOrEqual(maxVideos);
    });

    it('should pause oldest video when limit exceeded', () => {
      const video1 = createMockVideo();
      const video2 = createMockVideo();
      const video3 = createMockVideo();

      controller.attach(video1, 'poster.webp');
      controller.attach(video2, 'poster.webp');
      controller.attach(video3, 'poster.webp');

      // Start video1
      controller.handleMouseEnter(video1);
      vi.advanceTimersByTime(100);

      // Start video2
      controller.handleMouseEnter(video2);
      vi.advanceTimersByTime(100);

      // Start video3 (should pause video1)
      controller.handleMouseEnter(video3);

      // video1 should be paused (it was oldest)
      expect(video1.pause).toHaveBeenCalled();
    });
  });

  describe('focus handlers with debounce', () => {
    it('should debounce focus events', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleFocus(video);

      // Should not trigger immediately
      expect(controller.getState(video)).toBe('idle');

      // Advance past debounce delay
      vi.advanceTimersByTime(150);

      expect(controller.getState(video)).toBe('loading');
    });

    it('should cancel playback on blur during debounce', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleFocus(video);

      // Blur before debounce completes
      vi.advanceTimersByTime(50);
      controller.handleBlur(video);

      // Advance past original debounce
      vi.advanceTimersByTime(200);

      // Should not have started playback
      expect(controller.getState(video)).toBe('idle');
    });
  });

  describe('reduced motion support', () => {
    it('should not play videos when reduced motion is preferred', () => {
      setupMatchMedia({ reducedMotion: true });

      const reducedController = new VideoPlaybackController();
      const video = createMockVideo();
      reducedController.attach(video, 'poster.webp');

      reducedController.handleMouseEnter(video);

      expect(video.play).not.toHaveBeenCalled();
      expect(reducedController.getState(video)).toBe('idle');

      reducedController.destroy();
    });

    it('should not play videos on focus when reduced motion is preferred', () => {
      setupMatchMedia({ reducedMotion: true });

      const reducedController = new VideoPlaybackController();
      const video = createMockVideo();
      reducedController.attach(video, 'poster.webp');

      reducedController.handleFocus(video);
      vi.advanceTimersByTime(200);

      expect(video.play).not.toHaveBeenCalled();

      reducedController.destroy();
    });
  });

  describe('error recovery', () => {
    it('should reset state on video error', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      video.dispatchEvent(new Event('error'));

      expect(controller.getState(video)).toBe('idle');
    });

    it('should reset currentTime on error', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      video.dispatchEvent(new Event('error'));

      expect(video.currentTime).toBe(0);
    });
  });

  describe('pauseAll', () => {
    it('should pause all active videos', () => {
      const video1 = createMockVideo();
      const video2 = createMockVideo();

      controller.attach(video1, 'poster.webp');
      controller.attach(video2, 'poster.webp');

      controller.handleMouseEnter(video1);
      controller.handleMouseEnter(video2);

      controller.pauseAll();

      expect(video1.pause).toHaveBeenCalled();
      expect(video2.pause).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.destroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should not respond to events after destroy', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.destroy();
      controller.handleMouseEnter(video);

      expect(video.play).not.toHaveBeenCalled();
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 when no videos are playing', () => {
      expect(controller.getActiveCount()).toBe(0);
    });

    it('should count loading videos', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);

      expect(controller.getActiveCount()).toBe(1);
    });

    it('should count playing videos', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      video.dispatchEvent(new Event('canplay'));

      expect(controller.getActiveCount()).toBe(1);
    });
  });

  describe('mobile behavior', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 600 });
    });

    it('should not trigger playback on hover for mobile', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);

      expect(video.play).not.toHaveBeenCalled();
    });

    it('should allow focus-triggered playback on mobile', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleFocus(video);
      vi.advanceTimersByTime(200);

      expect(controller.getState(video)).toBe('loading');
    });
  });

  describe('video ended', () => {
    it('should reset video when playback ends', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      video.dispatchEvent(new Event('canplay'));
      video.dispatchEvent(new Event('ended'));

      expect(controller.getState(video)).toBe('idle');
      expect(video.currentTime).toBe(0);
    });
  });
});
