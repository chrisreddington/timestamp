import { describe, expect, it } from 'vitest';

import {
  CHRISREDDINGTON_ALIGNMENT_SAMPLE_FONT_SIZES_PX,
  CHRISREDDINGTON_COLORS,
  CHRISREDDINGTON_CONFIG,
  calculateInkCenterToRowAxisDeltaPx,
  calculateChevronPointToCursorCenterDeltaPx,
  calculateOpeningPromptX,
  getCursorMetrics,
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

  it('calculates intro-matching prompt X from cursor-centred geometry', () => {
    const centerX = 640;
    const fontSize = 92;
    const promptWidth = 49;

    const metrics = getCursorMetrics(fontSize);
    const promptX = calculateOpeningPromptX(centerX, promptWidth, fontSize);
    const expected = centerX - metrics.widthPx / 2 - metrics.gapPx - promptWidth;

    expect(promptX).toBe(expected);
  });

  it.each(CHRISREDDINGTON_ALIGNMENT_SAMPLE_FONT_SIZES_PX)(
    'keeps prompt/cursor/timestamp/text on one centerline at %ipx',
    (fontSizePx) => {
      const promptToCursorDelta = calculateChevronPointToCursorCenterDeltaPx(fontSizePx);
      const numericToRowAxisDelta = calculateInkCenterToRowAxisDeltaPx('numeric', fontSizePx);
      const wordToRowAxisDelta = calculateInkCenterToRowAxisDeltaPx('word', fontSizePx);

      expect(promptToCursorDelta).toBeLessThanOrEqual(1);
      expect(numericToRowAxisDelta).toBeLessThanOrEqual(1);
      expect(wordToRowAxisDelta).toBeLessThanOrEqual(1);
    }
  );
});
