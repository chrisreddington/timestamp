import { describe, expect, it } from 'vitest';
import * as entrypoint from './index';
import { CHRISREDDINGTON_CONFIG } from './config';
import { chrisreddingtonTimePageRenderer } from './renderers/time-page-renderer';
import { chrisreddingtonLandingPageRenderer } from './renderers/landing-page-renderer';

/** Tests for chrisreddington theme entry point exports. */
describe('chrisreddington index', () => {
  it('should export configuration and renderer factories when the entry module loads', () => {
    expect(entrypoint.CHRISREDDINGTON_CONFIG).toBe(CHRISREDDINGTON_CONFIG);
    expect(entrypoint.chrisreddingtonTimePageRenderer).toBe(chrisreddingtonTimePageRenderer);
    expect(entrypoint.chrisreddingtonLandingPageRenderer).toBe(chrisreddingtonLandingPageRenderer);
  });

  it('should expose export names expected by the registry when importing the theme module', () => {
    const {
      CHRISREDDINGTON_CONFIG: config,
      chrisreddingtonTimePageRenderer: timeRenderer,
      chrisreddingtonLandingPageRenderer: landingRenderer,
    } = entrypoint;

    expect(config).toBeDefined();
    expect(typeof timeRenderer).toBe('function');
    expect(typeof landingRenderer).toBe('function');
  });
});
