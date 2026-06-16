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
  holdFinalMs: 1000,
  holdReadyMs: 1500,
  centeringMs: 220,
  readyWord: 'ready',
} as const;

/** Representative samples used to measure each content type's ink centre. */
export const CHRISREDDINGTON_INK_SAMPLES = {
  numeric: '0:8',
  // Lowercase x-height proxy (no ascenders/descenders). The end-word is centred on
  // its x-height band, where the eye reads its visual mass, rather than on the full
  // glyph box (which the `d` ascender and `y` descender would skew).
  wordXHeight: 'ace',
} as const;

export const CHRISREDDINGTON_ALIGNMENT_SAMPLE_FONT_SIZES_PX = [28, 60, 92] as const;

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
 * Ink-box metrics for one text sample, as reported by Canvas `measureText`.
 *
 * @remarks
 * `fontBoundingBox*` describe the font's line box (the box flex centres on);
 * `actualBoundingBox*` describe the painted ink of the sample.
 */
export interface ChrisReddingtonInkBoxMetrics {
  fontSizePx: number;
  fontBoundingBoxAscent: number;
  fontBoundingBoxDescent: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}

/**
 * Computes the `translateY` (in em) that moves a text element's visible ink
 * centre onto its flex line-box centre, so digits and words share the cursor's
 * centre axis.
 *
 * @remarks
 * With `align-items: center` and `line-height: 1`, flex centres each child's
 * line box — not its painted ink. Glyph ink sits asymmetrically inside that box
 * (digits high, words around the x-height), so without this correction text
 * reads as high or low against the geometric cursor block. The line box's centre
 * sits `(fontAscent - fontDescent) / 2` above the baseline; the ink centre sits
 * `(inkAscent - inkDescent) / 2` above it. The difference is the nudge. Positive
 * values move the element downward.
 *
 * @param metrics - Canvas-measured font and ink box metrics for the sample.
 * @returns The vertical correction in em (0 when the sample cannot be measured).
 */
export function inkCenterNudgeEm(metrics: ChrisReddingtonInkBoxMetrics): number {
  if (!(metrics.fontSizePx > 0)) {
    return 0;
  }

  const inkCenterFromBaseline = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  const boxCenterFromBaseline = (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
  const nudgeEm = (inkCenterFromBaseline - boxCenterFromBaseline) / metrics.fontSizePx;

  return Number.isFinite(nudgeEm) ? nudgeEm : 0;
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
