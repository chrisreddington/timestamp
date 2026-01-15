/**
 * Sun/Moon Shadow Rotator Theme
 *
 * A countdown theme featuring celestial body animations that demonstrates:
 * - Sun/moon orbit with dynamic shadow casting on countdown digits
 * - Shadow calculator overlay using SunCalc for real-time sun position
 * - Day/night cycle with smooth sky gradient transitions
 * - Geolocation support for accurate shadow calculations
 *
 * @remarks
 * Entry point for the akhil-square-shadow theme. Exports theme configuration
 * and renderer factories for registry integration.
 *
 * Architecture:
 * - index.ts: Clean entry point (exports only, no implementation)
 * - config/: Theme configuration and animation constants
 * - renderers/: TimePageRenderer, LandingPageRenderer, and ShadowOverlay
 * - utils/ui/: DOM creation for sky, celestial bodies, and countdown display
 * - utils/time-page/: Animation loop and orbital mechanics
 */

import './styles.scss';

/** Theme configuration metadata and color scheme. */
export { AKHIL_SQUARE_SHADOW_CONFIG } from './config';

/** Landing page renderer factory (animated background). */
export { akhilSquareShadowLandingPageRenderer } from './renderers/landing-page-renderer';

/** Time page renderer factory (countdown display). */
export { akhilSquareShadowTimePageRenderer } from './renderers/time-page-renderer';
