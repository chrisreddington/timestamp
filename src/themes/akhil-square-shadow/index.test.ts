import { describe, expect, it } from 'vitest';
import * as entrypoint from './index';
import { AKHIL_SQUARE_SHADOW_CONFIG } from './config';
import { akhilSquareShadowTimePageRenderer } from './renderers/time-page-renderer';
import { akhilSquareShadowLandingPageRenderer } from './renderers/landing-page-renderer';

/** Tests for akhil-square-shadow theme entry point exports. */
describe('akhil-square-shadow index', () => {
  it('should export configuration and renderer factories when the entry module loads', () => {
    expect(entrypoint.AKHIL_SQUARE_SHADOW_CONFIG).toBe(AKHIL_SQUARE_SHADOW_CONFIG);
    expect(entrypoint.akhilSquareShadowTimePageRenderer).toBe(akhilSquareShadowTimePageRenderer);
    expect(entrypoint.akhilSquareShadowLandingPageRenderer).toBe(akhilSquareShadowLandingPageRenderer);
  });

  it('should expose export names expected by the registry when importing the theme module', () => {
    const { AKHIL_SQUARE_SHADOW_CONFIG: config, akhilSquareShadowTimePageRenderer: timeRenderer, akhilSquareShadowLandingPageRenderer: landingRenderer } = entrypoint;

    expect(config).toBeDefined();
    expect(typeof timeRenderer).toBe('function');
    expect(typeof landingRenderer).toBe('function');
  });
});
