/**
 * Colour helpers for the orb theme.
 *
 * Small and dependency-free: the studio needs hex ⇄ HSL so it can derive a
 * second gradient stop by shifting hue and lightness, which `color-mix()`
 * cannot do on its own.
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Accepts #rgb and #rrggbb. Returns null for anything else. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function isHexColor(value: string): boolean {
  return parseHex(value) !== null;
}

export function toRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex) ?? { r: 34, g: 211, b: 238 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function hexToHsl(hex: string): Hsl {
  const rgb = parseHex(hex) ?? { r: 34, g: 211, b: 238 };
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;

  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];

  const hex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Shifts hue and lightness in one step. Used to build gradient stops. */
export function shift(hex: string, deltaHue: number, deltaLightness: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({
    h: hsl.h + deltaHue,
    s: hsl.s,
    l: Math.max(4, Math.min(96, hsl.l + deltaLightness)),
  });
}
