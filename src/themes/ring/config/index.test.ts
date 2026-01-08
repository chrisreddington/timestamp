import { describe, it, expect } from 'vitest';
import { RING_CONFIG } from './index';

describe('Ring Config', () => {
  describe('Theme Configuration', () => {
    it('should have valid theme ID', () => {
      expect(RING_CONFIG.id).toBe('ring');
    });

    it('should have required config properties', () => {
      expect(RING_CONFIG.name).toBeDefined();
      expect(RING_CONFIG.name).toMatch(/^[A-Z]/);
      expect(RING_CONFIG.description).toBeDefined();
      expect(RING_CONFIG.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(RING_CONFIG.author).toBeDefined();
    });

    it('should have sensible supportsWorldMap setting', () => {
      expect(typeof RING_CONFIG.supportsWorldMap).toBe('boolean');
    });

    it('should have optional components configuration', () => {
      expect(RING_CONFIG.optionalComponents).toBeDefined();
      expect(typeof RING_CONFIG.optionalComponents.timezoneSelector).toBe('boolean');
      expect(typeof RING_CONFIG.optionalComponents.worldMap).toBe('boolean');
    });

    it('should have colors defined for both modes', () => {
      expect(RING_CONFIG.colors).toBeDefined();
      expect(RING_CONFIG.colors?.dark).toBeDefined();
      expect(RING_CONFIG.colors?.light).toBeDefined();
      expect(RING_CONFIG.colors?.dark?.accentPrimary).toBeDefined();
      expect(RING_CONFIG.colors?.light?.accentPrimary).toBeDefined();
    });
  });
});
