/**
 * Shadow Calculations - Sun position and shadow length computation.
 *
 * Handles all mathematical calculations for shadow length and sun position
 * using the SunCalc library. Guards against edge cases like sun near horizon.
 */

import SunCalc from 'suncalc';

/**
 * Geographic coordinates.
 */
export interface GeoCoords {
  latitude: number;
  longitude: number;
}

/**
 * Result from shadow calculation.
 */
export interface ShadowInfo {
  altitudeDeg: number;
  azimuthDeg: number;
  shadowLengthMeters: number | null;
}

const MIN_ALTITUDE_DEG = 0.5;
const MAX_SHADOW_LENGTH_METERS = 1000;

/**
 * Calculate shadow info for an object at a given location and time.
 * Uses SunCalc to determine sun position and derives shadow length from altitude.
 * Includes guards against edge cases (sun near horizon).
 *
 * @param params - Calculation parameters (height, location, date/time)
 * @returns Shadow info including altitude, azimuth, and shadow length
 */
export function calculateShadowInfo(params: {
  heightMeters: number;
  latitude: number;
  longitude: number;
  date: Date;
}): ShadowInfo {
  const { heightMeters, latitude, longitude, date } = params;
  const sunPos = SunCalc.getPosition(date, latitude, longitude);

  const altitudeDeg = sunPos.altitude * (180 / Math.PI);
  const azimuthDeg = ((sunPos.azimuth * (180 / Math.PI)) + 180) % 360;
  let shadowLengthMeters: number | null = null;
  if (altitudeDeg > MIN_ALTITUDE_DEG) {
    const altitudeRad = sunPos.altitude;
    shadowLengthMeters = heightMeters / Math.tan(altitudeRad);
    shadowLengthMeters = Math.min(shadowLengthMeters, MAX_SHADOW_LENGTH_METERS);
  }

  return { altitudeDeg, azimuthDeg, shadowLengthMeters };
}
