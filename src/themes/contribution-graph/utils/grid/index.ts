/**
 * Grid calculation utilities.
 *
 * Pure functions for grid dimension calculations, square access,
 * and countdown layout formatting.
 */

import {
    CHAR_SPACING,
    GRID_CONFIG,
} from '../../config';
import type { GridState, Square } from '../../types';
import { DIGIT_WIDTH } from '../ui/patterns';

// =============================================================================
// GRID ACCESS
// =============================================================================

/**
 * Get square at position (col, row) from flat array.
 *
 * @param state - Grid state
 * @param col - Column index
 * @param row - Row index
 * @returns Square at position, or undefined if out of bounds
 */
export function getSquare(state: GridState, col: number, row: number): Square | undefined {
  if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return undefined;
  return state.squares[row * state.cols + col];
}

// =============================================================================
// LAYOUT CALCULATIONS
// =============================================================================

/**
 * Calculate width of a text line in grid columns.
 *
 * @param str - Text string to measure (colons are 3 columns, digits use digitWidth)
 * @param digitWidth - Width of digit characters in columns
 * @returns Total width in grid columns
 */
export function calculateLineWidth(str: string, digitWidth: number = DIGIT_WIDTH): number {
  let width = 0;
  for (const char of str) {
    width += (char === ':' ? 3 : digitWidth) + CHAR_SPACING;
  }
  return width - CHAR_SPACING;
}

// =============================================================================
// COUNTDOWN FORMATTING
// =============================================================================

/**
 * Format countdown with intelligent layout based on available space.
 *
 * Tries single line, then two lines, then four lines (stacked). Falls back to seconds only.
 *
 * @param days - Days remaining
 * @param hours - Hours remaining
 * @param minutes - Minutes remaining
 * @param seconds - Seconds remaining
 * @param cols - Available columns in the grid
 * @returns Array of text lines to render
 */
export function formatCountdown(
  days: number,
  hours: number,
  minutes: number,
  seconds: number,
  cols: number
): string[] {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const daysStr = pad(days);

  const showDays = days > 0;
  const showHours = showDays || hours > 0;

  const availableCols = cols - GRID_CONFIG.edgePadding * 2;

  // Single line candidates
  const singleLineFull = showDays
    ? `${daysStr}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : showHours
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;

  if (calculateLineWidth(singleLineFull) <= availableCols) {
    return [singleLineFull];
  }

  // Two line candidates
  if (showDays) {
    const line1 = `${daysStr}:${pad(hours)}`;
    const line2 = `${pad(minutes)}:${pad(seconds)}`;
    const maxWidth = Math.max(calculateLineWidth(line1), calculateLineWidth(line2));
    if (maxWidth <= availableCols) {
      return [line1, line2];
    }
  } else if (showHours) {
    const line1 = `${pad(hours)}:${pad(minutes)}`;
    const line2 = pad(seconds);
    const maxWidth = Math.max(calculateLineWidth(line1), calculateLineWidth(line2));
    if (maxWidth <= availableCols) {
      return [line1, line2];
    }
  }

  // MM:SS always fits on two-digit width
  const twoDigitWidth = calculateLineWidth('00:00');
  if (!showDays && !showHours && twoDigitWidth <= availableCols) {
    return [`${pad(minutes)}:${pad(seconds)}`];
  }

  // Four lines (stacked)
  const oneDigitWidth = calculateLineWidth('00');
  const daysWidth = calculateLineWidth(daysStr);
  const maxUnitWidth = Math.max(showDays ? daysWidth : 0, oneDigitWidth);

  if (maxUnitWidth <= availableCols) {
    if (showDays) {
      return [daysStr, pad(hours), pad(minutes), pad(seconds)];
    } else if (showHours) {
      return [pad(hours), pad(minutes), pad(seconds)];
    } else {
      return [pad(minutes), pad(seconds)];
    }
  }

  // Fallback: just show seconds
  return [pad(seconds)];
}
