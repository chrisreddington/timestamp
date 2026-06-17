import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { isProfilingEnabled, perfMonitor, measureAsync } from './perf-monitor';

// Global flag injected by build tooling; declared here for typing in tests.
declare const __PROFILING__: boolean | undefined;

type PerfMonitorShape = {
  start: () => void;
  stop: () => void;
  record: () => void;
  recordOperation: (label: string, duration: number) => void;
  getStats: () => unknown;
  getSnapshot: () => { operations: Array<{ label: string; duration: number }> };
  clear: () => void;
  isActive: () => boolean;
  subscribe: () => () => void;
};

const originalEnv = { ...(import.meta as { env: Record<string, unknown> }).env };

function createLiveMonitorStub(): PerfMonitorShape {
  const operations: Array<{ label: string; duration: number }> = [];
  return {
    start: vi.fn(),
    stop: vi.fn(),
    record: vi.fn(),
    recordOperation: vi.fn((label, duration) => {
      operations.push({ label, duration });
    }),
    getStats: vi.fn(),
    getSnapshot: vi.fn(() => ({ operations: [...operations] })),
    clear: vi.fn(() => operations.splice(0, operations.length)),
    isActive: vi.fn(() => true),
    subscribe: vi.fn(() => () => {}),
  };
}

async function loadPerfMonitor({
  profilingValue,
  profilingDefined,
  dev,
  envDefined = true,
}: {
  profilingValue?: boolean;
  profilingDefined: boolean;
  dev: boolean;
  envDefined?: boolean;
}): Promise<{ perfMonitor: PerfMonitorShape; createLiveMonitorSpy: ReturnType<typeof vi.fn> }>
{
  vi.resetModules();

  const liveMonitorStub = createLiveMonitorStub();
  const createLiveMonitorSpy = vi.fn(() => liveMonitorStub);
  vi.doMock('./live-monitor', () => ({ createLiveMonitor: createLiveMonitorSpy }));

  // Handle __PROFILING__ global - must use stubGlobal for both cases
  // to properly control the value (vitest.setup.ts sets it by default)
  if (profilingDefined) {
    vi.stubGlobal('__PROFILING__', profilingValue);
  } else {
    // Stub as undefined to simulate the global not being defined
    vi.stubGlobal('__PROFILING__', undefined);
  }

  if (envDefined) {
    (import.meta as { env: Record<string, unknown> }).env = { ...originalEnv, DEV: dev };
  } else {
    (import.meta as { env: Record<string, unknown> }).env = undefined as unknown as Record<string, unknown>;
  }

  const { perfMonitor } = await import('./perf-monitor');
  return { perfMonitor: perfMonitor as PerfMonitorShape, createLiveMonitorSpy };
}

describe('isProfilingEnabled', () => {
  describe('with explicit flag overrides', () => {
    it.each([
      [true, true, true, 'enabled when both flags true'],
      [false, true, false, 'disabled when profiling flag false'],
      [true, false, false, 'disabled when dev flag false'],
      [false, false, false, 'disabled when both flags false'],
    ])('returns %s when profiling=%s and dev=%s (%s)', (profiling, dev, expected) => {
      expect(isProfilingEnabled(profiling, dev)).toBe(expected);
    });
  });

  describe('with default behavior (uses globals)', () => {
    it('should return true when __PROFILING__ and DEV are both true', () => {
      // In test environment, both should be true by default
      expect(isProfilingEnabled()).toBe(true);
    });
  });
});

describe('perf-monitor profiling gate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    (import.meta as { env: Record<string, unknown> }).env = { ...originalEnv };
  });

  it('should instantiate live monitor when __PROFILING__ is truthy and dev mode is true', async () => {
    const { perfMonitor, createLiveMonitorSpy } = await loadPerfMonitor({
      profilingDefined: true,
      profilingValue: true,
      dev: true,
    });

    expect(createLiveMonitorSpy).toHaveBeenCalledTimes(1);
    perfMonitor.recordOperation('live-op', 5);
    expect(perfMonitor.getSnapshot().operations).toEqual([{ label: 'live-op', duration: 5 }]);
    expect(perfMonitor.isActive()).toBe(true);
  });

  it.each([
    ['profiling flag false in dev', { profilingDefined: true, profilingValue: false, dev: true }],
    ['profiling flag undefined in dev', { profilingDefined: false, profilingValue: undefined, dev: true }],
  ])('should return null monitor when %s', async (_desc, config) => {
    const { perfMonitor, createLiveMonitorSpy } = await loadPerfMonitor({
      ...config,
      envDefined: true,
    });

    expect(createLiveMonitorSpy).not.toHaveBeenCalled();
    perfMonitor.recordOperation('noop', 7);
    expect(perfMonitor.getSnapshot().operations).toEqual([]);
    expect(perfMonitor.isActive()).toBe(false);
  });
});

const recordValues = (metric: 'fps' | 'tick' | 'inp', values: number[]) => {
  values.forEach(value => perfMonitor.record(metric, value));
  return perfMonitor.getStats(metric);
};

describe('perfMonitor', () => {
  beforeEach(() => {
    perfMonitor.clear();
    perfMonitor.stop();
  });

  afterEach(() => {
    perfMonitor.stop();
  });

  describe('start/stop', () => {
    it('should start and stop monitoring', () => {
      expect(perfMonitor.isActive()).toBe(false);
      perfMonitor.start();
      expect(perfMonitor.isActive()).toBe(true);
      perfMonitor.stop();
      expect(perfMonitor.isActive()).toBe(false);
    });

    it('should not start twice', () => {
      perfMonitor.start();
      perfMonitor.start();
      expect(perfMonitor.isActive()).toBe(true);
    });

    it('should not stop when not started', () => {
      perfMonitor.stop();
      expect(perfMonitor.isActive()).toBe(false);
    });
  });

  describe('record', () => {
    it('should record metric values', () => {
      const stats = recordValues('fps', [60, 58, 62]);
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(3);
      expect(stats?.avg).toBeCloseTo(60);
    });

    it('should maintain bounded buffer size', () => {
      const stats = recordValues('tick', Array.from({ length: 300 }, (_, i) => i));
      expect(stats?.count).toBe(256);
    });
  });

  describe('recordOperation', () => {
    it('should record operations with timestamps', () => {
      perfMonitor.recordOperation('test-op', 42.5);
      const snapshot = perfMonitor.getSnapshot();
      expect(snapshot.operations).toHaveLength(1);
      expect(snapshot.operations[0].label).toBe('test-op');
      expect(snapshot.operations[0].duration).toBe(42.5);
      expect(snapshot.operations[0].timestamp).toBeGreaterThan(0);
    });

    it('should limit operations log size', () => {
      for (let i = 0; i < 60; i++) perfMonitor.recordOperation(`op-${i}`, i);
      const snapshot = perfMonitor.getSnapshot();
      expect(snapshot.operations.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getStats', () => {
    it('should calculate correct percentiles', () => {
      const stats = recordValues('fps', Array.from({ length: 100 }, (_, i) => i + 1));
      expect(stats?.p50).toBe(50);
      expect(stats?.p95).toBe(95);
      expect(stats?.p99).toBe(99);
      expect(stats?.min).toBe(1);
      expect(stats?.max).toBe(100);
    });

    it('should return null for empty metric', () => {
      expect(perfMonitor.getStats('inp')).toBeNull();
    });

    it('should return correct statistics for recorded metrics', () => {
      const stats = recordValues('fps', [60, 58, 62]);
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(3);
      expect(stats?.min).toBe(58);
      expect(stats?.max).toBe(62);
      expect(stats?.avg).toBeCloseTo(60);
    });

    it('should calculate percentiles for single value', () => {
      const stats = recordValues('inp', [42]);
      expect(stats?.p50).toBe(42);
      expect(stats?.p95).toBe(42);
      expect(stats?.p99).toBe(42);
    });
  });

  describe('getSnapshot', () => {
    it('should return current state', () => {
      perfMonitor.record('fps', 60);
      perfMonitor.recordOperation('test', 10);
      const snapshot = perfMonitor.getSnapshot();
      expect(snapshot.domNodes).toBeGreaterThan(0);
      expect(snapshot.operations).toHaveLength(1);
      expect(snapshot.stats.fps).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all recorded data', () => {
      perfMonitor.record('fps', 60);
      perfMonitor.record('tick', 1);
      perfMonitor.recordOperation('test', 10);
      perfMonitor.clear();
      const snapshot = perfMonitor.getSnapshot();
      expect(snapshot.operations).toHaveLength(0);
      expect(perfMonitor.getStats('fps')).toBeNull();
      expect(perfMonitor.getStats('tick')).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers on updates', async () => {
      const callback = vi.fn();
      const unsubscribe = perfMonitor.subscribe(callback);
      perfMonitor.recordOperation('test', 10);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        operations: expect.arrayContaining([expect.objectContaining({ label: 'test' })])
      }));
      unsubscribe();
      perfMonitor.recordOperation('test2', 20);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

describe('measureAsync', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('should measure duration of synchronous function', async () => {
    const { result, duration } = await measureAsync('test-sync', () => 42);
    expect(result).toBe(42);
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('should measure duration of asynchronous function', async () => {
    const { result, duration } = await measureAsync('test-async', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 'done';
    });
    expect(result).toBe('done');
    expect(duration).toBeGreaterThanOrEqual(9);
  });

  it('should handle action that throws error', async () => {
    await expect(measureAsync('test-error', () => { throw new Error('Test error'); }))
      .rejects.toThrow('Test error');
  });

  it('should handle async action that rejects', async () => {
    await expect(measureAsync('test-reject', async () => { await Promise.reject(new Error('Async error')); }))
      .rejects.toThrow('Async error');
  });
});
