/**
 * Ring Theme
 *
 * A countdown theme featuring a pulsing ring animation that demonstrates:
 * - Animation state management (distinct from orchestrator lifecycle)
 * - Proper pause/resume via onAnimationStateChange hook
 * - State object pattern for explicit, testable state
 * - Resource tracking with createResourceTracker()
 *
 * @remarks
 * Entry point for the ring theme. Exports theme configuration
 * and renderer factories for registry integration.
 *
 * Architecture:
 * - index.ts: Clean entry point (exports only, no implementation)
 * - config/: Theme configuration and constants
 * - renderers/: TimePageRenderer and LandingPageRenderer implementations
 * - utils/ui/: DOM creation and manipulation utilities
 */

import './styles.scss';

/** Theme configuration metadata and color scheme. */
export { RING_CONFIG } from './config';

/** Landing page renderer factory (animated background). */
export { ringLandingPageRenderer } from './renderers/landing-page-renderer';

/** Time page renderer factory (countdown display). */
export { ringTimePageRenderer } from './renderers/time-page-renderer';
