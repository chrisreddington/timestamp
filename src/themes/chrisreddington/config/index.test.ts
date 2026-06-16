import { describe, expect, it } from 'vitest';

import {
  CHRISREDDINGTON_ALIGNMENT_SAMPLE_FONT_SIZES_PX,
  CHRISREDDINGTON_COLORS,
  CHRISREDDINGTON_CONFIG,
  CHRISREDDINGTON_INK_SAMPLES,
  calculateOpeningPromptX,
  getCursorMetrics,
  inkCenterNudgeEm,
} from './index';

describe('chrisreddington config', () => {
  it('defines chrisreddington metadata with world map disabled', () => {
    expect(CHRISREDDINGTON_CONFIG.id).toBe('chrisreddington');
    expect(CHRISREDDINGTON_CONFIG.supportsWorldMap).toBe(false);
    expect(CHRISREDDINGTON_CONFIG.optionalComponents?.worldMap).toBe(false);
    expect(CHRISREDDINGTON_CONFIG.optionalComponents?.timezoneSelector).toBe(true);
  });

  it('keeps both color modes on the dark brand palette', () => {
    expect(CHRISREDDINGTON_CONFIG.colors?.dark?.accentPrimary).toBe(CHRISREDDINGTON_COLORS.blue);
    expect(CHRISREDDINGTON_CONFIG.colors?.light?.accentPrimary).toBe(CHRISREDDINGTON_COLORS.blue);
  });

  it('exposes representative samples for digits and the end-word', () => {
    expect(CHRISREDDINGTON_INK_SAMPLES.numeric).toContain(':');
    expect(CHRISREDDINGTON_INK_SAMPLES.wordXHeight).toBe('ace');
  });

  it('calculates intro-matching prompt X from cursor-centred geometry', () => {
    const centerX = 640;
    const fontSize = 92;
    const promptWidth = 49;

    const metrics = getCursorMetrics(fontSize);
    const promptX = calculateOpeningPromptX(centerX, promptWidth, fontSize);
    const expected = centerX - metrics.widthPx / 2 - metrics.gapPx - promptWidth;

    expect(promptX).toBe(expected);
  });
});

describe('inkCenterNudgeEm', () => {
  it('returns 0 when ink is already symmetric within the line box', () => {
    const nudge = inkCenterNudgeEm({
      fontSizePx: 100,
      fontBoundingBoxAscent: 80,
      fontBoundingBoxDescent: 20,
      actualBoundingBoxAscent: 80,
      actualBoundingBoxDescent: 20,
    });

    expect(nudge).toBe(0);
  });

  it('nudges digit-like ink (no descender) onto the box centre', () => {
    const nudge = inkCenterNudgeEm({
      fontSizePx: 100,
      fontBoundingBoxAscent: 90,
      fontBoundingBoxDescent: 24,
      actualBoundingBoxAscent: 70,
      actualBoundingBoxDescent: 0,
    });

    // ((70 - 0) - (90 - 24)) / 2 / 100 = (70 - 66) / 200 = 0.02
    expect(nudge).toBeCloseTo(0.02, 5);
  });

  it('is em-proportional, so one value holds across the clamp() range', () => {
    const sample = {
      fontBoundingBoxAscent: 0.9,
      fontBoundingBoxDescent: 0.24,
      actualBoundingBoxAscent: 0.7,
      actualBoundingBoxDescent: 0,
    } as const;

    const nudges = CHRISREDDINGTON_ALIGNMENT_SAMPLE_FONT_SIZES_PX.map((fontSizePx) =>
      inkCenterNudgeEm({
        fontSizePx,
        fontBoundingBoxAscent: sample.fontBoundingBoxAscent * fontSizePx,
        fontBoundingBoxDescent: sample.fontBoundingBoxDescent * fontSizePx,
        actualBoundingBoxAscent: sample.actualBoundingBoxAscent * fontSizePx,
        actualBoundingBoxDescent: sample.actualBoundingBoxDescent * fontSizePx,
      })
    );

    for (const nudge of nudges) {
      expect(nudge).toBeCloseTo(nudges[0], 6);
    }
  });

  it('guards against a zero or negative font size', () => {
    expect(
      inkCenterNudgeEm({
        fontSizePx: 0,
        fontBoundingBoxAscent: 90,
        fontBoundingBoxDescent: 24,
        actualBoundingBoxAscent: 70,
        actualBoundingBoxDescent: 0,
      })
    ).toBe(0);
  });
});
