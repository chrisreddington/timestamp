import type { ThemeConfig } from '@core/types';

export const CHRISREDDINGTON_COLORS = {
  stageBase: '#020617',
  stageGradient: 'radial-gradient(120% 86% at 50% 47%, #122a63 0%, #0c1733 52%, #010411 100%)',
  grainDot: 'rgba(230, 237, 243, 0.04)',
  vignette: 'rgba(2, 6, 23, 0.58)',
  ink: '#e6edf3',
  blue: '#3b82f6',
  green: '#22c55e',
  muted: '#94a3b8',
} as const;

export const CHRISREDDINGTON_FONT = {
  family: '"Monaspace Neon", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  countdownSize: 'clamp(28px, 7.2vw, 92px)',
  restingSize: 'clamp(40px, 9vw, 120px)',
  numericNudgeEm: 0.082,
  wordNudgeEm: 0,
} as const;

export const CHRISREDDINGTON_CURSOR = {
  widthEm: 0.42,
  heightEm: 0.78,
  gapEm: 0.38,
  radiusEm: 0.04,
  blinkMs: 1000,
} as const;

export const CHRISREDDINGTON_SEQUENCE = {
  deleteCharMs: 50,
  typeCharMs: 100,
  holdReadyMs: 750,
  centeringMs: 220,
  readyWord: 'ready',
} as const;

export const CHRISREDDINGTON_ALIGNMENT_SAMPLE_FONT_SIZES_PX = [28, 60, 92] as const;
export const NUMERIC_INK_CENTER_ABOVE_BASELINE_EM = 0.36;
export const WORD_INK_CENTER_ABOVE_BASELINE_EM = 0.285;
export const ROW_AXIS_ABOVE_BASELINE_EM = WORD_INK_CENTER_ABOVE_BASELINE_EM;

export type CenterlineContentKind = 'numeric' | 'word';

export interface ChrisReddingtonCursorMetrics {
  widthPx: number;
  heightPx: number;
  gapPx: number;
}

export function getCursorMetrics(fontSizePx: number): ChrisReddingtonCursorMetrics {
  return {
    widthPx: CHRISREDDINGTON_CURSOR.widthEm * fontSizePx,
    heightPx: CHRISREDDINGTON_CURSOR.heightEm * fontSizePx,
    gapPx: CHRISREDDINGTON_CURSOR.gapEm * fontSizePx,
  };
}

export function calculateOpeningPromptX(centerX: number, promptWidthPx: number, fontSizePx: number): number {
  const metrics = getCursorMetrics(fontSizePx);
  return centerX - metrics.widthPx / 2 - metrics.gapPx - promptWidthPx;
}

/**
 * Measures the chevron-point-to-cursor-center vertical delta in CSS space.
 *
 * @remarks
 * The theme enforces `line-height: 1` with row-level `align-items: center`, so both
 * chevron and cursor align to the same em-box center line. This function validates
 * that relationship across the clamp() font range.
 */
export function calculateChevronPointToCursorCenterDeltaPx(fontSizePx: number): number {
  const chevronPointY = fontSizePx * 0.5;
  const cursorCenterY = fontSizePx * 0.5;
  return Math.abs(chevronPointY - cursorCenterY);
}

function getMeasuredInkCenterAboveBaselineEm(content: CenterlineContentKind): number {
  return content === 'numeric' ? NUMERIC_INK_CENTER_ABOVE_BASELINE_EM : WORD_INK_CENTER_ABOVE_BASELINE_EM;
}

function getContentNudgeEm(content: CenterlineContentKind): number {
  return content === 'numeric'
    ? CHRISREDDINGTON_FONT.numericNudgeEm
    : CHRISREDDINGTON_FONT.wordNudgeEm;
}

/**
 * Measures the displayed ink-center delta against the shared cursor-row axis.
 *
 * @remarks
 * Chevron point + cursor are em-box centered (`line-height: 1`, `align-items: center`).
 * Numeric and word text then apply content-aware nudges so their *ink centers*
 * visually land on that same axis.
 */
export function calculateInkCenterToRowAxisDeltaPx(
  content: CenterlineContentKind,
  fontSizePx: number
): number {
  const measuredAboveBaseline = getMeasuredInkCenterAboveBaselineEm(content);
  const adjustedAboveBaseline = measuredAboveBaseline - getContentNudgeEm(content);
  return Math.abs(adjustedAboveBaseline - ROW_AXIS_ABOVE_BASELINE_EM) * fontSizePx;
}

export const CHRISREDDINGTON_CONFIG: ThemeConfig = {
  id: 'chrisreddington',
  name: 'Chris Reddington',
  description: 'On-brand countdown with a seamless cursor-centred handoff into the intro motion system',
  publishedDate: '2026-06-16',
  author: 'chrisreddington',
  tags: ['chrisreddington', 'brand', 'cursor'],
  dependencies: [],
  supportsWorldMap: false,
  availableInIssueTemplate: true,
  optionalComponents: {
    timezoneSelector: true,
    worldMap: false,
  },
  colors: {
    dark: {
      accentPrimary: CHRISREDDINGTON_COLORS.blue,
      accentSecondary: CHRISREDDINGTON_COLORS.muted,
    },
    light: {
      accentPrimary: CHRISREDDINGTON_COLORS.blue,
      accentSecondary: CHRISREDDINGTON_COLORS.muted,
    },
  },
};
