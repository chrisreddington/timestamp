import { describe, expect, it } from 'vitest';
import { GRID_CONFIG } from '../../config';
import type { GridState, Square } from '../../types';
import { calculateLineWidth, formatCountdown, getSquare } from './index';

function createGridState(cols: number, rows: number): GridState {
  const squares: Square[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      squares.push({
        element: document.createElement('div'),
        isDigit: false,
        col,
        row,
      });
    }
  }

  return {
    grid: document.createElement('div'),
    squares,
    cols,
    rows,
    lastTimeStr: null,
    lastDigitIndices: new Set(),
    digitBoundingBox: null,
    exclusionZone: null,
    ambientSquares: [],
    activeAmbient: new Set(),
    ambientSquaresDirty: false,
    cancelAnimation: false,
    wallPlacements: null,
    pendingCleanups: new WeakMap(),
    animatingSquares: new WeakSet(),
  };
}

describe('getSquare', () => {
  it('should return square when indices are in bounds', () => {
    const state = createGridState(3, 2);
    expect(getSquare(state, 1, 1)).toEqual(state.squares[4]);
  });

  it.each([
    { col: -1, row: 0 },
    { col: 3, row: 0 },
    { col: 0, row: 2 },
  ])('should return undefined when indices are out of bounds ($col,$row)', ({ col, row }) => {
    const state = createGridState(3, 2);
    expect(getSquare(state, col, row)).toBeUndefined();
  });
});

describe('calculateLineWidth', () => {
  it.each([
    { input: '0', expected: 5 },
    { input: '1:2', expected: 15 },
    { input: '12:34', expected: 27 },
    { input: '123', expected: 11, digitWidth: 3 },
  ])('should measure "$input" as $expected columns', ({ input, expected, digitWidth }) => {
    expect(calculateLineWidth(input, digitWidth)).toBe(expected);
  });
});

describe('formatCountdown', () => {
  const padding = GRID_CONFIG.edgePadding * 2;

  it.each([
    {
      title: 'single line with days when space allows',
      input: { days: 1, hours: 2, minutes: 3, seconds: 4 },
      cols: calculateLineWidth('01:02:03:04') + padding,
      expected: ['01:02:03:04'],
    },
    {
      title: 'single line without days when hours exist',
      input: { days: 0, hours: 5, minutes: 6, seconds: 7 },
      cols: calculateLineWidth('05:06:07') + padding,
      expected: ['05:06:07'],
    },
    {
      title: 'single line minutes and seconds only',
      input: { days: 0, hours: 0, minutes: 8, seconds: 9 },
      cols: calculateLineWidth('08:09') + padding,
      expected: ['08:09'],
    },
    {
      title: 'two lines when single line is too wide with days present',
      input: { days: 12, hours: 3, minutes: 4, seconds: 5 },
      cols: calculateLineWidth('12:03') + padding,
      expected: ['12:03', '04:05'],
    },
    {
      title: 'two lines when single line is too wide without days',
      input: { days: 0, hours: 12, minutes: 34, seconds: 56 },
      cols: Math.max(calculateLineWidth('12:34'), calculateLineWidth('56')) + padding,
      expected: ['12:34', '56'],
    },
    {
      title: 'stacked layout when narrow but tall enough',
      input: { days: 123, hours: 45, minutes: 6, seconds: 7 },
      cols: calculateLineWidth('123') + padding,
      expected: ['123', '45', '06', '07'],
    },
    {
      title: 'fallback to seconds only when nothing fits',
      input: { days: 9, hours: 9, minutes: 9, seconds: 5 },
      cols: GRID_CONFIG.edgePadding * 2 + 1,
      expected: ['05'],
    },
  ])('should choose layout for $title', ({ input, cols, expected }) => {
    const lines = formatCountdown(
      input.days,
      input.hours,
      input.minutes,
      input.seconds,
      cols,
    );

    expect(lines).toEqual(expected);
  });
});
