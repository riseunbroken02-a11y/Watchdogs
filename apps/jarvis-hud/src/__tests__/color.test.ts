import { describe, expect, it } from 'vitest';
import { hexToHsl, hslToHex, isHexColor, parseHex, shift, toRgba } from '../utils/color';
import { gradientShift } from '../config/orb.config';

describe('colour helpers', () => {
  it('parses #rgb and #rrggbb, with or without the hash', () => {
    expect(parseHex('#22d3ee')).toEqual({ r: 34, g: 211, b: 238 });
    expect(parseHex('22d3ee')).toEqual({ r: 34, g: 211, b: 238 });
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('rejects anything else', () => {
    for (const bad of ['', '#12', 'rgb(1,2,3)', '#gggggg', '#1234567']) {
      expect(parseHex(bad)).toBeNull();
      expect(isHexColor(bad)).toBe(false);
    }
  });

  it('round-trips hex → hsl → hex', () => {
    for (const hex of ['#22d3ee', '#f87171', '#34d399', '#ffffff', '#000000', '#7f7f7f']) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });

  it('handles greys, where hue is undefined', () => {
    const hsl = hexToHsl('#808080');
    expect(hsl.s).toBe(0);
    expect(hslToHex(hsl)).toBe('#808080');
  });

  it('shift() moves hue and lightness and always returns a valid colour', () => {
    const shifted = shift('#22d3ee', 150, 10);
    expect(isHexColor(shifted)).toBe(true);
    expect(shifted).not.toBe('#22d3ee');
  });

  it('shift() clamps lightness instead of wrapping to black or white', () => {
    expect(isHexColor(shift('#ffffff', 0, 90))).toBe(true);
    expect(isHexColor(shift('#000000', 0, -90))).toBe(true);
    expect(shift('#ffffff', 0, 90)).not.toBe('#000000');
  });

  it('every gradient style produces a usable second stop for every swatch', () => {
    for (const [style, { hue, lightness }] of Object.entries(gradientShift)) {
      for (const base of ['#22d3ee', '#f87171', '#ffffff', '#101010']) {
        const second = shift(base, hue, lightness);
        expect(isHexColor(second), `${style} on ${base}`).toBe(true);
      }
    }
  });

  it('solid leaves the colour untouched', () => {
    expect(shift('#22d3ee', gradientShift.solid.hue, gradientShift.solid.lightness)).toBe('#22d3ee');
  });

  it('toRgba clamps alpha and falls back for a bad colour', () => {
    expect(toRgba('#22d3ee', 0.3)).toBe('rgba(34, 211, 238, 0.3)');
    expect(toRgba('#22d3ee', 5)).toBe('rgba(34, 211, 238, 1)');
    expect(toRgba('nonsense', 0.5)).toBe('rgba(34, 211, 238, 0.5)');
  });
});
