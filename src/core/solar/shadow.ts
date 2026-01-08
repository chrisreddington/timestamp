import SunCalc from 'suncalc';

const VISIBLE_HORIZON_RAD = (-0.833 * Math.PI) / 180;
const MIN_HEIGHT_METERS = 0.01;
const MIN_ALTITUDE_FOR_SHADOW_DEGREES = 0.5;

export interface ShadowInput {
  heightMeters: number;
  latitude: number;
  longitude: number;
  /** Optional date/time; defaults to now. */
  date?: Date;
}

export interface ShadowResult {
  altitudeDeg: number;
  azimuthDeg: number;
  shadowLengthMeters: number | null;
  isSunAboveHorizon: boolean;
  timestamp: Date;
}

/**
 * Compute solar position and shadow length for an object.
 *
 * @param input - Object height and observer location/time
 * @returns Solar altitude/azimuth and expected shadow length (or null if sun is below horizon)
 */
export function calculateShadowInfo(input: ShadowInput): ShadowResult {
  if (input.heightMeters < MIN_HEIGHT_METERS) {
    throw new Error('heightMeters must be at least 0.01 meters');
  }

  const timestamp = input.date ?? new Date();
  const sunPos = SunCalc.getPosition(timestamp, input.latitude, input.longitude);
  const altitudeDeg = sunPos.altitude * (180 / Math.PI);
  const azimuthDeg = sunPos.azimuth * (180 / Math.PI);
  const isSunAboveHorizon = sunPos.altitude > VISIBLE_HORIZON_RAD;

  if (!isSunAboveHorizon || altitudeDeg < MIN_ALTITUDE_FOR_SHADOW_DEGREES) {
    return {
      altitudeDeg,
      azimuthDeg,
      shadowLengthMeters: null,
      isSunAboveHorizon,
      timestamp,
    };
  }

  const shadowLengthMeters = input.heightMeters / Math.tan(sunPos.altitude);

  return {
    altitudeDeg,
    azimuthDeg,
    shadowLengthMeters,
    isSunAboveHorizon,
    timestamp,
  };
}
