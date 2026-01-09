/**
 * Tests for canvas grid state management.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { GRID_CONFIG } from '../../config';
import {
    calculateGridDimensions,
    clearDirty,
    createCanvasGridState,
    getSquare,
    markDirty,
    markFullRepaint,
    resetSquares,
    type CanvasGridState,
} from './state';

describe('calculateGridDimensions', () => {
  it('should calculate dimensions for standard viewport', () => {
    const result = calculateGridDimensions(1920, 1080);

    expect(result.cols).toBeGreaterThan(0);
    expect(result.rows).toBeGreaterThan(0);
    expect(result.squareSize).toBeGreaterThanOrEqual(GRID_CONFIG.minSquareSize);
    expect(result.squareSize).toBeLessThanOrEqual(GRID_CONFIG.maxSquareSize);
    expect(result.gap).toBeGreaterThanOrEqual(0);
  });

  it('should scale square size proportionally for large viewports', () => {
    // At 4000px width, squares should scale up from base 16px
    const result = calculateGridDimensions(4000, 3000);

    // Squares scale based on viewport width (base 16px at 1920px)
    // 4000 / 1920 ≈ 2.08x, so squares should be larger than 16px
    expect(result.squareSize).toBeGreaterThan(GRID_CONFIG.maxSquareSize);
    expect(result.squareSize).toBeLessThanOrEqual(32); // Max clamped at 32px
    
    // Gap should still be proportional to square size
    expect(result.gap).toBeGreaterThan(0);
    expect(result.gap / result.squareSize).toBeCloseTo(GRID_CONFIG.gapRatio, 1);
  });

  it('should respect minimum square size for small viewports', () => {
    const result = calculateGridDimensions(100, 100);

    expect(result.squareSize).toBe(GRID_CONFIG.minSquareSize);
    expect(result.cols).toBeGreaterThanOrEqual(1);
    expect(result.rows).toBeGreaterThanOrEqual(1);
  });

  it('should produce non-negative gap values', () => {
    const result = calculateGridDimensions(400, 300);

    expect(result.gap).toBeGreaterThanOrEqual(0);
  });
});

describe('createCanvasGridState', () => {
  it('should create state with correct dimensions', () => {
    const state = createCanvasGridState(800, 600);

    expect(state.cols).toBeGreaterThan(0);
    expect(state.rows).toBeGreaterThan(0);
    expect(state.width).toBeGreaterThanOrEqual(800);
    expect(state.height).toBeGreaterThanOrEqual(600);
  });

  it('should create squares array with correct count', () => {
    const state = createCanvasGridState(800, 600);

    expect(state.squares.length).toBe(state.cols * state.rows);
  });

  it('should initialize squares with default values', () => {
    const state = createCanvasGridState(400, 300);

    for (const square of state.squares) {
      expect(square.intensity).toBe(0);
      expect(square.isDigit).toBe(false);
      expect(square.isAmbient).toBe(false);
      expect(square.isWall).toBe(false);
      expect(square.isMessage).toBe(false);
      expect(square.isHovered).toBe(false);
    }
  });

  it('should start with fullRepaint flag set', () => {
    const state = createCanvasGridState(800, 600);

    expect(state.fullRepaint).toBe(true);
  });

  it('should have empty dirty squares set initially', () => {
    const state = createCanvasGridState(800, 600);

    expect(state.dirtySquares.size).toBe(0);
  });
});

describe('getSquare', () => {
  let state: CanvasGridState;

  beforeEach(() => {
    state = createCanvasGridState(500, 400);
  });

  it('should return square at valid position', () => {
    const square = getSquare(state, 0, 0);

    expect(square).toBeDefined();
    expect(square).toBe(state.squares[0]);
  });

  it('should return square at middle position', () => {
    const col = Math.floor(state.cols / 2);
    const row = Math.floor(state.rows / 2);
    const square = getSquare(state, col, row);

    expect(square).toBeDefined();
    expect(square).toBe(state.squares[row * state.cols + col]);
  });

  it('should return undefined for negative column', () => {
    expect(getSquare(state, -1, 0)).toBeUndefined();
  });

  it('should return undefined for column out of bounds', () => {
    expect(getSquare(state, state.cols, 0)).toBeUndefined();
  });

  it('should return undefined for negative row', () => {
    expect(getSquare(state, 0, -1)).toBeUndefined();
  });

  it('should return undefined for row out of bounds', () => {
    expect(getSquare(state, 0, state.rows)).toBeUndefined();
  });
});

describe('dirty tracking', () => {
  let state: CanvasGridState;

  beforeEach(() => {
    state = createCanvasGridState(500, 400);
    clearDirty(state); // Clear initial fullRepaint flag
  });

  describe('markDirty', () => {
    it('should add index to dirty set', () => {
      markDirty(state, 5);

      expect(state.dirtySquares.has(5)).toBe(true);
    });

    it('should not duplicate indices', () => {
      markDirty(state, 5);
      markDirty(state, 5);

      expect(state.dirtySquares.size).toBe(1);
    });

    it('should track multiple dirty squares', () => {
      markDirty(state, 1);
      markDirty(state, 10);
      markDirty(state, 100);

      expect(state.dirtySquares.size).toBe(3);
      expect(state.dirtySquares.has(1)).toBe(true);
      expect(state.dirtySquares.has(10)).toBe(true);
      expect(state.dirtySquares.has(100)).toBe(true);
    });
  });

  describe('markFullRepaint', () => {
    it('should set fullRepaint flag', () => {
      markFullRepaint(state);

      expect(state.fullRepaint).toBe(true);
    });
  });

  describe('clearDirty', () => {
    it('should clear dirty squares set', () => {
      markDirty(state, 1);
      markDirty(state, 2);

      clearDirty(state);

      expect(state.dirtySquares.size).toBe(0);
    });

    it('should clear fullRepaint flag', () => {
      markFullRepaint(state);

      clearDirty(state);

      expect(state.fullRepaint).toBe(false);
    });
  });
});

describe('resetSquares', () => {
  it('should reset all square states to default', () => {
    const state = createCanvasGridState(500, 400);

    // Modify some squares
    state.squares[0].isDigit = true;
    state.squares[0].intensity = 4;
    state.squares[1].isAmbient = true;
    state.squares[2].isWall = true;
    state.squares[3].isMessage = true;
    state.digitIndices.add(0);

    resetSquares(state);

    // All should be reset
    for (const square of state.squares) {
      expect(square.intensity).toBe(0);
      expect(square.isDigit).toBe(false);
      expect(square.isAmbient).toBe(false);
      expect(square.isWall).toBe(false);
      expect(square.isMessage).toBe(false);
    }
  });

  it('should clear digit indices', () => {
    const state = createCanvasGridState(500, 400);
    state.digitIndices.add(0);
    state.digitIndices.add(1);

    resetSquares(state);

    expect(state.digitIndices.size).toBe(0);
  });

  it('should clear digit bounds', () => {
    const state = createCanvasGridState(500, 400);
    state.digitBounds = { minCol: 0, maxCol: 10, minRow: 0, maxRow: 5 };

    resetSquares(state);

    expect(state.digitBounds).toBeNull();
  });

  it('should clear lastTimeStr', () => {
    const state = createCanvasGridState(500, 400);
    state.lastTimeStr = '12:34:56';

    resetSquares(state);

    expect(state.lastTimeStr).toBeNull();
  });

  it('should trigger full repaint', () => {
    const state = createCanvasGridState(500, 400);
    clearDirty(state);

    resetSquares(state);

    expect(state.fullRepaint).toBe(true);
  });
});
