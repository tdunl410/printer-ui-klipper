import { describe, expect, it } from 'vitest';
import {
  defaultBottomBarItems,
  getUiConfig,
  normalizeBottomBarItems,
  normalizeDisplayBrightness,
  normalizeSleepTimeout,
} from '../src/services/userConfig';

describe('bottom bar config', () => {
  it('uses the standard navigation when no saved selection exists', () => {
    expect(normalizeBottomBarItems(undefined)).toEqual(defaultBottomBarItems);
  });

  describe('display config', () => {
    it('defaults to full brightness and no automatic sleep', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response(JSON.stringify({ config: {} }), { status: 200 });

      try {
        const config = await getUiConfig();
        expect(config.display).toEqual({
          brightness: 100,
          idleSleepTimeout: 'never',
          printingSleepTimeout: 'never',
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('normalizes brightness and sleep timeout values', () => {
      expect(normalizeDisplayBrightness(0)).toBe(10);
      expect(normalizeDisplayBrightness(120)).toBe(100);
      expect(normalizeSleepTimeout(20)).toBe(20);
      expect(normalizeSleepTimeout('invalid')).toBe('never');
    });
  });

  it('always includes Home and Settings and removes invalid or duplicate items', () => {
    expect(normalizeBottomBarItems(['preheat', 'preheat', 'unknown'])).toEqual(['home', 'preheat', 'settings']);
  });

  it('limits saved selections to five items', () => {
    expect(normalizeBottomBarItems(['extrude', 'preheat', 'control', 'print'])).toHaveLength(5);
  });
});
