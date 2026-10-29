/**
 * Solar calculation utilities for day/night visualization.
 */

import * as SunCalc from 'suncalc';

const declinationCache = new Map<number, number>();
const MAX_CACHE_SIZE = 60;

/** Evict oldest entry if cache exceeds max size. @internal */
function evictOldest(cache: Map<number, unknown>): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}

/** Calculate solar declination (latitude where sun is directly overhead). @internal */
function getSolarDeclination(date: Date): number {
  const key = Math.floor(date.getTime() / 60000);
  const cached = declinationCache.get(key);
  if (cached !== undefined) return cached;

  const times = SunCalc.getTimes(date, 0, 0);
  const sunAtNoon = SunCalc.getPosition(times.solarNoon, 0, 0);
  const altitudeAtNoon = sunAtNoon.altitude;
  // NOTE: At equator solar noon: altitude = 90° - |declination|
  const declinationMagnitude = 90 - altitudeAtNoon;

  const hoursFromMidnight =
    (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) % 24;
  const refLng = ((12 - hoursFromMidnight) * 15 + 540) % 360 - 180;

  const sunNorth = SunCalc.getPosition(date, declinationMagnitude, refLng);
  const sunSouth = SunCalc.getPosition(date, -declinationMagnitude, refLng);
  const declination =
    sunSouth.altitude > sunNorth.altitude ? -declinationMagnitude : declinationMagnitude;

  evictOldest(declinationCache);
  declinationCache.set(key, declination);
  return declination;
}

/** Calculate subsolar longitude (where it's currently solar noon). @internal */
function getSubsolarLongitude(date: Date): number {
  const hoursFromMidnight =
    (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) % 24;
  return ((12 - hoursFromMidnight) * 15 + 540) % 360 - 180;
}

/**
 * Check if a location is currently in the night region.
 * @param lat - Latitude (-90 to 90)
 * @param lng - Longitude (-180 to 180)
 * @param date - Date/time to check
 * @returns true if sun is below horizon
 * @public
 */
export function isNight(lat: number, lng: number, date: Date): boolean {
  const sunPos = SunCalc.getPosition(date, lat, lng);
  // NOTE: Atmospheric refraction adds ~0.833° to visible horizon
  // SunCalc v2 returns degrees
  return sunPos.altitude < -0.833;
}

/** Generate points along the solar terminator line. @internal */
function getTerminatorPoints(
  date: Date,
  numPoints: number = 72
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  const declination = getSolarDeclination(date);
  const subSolarLng = getSubsolarLongitude(date);
  const decRad = (declination * Math.PI) / 180;

  // NOTE: At equinox (declination ≈ 0), terminator is a straight meridian
  if (Math.abs(declination) < 0.01) {
    for (let i = 0; i < numPoints; i++) {
      const lat = 90 - (i / (numPoints - 1)) * 180;
      const lng = ((subSolarLng + 90 + 540) % 360) - 180;
      points.push({ lat, lng });
    }
    return points;
  }

  for (let i = 0; i < numPoints; i++) {
    const H = (i / numPoints) * 2 * Math.PI - Math.PI;
    const H_deg = (H * 180) / Math.PI;
    const latRad = Math.atan(-Math.cos(H) / Math.tan(decRad));
    const lat = (latRad * 180) / Math.PI;
    const lng = ((subSolarLng - H_deg + 540) % 360) - 180;
    points.push({ lat, lng });
  }

  points.sort((a, b) => a.lng - b.lng);
  return points;
}

/**
 * Generate SVG path for the night region polygon.
 * @param date - Date/time to calculate for
 * @param projection - Function converting lat/lng to SVG coordinates
 * @param viewBox - SVG viewBox dimensions
 * @returns SVG path data string
 * @public
 */
export function getNightRegionPath(
  date: Date,
  projection: (lat: number, lng: number) => { x: number; y: number },
  viewBox: { width: number; height: number }
): string {
  const terminatorPoints = getTerminatorPoints(date, 180);
  if (terminatorPoints.length === 0) return '';

  const projected = terminatorPoints.map((p) => projection(p.lat, p.lng));
  const northPoleIsNight = isNight(85, 0, date);
  const pathParts: string[] = [];

  if (northPoleIsNight) {
    pathParts.push(`M0,0`);
    pathParts.push(`L${viewBox.width},0`);
    const lastPt = projected[projected.length - 1];
    pathParts.push(`L${viewBox.width},${lastPt.y.toFixed(1)}`);
    pathParts.push(`L${lastPt.x.toFixed(1)},${lastPt.y.toFixed(1)}`);
    for (let i = projected.length - 2; i >= 0; i--) {
      const pt = projected[i];
      pathParts.push(`L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
    }
    pathParts.push(`L0,${projected[0].y.toFixed(1)}`);
  } else {
    pathParts.push(`M0,${viewBox.height}`);
    pathParts.push(`L${viewBox.width},${viewBox.height}`);
    const lastPt = projected[projected.length - 1];
    pathParts.push(`L${viewBox.width},${lastPt.y.toFixed(1)}`);
    pathParts.push(`L${lastPt.x.toFixed(1)},${lastPt.y.toFixed(1)}`);
    for (let i = projected.length - 2; i >= 0; i--) {
      const pt = projected[i];
      pathParts.push(`L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
    }
    pathParts.push(`L0,${projected[0].y.toFixed(1)}`);
  }

  pathParts.push('Z');
  return pathParts.join(' ');
}

/** Clear cached solar calculations. @internal */
export function clearSolarCache(): void {
  declinationCache.clear();
}

// NOTE: Test-only exports for verifying internal calculations
export const _testExports = {
  getSolarDeclination,
  getSubsolarLongitude,
  getTerminatorPoints,
};
