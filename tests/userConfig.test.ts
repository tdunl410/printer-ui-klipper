import { describe, expect, it } from 'vitest';
import { defaultBottomBarItems, normalizeBottomBarItems } from '../src/services/userConfig';

describe('bottom bar config', () => {
  it('uses the standard navigation when no saved selection exists', () => {
    expect(normalizeBottomBarItems(undefined)).toEqual(defaultBottomBarItems);
  });

  it('always includes Home and Settings and removes invalid or duplicate items', () => {
    expect(normalizeBottomBarItems(['preheat', 'preheat', 'unknown'])).toEqual(['home', 'preheat', 'settings']);
  });

  it('limits saved selections to five items', () => {
    expect(normalizeBottomBarItems(['extrude', 'preheat', 'control', 'print'])).toHaveLength(5);
  });
});
