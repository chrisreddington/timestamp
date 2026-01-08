import SunCalc from 'suncalc';

const VISIBLE_HORIZON_RAD = (-0.833 * Math.PI) / 180;
const MIN_HEIGHT_METERS = 0.01;
const MIN_ALTITUDE_FOR_SHADOW_DEGREES = 0.5;

/**
 * Input parameters for computing solar position and the shadow length
 * of an object at a given location and time.
 */
export interface ShadowInput {
  /**
   * Physical height of the object casting the shadow, in meters.
   *
   * Must be at least `0.01` meters; smaller values will cause
   * {@link calculateShadowInfo} to throw.
   */
  heightMeters: number;
  /**
   * Geographic latitude of the observer in decimal degrees.
   *
   * Positive values indicate north of the equator, negative values south.
   * Typical range is -90 to 90 degrees (inclusive).
   */
  latitude: number;
  /**
   * Geographic longitude of the observer in decimal degrees.
   *
   * Positive values indicate east of the Prime Meridian, negative values west.
   * Typical range is -180 to 180 degrees (inclusive).
   */
  longitude: number;
  /**
   * Date and time for which to compute the solar position.
   *
   * If omitted, the current time (`new Date()`) is used.
   */
  date?: Date;
}

/**
 * Computed solar position and shadow information for a given input.
 *
 * Instances of this interface are returned by {@link calculateShadowInfo}.
 */
export interface ShadowResult {
  /**
   * Solar altitude angle in degrees above the astronomical horizon.
   *
   * Positive values indicate the sun is above the horizon; negative values
   * indicate it is below.
   */
  altitudeDeg: number;
  /**
   * Solar azimuth angle in degrees, as reported by `SunCalc`.
   *
   * Measured from due south (0°) and increasing towards the west
   * (i.e., 90° is west, 180° is north, 270° is east).
   */
  azimuthDeg: number;
  /**
   * Length of the object's shadow on level ground, in meters.
   *
   * Will be `null` if the sun is below the visible horizon or if the
   * altitude is below the minimum threshold for reliable shadow length
   * computation (currently {@link MIN_ALTITUDE_FOR_SHADOW_DEGREES}).
   */
  shadowLengthMeters: number | null;
  /**
   * Indicates whether the sun is above the *visible* horizon.
   *
   * This uses the {@link VISIBLE_HORIZON_RAD} threshold (approximately
   * -0.833°) to account for atmospheric refraction and solar disc size.
   */
  isSunAboveHorizon: boolean;
  /**
   * Effective timestamp used for the calculation.
   *
   * This will equal the `date` provided in {@link ShadowInput} if supplied,
   * otherwise it is the `Date` at the moment of computation.
   */
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
