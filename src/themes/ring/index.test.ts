import { describe, expect, it } from 'vitest';
import * as entrypoint from './index';
import { RING_CONFIG } from './config';
import { ringTimePageRenderer } from './renderers/time-page-renderer';
import { ringLandingPageRenderer } from './renderers/landing-page-renderer';

/** Tests for ring theme entry point exports. */
describe('ring index', () => {
  it('should export configuration and renderer factories when the entry module loads', () => {
    expect(entrypoint.RING_CONFIG).toBe(RING_CONFIG);
    expect(entrypoint.ringTimePageRenderer).toBe(ringTimePageRenderer);
    expect(entrypoint.ringLandingPageRenderer).toBe(ringLandingPageRenderer);
  });

  it('should expose export names expected by the registry when importing the theme module', () => {
    const { RING_CONFIG: config, ringTimePageRenderer: timeRenderer, ringLandingPageRenderer: landingRenderer } = entrypoint;

    expect(config).toBeDefined();
    expect(typeof timeRenderer).toBe('function');
    expect(typeof landingRenderer).toBe('function');
  });
});
