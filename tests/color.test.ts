import { describe, expect, it } from 'vitest';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from '../src/utils/color';

describe('color conversion', () => {
  it.each(['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#7b4dff', '#123456', '#fe0180'])(
    'round trips %s through HSV',
    (hex) => {
      expect(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb(hex))))).toBe(hex);
    },
  );

  it('maps wheel hues, saturation and brightness to RGB', () => {
    expect(hsvToRgb({ hue: 60, saturation: 1, value: 1 })).toEqual([255, 255, 0]);
    expect(hsvToRgb({ hue: 240, saturation: 0, value: 0.5 })).toEqual([128, 128, 128]);
    expect(hsvToRgb({ hue: 180, saturation: 1, value: 0 })).toEqual([0, 0, 0]);
  });
});
