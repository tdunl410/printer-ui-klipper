export interface HsvColor {
  hue: number;
  saturation: number;
  value: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export function rgbToHex(rgb: readonly number[]): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

export function rgbToHsv([red, green, blue]: readonly number[]): HsvColor {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  return { hue: (hue * 60 + 360) % 360, saturation: max === 0 ? 0 : delta / max, value: max };
}

export function hsvToRgb({ hue, saturation, value }: HsvColor): [number, number, number] {
  const chroma = value * saturation;
  const sector = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs(sector % 2 - 1));
  const [r, g, b] = sector < 1 ? [chroma, x, 0]
    : sector < 2 ? [x, chroma, 0]
      : sector < 3 ? [0, chroma, x]
        : sector < 4 ? [0, x, chroma]
          : sector < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  const offset = value - chroma;
  return [Math.round((r + offset) * 255), Math.round((g + offset) * 255), Math.round((b + offset) * 255)];
}
