/**
 * Shared fixtures and helpers for world map tests.
 */
import type { WallClockTime } from '@core/types';
import { vi } from 'vitest';

import type { CityMarker } from '@/app/data/cities';

import { createWorldMap, type WorldMapController } from './index';

/** Convert a Date into a WallClockTime shape. */
function toWallClock(date: Date): WallClockTime {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  };
}

/** Default wall-clock target far in the future to avoid celebration edge cases. */
export const TEST_WALL_CLOCK_TARGET = toWallClock(new Date('2099-01-01T00:00:00Z'));

/** Wall-clock target for New Year midnight scenarios. */
export const NEW_YEAR_WALL_CLOCK = toWallClock(new Date('2025-01-01T00:00:00Z'));

export interface RenderWorldMapOptions {
  initialTimezone?: string;
  wallClockTarget?: WallClockTime;
  getCurrentTime?: () => Date;
}

export interface WorldMapHarness {
  container: HTMLElement;
  controller: WorldMapController;
  getMarkers: () => NodeListOf<Element>;
  getNightOverlay: () => SVGPathElement | null;
  cleanup: () => void;
}

/**
 * Render a world map into a fresh container and return helpers.
 */
export function renderWorldMap(options: RenderWorldMapOptions = {}): WorldMapHarness {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const controller = createWorldMap(container, {
    initialTimezone: options.initialTimezone ?? 'UTC',
    wallClockTarget: options.wallClockTarget ?? TEST_WALL_CLOCK_TARGET,
    getCurrentTime: options.getCurrentTime,
  });

  const getMarkers = (): NodeListOf<Element> => container.querySelectorAll('.city-marker');
  const getNightOverlay = (): SVGPathElement | null => container.querySelector('[data-testid="night-overlay"]');

  const cleanup = (): void => {
    // Clear celebration state before destroying to prevent state leakage
    const markers = container.querySelectorAll('.city-marker');
    markers.forEach((marker) => {
      marker.classList.remove('city-celebrated');
      marker.setAttribute('data-celebrating', 'false');
    });
    controller.destroy();
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  };

  return { container, controller, getMarkers, getNightOverlay, cleanup };
}

/**
 * Create a mock map of marker elements keyed by timezone.
 */
export function createMarkerElements(cities: readonly CityMarker[]): Map<string, HTMLButtonElement> {
  const markers = new Map<string, HTMLButtonElement>();
  cities.forEach((city) => {
    const el = document.createElement('button');
    markers.set(city.timezone, el);
  });
  return markers;
}

/**
 * Create a mock night overlay path element with a spy on setAttribute.
 */
export function createNightOverlay(): SVGPathElement {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  vi.spyOn(path, 'setAttribute');
  return path;
}
