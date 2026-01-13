/**
 * Celebration message rendering for canvas.
 *
 * Renders text messages using the same 5×7 pixel font patterns
 * as the DOM version with word wrapping support.
 */

import { DIGIT_HEIGHT, DIGIT_PATTERNS, DIGIT_WIDTH } from '../ui/patterns';
import { LETTER_PATTERNS } from '../ui/patterns/letters';
import { PUNCTUATION_PATTERNS } from '../ui/patterns/punctuation';
import type { CanvasGridState } from './state';
import { markDirty } from './state';

const CHAR_SPACING = 1;
const LINE_SPACING = 3;
const WORD_SPACING = 3;
const BOUNDING_BOX_MARGIN = 3;

/** Combined patterns for all supported characters. */
const ALL_PATTERNS: Record<string, number[][]> = {
  ...LETTER_PATTERNS,
  ...PUNCTUATION_PATTERNS,
  ...DIGIT_PATTERNS,
};

/**
 * Calculate width of a text line in grid columns.
 */
function celebrationLineWidth(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') {
      width += WORD_SPACING;
    } else {
      width += DIGIT_WIDTH;
      if (i < text.length - 1 && text[i + 1] !== ' ') {
        width += CHAR_SPACING;
      }
    }
  }
  return width;
}

/**
 * Clean message text (uppercase, alphanumeric + common punctuation).
 * Also decodes common HTML entities to handle cases where they might be present.
 */
function cleanMessage(message: string): string {
  // First decode common HTML entities that might have leaked in
  const decoded = message
    .replace(/&#39;/g, "'")  // Apostrophe
    .replace(/&apos;/g, "'") // Alternative apostrophe entity
    .replace(/&#x27;/g, "'") // Hex apostrophe entity
    .replace(/&quot;/g, '"') // Quote
    .replace(/&amp;/g, '&')  // Ampersand
    .replace(/&lt;/g, '<')   // Less than
    .replace(/&gt;/g, '>');  // Greater than

  return decoded
    .toUpperCase()
    .replace(/[^A-Z0-9 .,!?'-]/g, '')
    .trim();
}

/**
 * Wrap message into multiple lines with word boundaries.
 */
function wrapWords(message: string, maxCols: number, padding: number): string[] {
  const words = message.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  const maxWidth = maxCols - padding * 2;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = celebrationLineWidth(testLine);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);

  return lines;
}

/**
 * Render a single character at position.
 */
function renderChar(
  grid: CanvasGridState,
  char: string,
  startCol: number,
  startRow: number,
  messageIndices: Set<number>
): void {
  const pattern = ALL_PATTERNS[char];
  if (!pattern) return;

  for (let row = 0; row < DIGIT_HEIGHT; row++) {
    for (let col = 0; col < DIGIT_WIDTH; col++) {
      if (pattern[row][col] === 1) {
        const gridRow = startRow + row;
        const gridCol = startCol + col;

        if (gridCol >= 0 && gridCol < grid.cols && gridRow >= 0 && gridRow < grid.rows) {
          const idx = gridRow * grid.cols + gridCol;
          const square = grid.squares[idx];

          if (square) {
            square.isMessage = true;
            // Don't set pulseStartTime yet - will be set when revealed during unbuild
            square.pulseStartTime = 0;
            messageIndices.add(idx);
            markDirty(grid, idx);
          }
        }
      }
    }
  }
}

/**
 * Render a line of text centered at given row.
 */
function renderTextLine(
  grid: CanvasGridState,
  text: string,
  centerRow: number,
  messageIndices: Set<number>
): void {
  const width = celebrationLineWidth(text);
  const startCol = Math.floor((grid.cols - width) / 2);

  let currentCol = startCol;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === ' ') {
      currentCol += WORD_SPACING;
    } else {
      renderChar(grid, char, currentCol, centerRow, messageIndices);
      currentCol += DIGIT_WIDTH;
      if (i < text.length - 1 && text[i + 1] !== ' ') {
        currentCol += CHAR_SPACING;
      }
    }
  }
}

/**
 * Render celebration message as pixel art with auto-wrapping.
 * @returns Set of message square indices
 */
export function renderCelebrationMessage(
  grid: CanvasGridState,
  message: string
): Set<number> {
  const cleanedMessage = cleanMessage(message);
  const padding = 2;
  const lines = wrapWords(cleanedMessage, grid.cols, padding);
  const messageIndices = new Set<number>();

  const totalHeight = lines.length * DIGIT_HEIGHT + (lines.length - 1) * LINE_SPACING;
  const startRow = Math.floor((grid.rows - totalHeight) / 2);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineRow = startRow + i * (DIGIT_HEIGHT + LINE_SPACING);
    renderTextLine(grid, line, lineRow, messageIndices);
  }

  // Update bounding box for ambient exclusion (3-square margin like CSS)
  let minCol = grid.cols;
  let maxCol = 0;
  let minRow = grid.rows;
  let maxRow = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineRow = startRow + i * (DIGIT_HEIGHT + LINE_SPACING);
    const lineW = celebrationLineWidth(lines[i]);
    const lineStartCol = Math.floor((grid.cols - lineW) / 2);

    minCol = Math.min(minCol, lineStartCol);
    maxCol = Math.max(maxCol, lineStartCol + lineW - 1);
    minRow = Math.min(minRow, lineRow);
    maxRow = Math.max(maxRow, lineRow + DIGIT_HEIGHT - 1);
  }

  grid.digitBounds = {
    minCol: Math.max(0, minCol - BOUNDING_BOX_MARGIN),
    maxCol: Math.min(grid.cols - 1, maxCol + BOUNDING_BOX_MARGIN),
    minRow: Math.max(0, minRow - BOUNDING_BOX_MARGIN),
    maxRow: Math.min(grid.rows - 1, maxRow + BOUNDING_BOX_MARGIN),
  };

  return messageIndices;
}

/**
 * Clear celebration message.
 */
export function clearCelebrationMessage(grid: CanvasGridState): void {
  for (const square of grid.squares) {
    if (square.isMessage) {
      square.isMessage = false;
      markDirty(grid, grid.squares.indexOf(square));
    }
  }
  // Clear bounding box so ambient can use full grid
  grid.digitBounds = null;
}
