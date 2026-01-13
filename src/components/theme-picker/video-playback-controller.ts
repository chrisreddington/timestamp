/**
 * Video Playback Controller
 *
 * Centralized management of video playback for theme preview cards.
 * Handles hover/focus triggers, concurrent playback limits, and memory management.
 *
 * @remarks
 * Key features:
 * - State machine prevents race conditions during playback transitions
 * - Concurrent limits: 1 video on mobile, 2 on desktop
 * - IntersectionObserver for viewport-based playback on mobile
 * - Buffer release saves memory when videos exit viewport
 * - Respects `prefers-reduced-motion` preference
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/** Video playback states */
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';

/** Internal video tracking data */
interface VideoTrackingData {
  state: PlaybackState;
  videoSrc: string;
  playStartTime: number;
}

/** Configuration options for the playback controller */
export interface VideoPlaybackControllerConfig {
  /** Maximum concurrent videos on desktop (default: 2) */
  maxDesktopVideos?: number;
  /** Maximum concurrent videos on mobile (default: 1) */
  maxMobileVideos?: number;
  /** IntersectionObserver threshold (default: 0.5) */
  intersectionThreshold?: number;
  /** Debounce delay for focus events in ms (default: 150) */
  focusDebounceMs?: number;
  /** Debounce delay for intersection callbacks in ms (default: 300) */
  intersectionDebounceMs?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration values */
const DEFAULT_CONFIG: Required<VideoPlaybackControllerConfig> = {
  maxDesktopVideos: 2,
  maxMobileVideos: 1,
  intersectionThreshold: 0.5,
  focusDebounceMs: 150,
  intersectionDebounceMs: 300,
};

/** Mobile breakpoint (matches project's mobile breakpoint) */
const MOBILE_BREAKPOINT = 768;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if user prefers reduced motion.
 * @returns true if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if current viewport is mobile-sized.
 * @returns true if viewport width is at or below mobile breakpoint
 */
export function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

// =============================================================================
// VideoPlaybackController Class
// =============================================================================

/**
 * Centralized controller for video playback in theme preview cards.
 *
 * @example
 * ```typescript
 * // Create controller instance
 * const controller = new VideoPlaybackController();
 *
 * // Attach to a video element
 * controller.attach(videoElement, posterUrl);
 *
 * // Cleanup when done
 * controller.destroy();
 * ```
 */
export class VideoPlaybackController {
  private config: Required<VideoPlaybackControllerConfig>;
  private activeVideos: Map<HTMLVideoElement, VideoTrackingData> = new Map();
  private intersectionObserver: IntersectionObserver | null = null;
  private focusDebounceTimers: Map<HTMLVideoElement, ReturnType<typeof setTimeout>> = new Map();
  private intersectionDebounceTimers: Map<HTMLVideoElement, ReturnType<typeof setTimeout>> =
    new Map();
  private isDestroyed = false;

  /**
   * Create a new VideoPlaybackController.
   * @param config - Optional configuration overrides
   */
  constructor(config: VideoPlaybackControllerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Set up IntersectionObserver for mobile viewport detection
    this.setupIntersectionObserver();
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Attach the controller to a video element.
   * Sets up event listeners for hover, focus, and intersection.
   *
   * @param video - The video element to control
   * @param posterUrl - URL of the poster image for fallback
   */
  public attach(video: HTMLVideoElement, posterUrl: string): void {
    if (this.isDestroyed) return;

    // Initialize tracking data
    this.activeVideos.set(video, {
      state: 'idle',
      videoSrc: video.src || video.dataset.src || '',
      playStartTime: 0,
    });

    // Set up event listeners
    this.setupVideoEventListeners(video);

    // Observe for viewport intersection (mobile)
    this.intersectionObserver?.observe(video);

    // Store poster URL for graceful degradation
    video.dataset.poster = posterUrl;
  }

  /**
   * Detach the controller from a video element.
   * Removes event listeners and stops playback.
   *
   * @param video - The video element to detach
   */
  public detach(video: HTMLVideoElement): void {
    // Cancel any pending debounce timers
    this.clearDebounceTimer(video, 'focus');
    this.clearDebounceTimer(video, 'intersection');

    // Stop playback
    this.stopVideo(video);

    // Stop observing
    this.intersectionObserver?.unobserve(video);

    // Remove from tracking
    this.activeVideos.delete(video);
  }

  /**
   * Handle mouse enter event on video card.
   * Triggers playback on desktop if not in reduced motion mode.
   *
   * @param video - The video element
   */
  public handleMouseEnter(video: HTMLVideoElement): void {
    if (this.isDestroyed || prefersReducedMotion() || isMobileViewport()) return;

    this.triggerPlayback(video);
  }

  /**
   * Handle mouse leave event on video card.
   * Resets video to beginning and shows poster.
   *
   * @param video - The video element
   */
  public handleMouseLeave(video: HTMLVideoElement): void {
    if (this.isDestroyed || isMobileViewport()) return;

    this.resetVideo(video);
  }

  /**
   * Handle focus event on video card.
   * Triggers playback with debounce for keyboard navigation.
   *
   * @param video - The video element
   */
  public handleFocus(video: HTMLVideoElement): void {
    if (this.isDestroyed || prefersReducedMotion()) return;

    // Clear any existing debounce timer
    this.clearDebounceTimer(video, 'focus');

    // Debounce focus to allow keyboard navigation through cards
    const timer = setTimeout(() => {
      this.focusDebounceTimers.delete(video);
      this.triggerPlayback(video);
    }, this.config.focusDebounceMs);

    this.focusDebounceTimers.set(video, timer);
  }

  /**
   * Handle blur event on video card.
   * Resets video to beginning and shows poster.
   *
   * @param video - The video element
   */
  public handleBlur(video: HTMLVideoElement): void {
    if (this.isDestroyed) return;

    // Clear any pending focus debounce
    this.clearDebounceTimer(video, 'focus');

    this.resetVideo(video);
  }

  /**
   * Pause all currently playing videos.
   * Called when theme picker modal closes.
   */
  public pauseAll(): void {
    for (const video of this.activeVideos.keys()) {
      this.pauseVideo(video);
    }
  }

  /**
   * Get current playback state for a video.
   * @param video - The video element
   * @returns Current playback state or 'idle' if not tracked
   */
  public getState(video: HTMLVideoElement): PlaybackState {
    return this.activeVideos.get(video)?.state ?? 'idle';
  }

  /**
   * Get count of currently playing videos.
   * @returns Number of videos in 'playing' or 'loading' state
   */
  public getActiveCount(): number {
    let count = 0;
    for (const data of this.activeVideos.values()) {
      if (data.state === 'playing' || data.state === 'loading') {
        count++;
      }
    }
    return count;
  }

  /**
   * Destroy the controller and clean up all resources.
   */
  public destroy(): void {
    this.isDestroyed = true;

    // Stop all videos and clear timers
    for (const video of this.activeVideos.keys()) {
      this.detach(video);
    }

    // Clean up intersection observer
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;

    // Clear all remaining timers
    for (const timer of this.focusDebounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.intersectionDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.focusDebounceTimers.clear();
    this.intersectionDebounceTimers.clear();
  }

  // ===========================================================================
  // Private Methods: Setup
  // ===========================================================================

  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => this.handleIntersectionChange(entries),
      { threshold: this.config.intersectionThreshold }
    );
  }

  private setupVideoEventListeners(video: HTMLVideoElement): void {
    // Error handling: fall back to poster on video error
    video.addEventListener('error', () => this.handleVideoError(video));

    // State transitions on video events
    video.addEventListener('canplay', () => this.handleCanPlay(video));
    video.addEventListener('ended', () => this.handleEnded(video));
  }

  // ===========================================================================
  // Private Methods: State Transitions
  // ===========================================================================

  private triggerPlayback(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data || prefersReducedMotion()) return;

    // Check concurrent limit
    const maxVideos = isMobileViewport()
      ? this.config.maxMobileVideos
      : this.config.maxDesktopVideos;

    if (this.getActiveCount() >= maxVideos) {
      // Pause oldest playing video to make room
      this.pauseOldestVideo();
    }

    // Transition: IDLE/PAUSED/STOPPED → LOADING
    if (data.state === 'idle' || data.state === 'paused' || data.state === 'stopped') {
      data.state = 'loading';
      data.playStartTime = Date.now();

      // Restore src if it was cleared for buffer release
      if (!video.src && data.videoSrc) {
        video.src = data.videoSrc;
        video.load();
      }

      // Attempt to play
      video.play().catch(() => {
        // Playback failed, reset to idle
        data.state = 'idle';
      });
    }
  }

  private handleCanPlay(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Transition: LOADING → PLAYING
    if (data.state === 'loading') {
      data.state = 'playing';
    }
  }

  private handleEnded(video: HTMLVideoElement): void {
    // On video end, reset to beginning (loop behavior)
    this.resetVideo(video);
  }

  private pauseVideo(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Transition: PLAYING/LOADING → PAUSED
    if (data.state === 'playing' || data.state === 'loading') {
      video.pause();
      data.state = 'paused';
    }
  }

  private stopVideo(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    video.pause();
    video.currentTime = 0;
    data.state = 'stopped';
  }

  private resetVideo(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    video.pause();
    video.currentTime = 0;
    data.state = 'idle';
  }

  private pauseOldestVideo(): void {
    let oldestVideo: HTMLVideoElement | null = null;
    let oldestTime = Infinity;

    for (const [video, data] of this.activeVideos.entries()) {
      if (
        (data.state === 'playing' || data.state === 'loading') &&
        data.playStartTime < oldestTime
      ) {
        oldestTime = data.playStartTime;
        oldestVideo = video;
      }
    }

    if (oldestVideo) {
      this.pauseVideo(oldestVideo);
    }
  }

  // ===========================================================================
  // Private Methods: Event Handlers
  // ===========================================================================

  private handleIntersectionChange(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const video = entry.target as HTMLVideoElement;

      // Clear existing debounce timer
      this.clearDebounceTimer(video, 'intersection');

      // Debounce intersection callbacks
      const timer = setTimeout(() => {
        this.intersectionDebounceTimers.delete(video);

        if (entry.isIntersecting) {
          // Video entered viewport - trigger playback on mobile
          if (isMobileViewport() && !prefersReducedMotion()) {
            this.triggerPlayback(video);
          }
        } else {
          // Video exited viewport - release buffer to save memory
          this.releaseVideoBuffer(video);
        }
      }, this.config.intersectionDebounceMs);

      this.intersectionDebounceTimers.set(video, timer);
    }
  }

  private handleVideoError(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Reset state and show poster (graceful degradation)
    data.state = 'idle';
    video.currentTime = 0;
  }

  // ===========================================================================
  // Private Methods: Memory Management
  // ===========================================================================

  private releaseVideoBuffer(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Stop playback
    video.pause();
    video.currentTime = 0;

    // Clear src to release buffer (poster remains visible)
    // Save the current src before clearing
    if (video.src) {
      data.videoSrc = video.src;
    }
    video.src = '';
    video.load(); // Force buffer release

    data.state = 'stopped';
  }

  // ===========================================================================
  // Private Methods: Utilities
  // ===========================================================================

  private clearDebounceTimer(video: HTMLVideoElement, type: 'focus' | 'intersection'): void {
    const timers = type === 'focus' ? this.focusDebounceTimers : this.intersectionDebounceTimers;
    const timer = timers.get(video);
    if (timer) {
      clearTimeout(timer);
      timers.delete(video);
    }
  }
}
