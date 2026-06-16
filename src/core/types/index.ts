/** Core types for countdown modes, themes, and lifecycle. */

// Re-export ThemeId from registry - single source of truth
export type { ThemeId } from '@themes/registry';
import type { ThemeId } from '@themes/registry';

// Re-export SafeMessage for theme authors
export type { SafeMessage } from '@core/utils/text';

// ============================================================================
// Theme Dependencies & Configuration
// ============================================================================

/** External dependency used by a theme. Generates README Dependencies section. */
export interface ThemeDependency {
  name: string;
  url: string;
}

/** CSS variable overrides for shared components. */
export type ThemeStyles = Record<string, string>;

/** Optional shared components that a theme can request from the app layer. */
export interface ThemeOptionalComponents {
  timezoneSelector?: boolean;
  worldMap?: boolean;
}

// ============================================================================
// Countdown Configuration
// ============================================================================

/** Celebration state for wall-clock time model. Orchestrator manages transitions. */
export type CelebrationState = 'counting' | 'celebrating' | 'celebrated';

/** Time remaining until target date, broken into components. */
export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

/** Abstract wall-clock time without timezone context. */
export interface WallClockTime {
  year: number;
  month: number; // 0-indexed
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Countdown mode: timer, absolute, or wall-clock. */
export type CountdownMode = 'timer' | 'absolute' | 'wall-clock';

/** Configuration for the countdown, set via landing page or query parameters. */
export interface CountdownConfig {
  mode: CountdownMode;
  targetDate: Date;
  durationSeconds?: number;
  wallClockTarget?: WallClockTime;
  completionMessage: string;
  theme: ThemeId;
  timezone: string;
  showWorldMap?: boolean;
  /** When true, hide all UI chrome (buttons, controls). For video recording. */
  hideChrome?: boolean;
}

// ============================================================================
// Deep Link Parameters
// ============================================================================

/** Raw deep-link query parameters parsed from the URL. */
export interface DeepLinkParams {
  theme?: string;
  mode?: string;
  target?: string;
  duration?: string;
  message?: string;
  tz?: string;
  configure?: string;
  showWorldMap?: string;
  /** When 'none', hides all UI chrome (buttons, controls). For video recording. */
  chrome?: string;
}

/** Result of parsing deep-link parameters. */
export interface ParsedDeepLink {
  isValid: boolean;
  config?: CountdownConfig;
  errors?: string[];
  shouldShowConfiguration?: boolean;
  /** When true, hide all UI chrome (buttons, controls). For video recording. */
  hideChrome?: boolean;
}

// ============================================================================
// Color System
// ============================================================================

/** Color mode preference: light, dark, or system (follows OS). */
export type ColorMode = 'light' | 'dark' | 'system';

/** Resolved color mode after resolving 'system' preference. */
export type ResolvedColorMode = 'light' | 'dark';

/** Partial color overrides for a specific mode. All colors are optional. */
export interface ThemeModeColors {
  background?: string;
  text?: string;
  textMuted?: string;
  accentPrimary?: string;
  textOnAccent?: string;
  accentSecondary?: string;
  accentTertiary?: string;
  surface?: string;
  surfaceElevated?: string;
  input?: string;
  border?: string;
  borderMuted?: string;
  error?: string;
  success?: string;
  textOnSuccess?: string;
  focusRing?: string;
}

/** Theme color configuration with separate light and dark mode palettes. */
export interface ThemeColors {
  dark: ThemeModeColors;
  light: ThemeModeColors;
}

// ============================================================================
// Theme Configuration
// ============================================================================

/** Configuration and metadata for a theme. */
export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  /** Publication date in ISO 8601 format (YYYY-MM-DD) */
  publishedDate: string;
  /** GitHub username (without at-sign), or null if uncredited */
  author: string | null;
  tags?: string[];
  dependencies?: ThemeDependency[];
  optionalComponents?: ThemeOptionalComponents;
  themeStyles?: ThemeStyles;
  colors?: ThemeColors;
  supportsWorldMap?: boolean;
  /** Whether theme appears in issue template dropdown. @defaultValue true */
  availableInIssueTemplate?: boolean;
}

// ============================================================================
// Theme Lifecycle
// ============================================================================

/** Resources tracked by a theme for proper disposal. */
export interface ResourceTracker {
  intervals: number[];
  timeouts: number[];
  rafs: number[];
  observers: { disconnect: () => void }[];
  listeners: { remove: () => void }[];
}

/**
 * Reason for animation state change, used for debugging and logging.
 * Passed as optional parameter in `AnimationStateContext`.
 */
export type AnimationStateChangeReason =
  | 'reduced-motion'  // User prefers reduced motion
  | 'page-hidden'     // Tab/window not visible
  | 'overlay-open'    // Modal, mobile menu, etc. covering content
  | 'initial-mount';  // Initial state at mount time

/**
 * Context passed to themes when animation state changes.
 * 
 * Both flags can independently stop animations, but for different reasons:
 * - `shouldAnimate`: External factors (tab hidden, overlay open) - performance/UX optimization
 * - `prefersReducedMotion`: User accessibility preference - accessibility requirement
 * 
 * Themes should check BOTH flags: animations run only when shouldAnimate=true AND prefersReducedMotion=false.
 */
export interface AnimationStateContext {
  /** 
   * Whether animations should run based on external factors (tab visibility, overlay state).
   * False when tab is hidden or UI overlays (mobile menu, modals) are open.
   * True when tab is visible and no overlays are blocking content.
   */
  shouldAnimate: boolean;
  /** 
   * Whether user prefers reduced motion (accessibility preference).
   * True when user has enabled prefers-reduced-motion in their OS/browser settings.
   * When true, themes must stop all animations for accessibility compliance.
   */
  prefersReducedMotion: boolean;
  /** What triggered the change (for debugging/logging). */
  reason?: AnimationStateChangeReason;
}

/** Lifecycle states for theme controllers (used in tests). */
export type ThemeLifecycleState =
  | 'CREATED'
  | 'MOUNTING'
  | 'MOUNTED'
  | 'ACTIVE'
  | 'CELEBRATING'
  | 'DESTROYING'
  | 'DESTROYED';

/** Getter function type for animation state - themes call this to get current state. */
export type AnimationStateGetter = () => AnimationStateContext;

/** Context provided to theme renderers when mounting. */
export interface MountContext {
  /**
   * Getter for current animation state. Themes should call this instead of caching values.
   * Returns the same AnimationStateContext that onAnimationStateChange receives.
   * This ensures themes always have fresh state from the orchestrator.
   */
  getAnimationState: AnimationStateGetter;

  /**
   * Optional element to exclude from ambient animations (e.g., landing page card).
   * Themes should avoid animating squares that would appear behind this element.
   * The exclusion zone is recalculated on resize.
   */
  exclusionElement?: HTMLElement;

  /**
   * Optional resolved color mode (light or dark).
   * When provided, themes should use this instead of reading from DOM attributes.
   * This ensures color mode is set before the theme mounts, preventing flash of wrong colors.
   */
  colorMode?: ResolvedColorMode;
}

/**
 * Options passed to celebration lifecycle hooks.
 *
 * Security: `message` is a SafeMessage - pre-sanitized upstream.
 * - Use `message.forTextContent` for element.textContent (plain text)
 * - Use `message.forInnerHTML` for element.innerHTML (HTML-escaped)
 *
 * Themes should NOT do any encoding/decoding - just use the appropriate property.
 */
export interface CelebrationOptions {
  /**
   * Safe message for display. Pre-sanitized by upstream.
   * Use `.forTextContent` for textContent, `.forInnerHTML` for innerHTML.
   */
  message: {
    /** Plain text - safe for textContent (inherently XSS-safe). */
    readonly forTextContent: string;
    /** HTML-escaped - safe for innerHTML. */
    readonly forInnerHTML: string;
  };
  /** Full semantic message for screen reader announcement (plain text). */
  fullMessage: string;
}

// ============================================================================
// Time Page Renderer Interface
// ============================================================================

/**
 * Time page renderer for themes (orchestrator owns lifecycle: COUNTING→CELEBRATING→CELEBRATED).
 * `updateTime()` only called during COUNTING. Use lifecycle hooks for state transitions.
 */
export interface TimePageRenderer {
  /** Mount theme into container. Skip animations if context.shouldAnimate is false. */
  mount(container: HTMLElement, context?: MountContext): void;

  /** Destroy theme and clean up all resources. */
  destroy(): Promise<void>;

  /** Update countdown display. Only called during COUNTING state. */
  updateTime(time: TimeRemaining): void;

  /**
   * Called when animation state changes. Themes should start/stop animations based on this.
   * The orchestrator computes state from reduced-motion, visibility, and overlay state.
   * @param context - Full animation state context with shouldAnimate and prefersReducedMotion
   */
  onAnimationStateChange(context: AnimationStateContext): void;

  /** Called when entering COUNTING state (reset celebration UI). */
  onCounting(): void;

  /** Called when timer hits zero (start celebration animation). */
  onCelebrating(options?: CelebrationOptions): void;

  /** Called when entering CELEBRATED without animation (e.g., TZ switch). */
  onCelebrated(options?: CelebrationOptions): void;

  /** Update container reference after DOM moves. Re-query cached DOM nodes. */
  updateContainer(newContainer: HTMLElement): void;

  /** Get resource tracker for debugging and testing. */
  getResourceTracker(): ResourceTracker;
}

// ============================================================================
// Landing Page Renderer Interface
// ============================================================================

/**
 * Landing page background renderer (controller owns lifecycle, themes respond to hooks).
 */
export interface LandingPageRenderer {
  /** Mount the background into a container element. */
  mount(container: HTMLElement, context?: MountContext): void;

  /** Handle viewport resize. */
  setSize(width: number, height: number): void;

  /**
   * Called when animation state changes. Themes should start/stop animations based on this.
   * The controller computes state from reduced-motion and visibility state.
   * @param context - Full animation state context with shouldAnimate and prefersReducedMotion
   */
  onAnimationStateChange(context: AnimationStateContext): void;

  /** Clean up all DOM elements, listeners, and animations. */
  destroy(): void;

  /** Get current element counts for performance testing. */
  getElementCount(): { total: number; animated: number };
}

/** Factory function signature for creating theme backgrounds. */
export type LandingPageRendererFactory = (container: HTMLElement) => LandingPageRenderer;
