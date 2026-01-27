import { describe, it, expect } from 'vitest';
import { AKHIL_SQUARE_SHADOW_CONFIG } from './index';

describe('AkhilSquareShadow Config', () => {
  describe('Theme Configuration', () => {
    it('should have valid theme ID', () => {
      expect(AKHIL_SQUARE_SHADOW_CONFIG.id).toBe('akhil-square-shadow');
    });

    it('should have required config properties', () => {
      expect(AKHIL_SQUARE_SHADOW_CONFIG.name).toBeDefined();
      expect(AKHIL_SQUARE_SHADOW_CONFIG.name).toMatch(/^[A-Z]/);
      expect(AKHIL_SQUARE_SHADOW_CONFIG.description).toBeDefined();
      expect(AKHIL_SQUARE_SHADOW_CONFIG.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(AKHIL_SQUARE_SHADOW_CONFIG.author).toBeDefined();
    });

    it('should have sensible supportsWorldMap setting', () => {
      expect(typeof AKHIL_SQUARE_SHADOW_CONFIG.supportsWorldMap).toBe('boolean');
    });

    it('should have optional components configuration', () => {
      expect(AKHIL_SQUARE_SHADOW_CONFIG.optionalComponents).toBeDefined();
      expect(typeof AKHIL_SQUARE_SHADOW_CONFIG.optionalComponents.timezoneSelector).toBe('boolean');
      expect(typeof AKHIL_SQUARE_SHADOW_CONFIG.optionalComponents.worldMap).toBe('boolean');
    });

    it('should have colors defined for both modes', () => {
      expect(AKHIL_SQUARE_SHADOW_CONFIG.colors).toBeDefined();
      expect(AKHIL_SQUARE_SHADOW_CONFIG.colors?.dark).toBeDefined();
      expect(AKHIL_SQUARE_SHADOW_CONFIG.colors?.light).toBeDefined();
      expect(AKHIL_SQUARE_SHADOW_CONFIG.colors?.dark?.accentPrimary).toBeDefined();
      expect(AKHIL_SQUARE_SHADOW_CONFIG.colors?.light?.accentPrimary).toBeDefined();
    });
  });
});
