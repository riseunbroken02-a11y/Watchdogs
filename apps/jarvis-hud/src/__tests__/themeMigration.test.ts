import { describe, expect, it } from 'vitest';
import { migrateTheme, normaliseTheme } from '../kernel/themeSchema';
import { importTheme } from '../kernel/themeSerializer';
import { cloneDefaultTheme, THEME_VERSION } from '../config/orb.config';
import { shift } from '../utils/color';

/**
 * Version 1 had no secondary colour: it derived one from a gradient style and a
 * depth. A save from that version must come across looking identical, not be
 * thrown away.
 */

const v1 = (over: Record<string, unknown> = {}) => ({
  version: 1,
  shape: 'orb',
  size: 1.1,
  glow: 1.3,
  speed: 0.9,
  gradient: 'aurora',
  gradientDepth: 0.5,
  motion: 'pulse',
  states: {
    idle: { color: '#22d3ee', tempoScale: 1, glowScale: 1 },
    listening: { color: '#38bdf8', tempoScale: 0.7, glowScale: 1.1 },
    thinking: { color: '#a78bfa', tempoScale: 0.45, glowScale: 1.25 },
    working: { color: '#fbbf24', tempoScale: 0.35, glowScale: 1.4 },
    success: { color: '#34d399', tempoScale: 0.8, glowScale: 1.2 },
    error: { color: '#f87171', tempoScale: 0.25, glowScale: 1.5 },
  },
  ...over,
});

describe('version 2 → 3 migration', () => {
  /** A version 2 theme: everything current, minus the opacity fields. */
  const v2 = () => {
    const current = cloneDefaultTheme();
    const states = Object.fromEntries(
      Object.entries(current.states).map(([key, style]) => {
        const { opacityScale: _dropped, ...rest } = style;
        return [key, rest];
      }),
    );
    const { opacity: _also, ...rest } = current;
    return { ...rest, version: 2, states };
  };

  it('adds opacity at full strength, so nothing visibly changes', () => {
    const theme = normaliseTheme(v2());

    expect(theme.opacity).toBe(1);
    for (const style of Object.values(theme.states)) {
      expect(style.opacityScale).toBe(1);
    }
  });

  it('keeps everything version 2 could express', () => {
    const theme = normaliseTheme({ ...v2(), shape: 'hexagon', gradientEnabled: false });

    expect(theme.shape).toBe('hexagon');
    expect(theme.gradientEnabled).toBe(false);
    expect(theme.states.thinking.color2).toBe(cloneDefaultTheme().states.thinking.color2);
  });

  it('imports a version 2 export and says it was upgraded', () => {
    const result = importTheme(
      JSON.stringify({
        app: 'jarvis-hud',
        kind: 'orb-theme',
        version: 2,
        exportedAt: '2026-01-01T00:00:00.000Z',
        theme: { ...v2(), shape: 'wave' },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.theme?.shape).toBe('wave');
    expect(result.warnings.join(' ')).toMatch(/Upgraded from version 2 — opacity was added/);
  });
});

describe('version 1 → 3 migration, chained', () => {
  it('walks a version 1 save all the way to the current schema', () => {
    expect((migrateTheme(v1()) as { version: number }).version).toBe(THEME_VERSION);
  });

  it('picks up what each step along the way added', () => {
    const theme = normaliseTheme(v1());
    // From the 1 → 2 step:
    expect(theme.states.idle.color2).toMatch(/^#[0-9a-f]{6}$/i);
    expect(typeof theme.gradientEnabled).toBe('boolean');
    // ...and from the 2 → 3 step:
    expect(theme.opacity).toBe(1);
    expect(theme.states.idle.opacityScale).toBe(1);
  });

  it('keeps everything version 1 could express', () => {
    const theme = normaliseTheme(v1());

    expect(theme.shape).toBe('orb');
    expect(theme.size).toBeCloseTo(1.1);
    expect(theme.glow).toBeCloseTo(1.3);
    expect(theme.speed).toBeCloseTo(0.9);
    expect(theme.motion).toBe('pulse');
    expect(theme.states.thinking.color).toBe('#a78bfa');
    expect(theme.states.error.glowScale).toBeCloseTo(1.5);
  });

  it('turns the derived second stop into an explicit colour, so it looks the same', () => {
    const theme = normaliseTheme(v1());
    // aurora at depth 0.5 shifted hue by 31 and lightness by 9.
    expect(theme.states.idle.color2).toBe(shift('#22d3ee', 62 * 0.5, 18 * 0.5));
    expect(theme.gradientEnabled).toBe(true);
    expect(theme.gradient).toBe('conic');
  });

  it('maps every legacy gradient name onto a blend style', () => {
    expect(normaliseTheme(v1({ gradient: 'radial' })).gradient).toBe('radial');
    expect(normaliseTheme(v1({ gradient: 'dual' })).gradient).toBe('dual');
    expect(normaliseTheme(v1({ gradient: 'aurora' })).gradient).toBe('conic');
  });

  it('reads legacy "solid" as the gradient being off, with a matching secondary', () => {
    const theme = normaliseTheme(v1({ gradient: 'solid' }));

    expect(theme.gradientEnabled).toBe(false);
    // Secondary equals primary, so turning the gradient back on changes nothing
    // until the operator picks a colour.
    expect(theme.states.idle.color2).toBe('#22d3ee');
  });

  it('leaves a version 2 theme untouched', () => {
    const current = cloneDefaultTheme();
    expect(migrateTheme(current)).toBe(current);
    expect(normaliseTheme(current)).toEqual(current);
  });

  it('still discards a version it cannot migrate', () => {
    expect(normaliseTheme({ ...v1(), version: 0 })).toEqual(cloneDefaultTheme());
  });

  it('survives a version 1 save with missing or broken states', () => {
    const theme = normaliseTheme(v1({ states: { idle: { color: 'not a colour' } } }));
    expect(theme.states.idle.color).toBe('#22d3ee');
    expect(Object.keys(theme.states)).toHaveLength(6);
  });

  it('imports a version 1 export and says it was upgraded', () => {
    const file = JSON.stringify({
      app: 'jarvis-hud',
      kind: 'orb-theme',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      theme: v1(),
    });

    const result = importTheme(file);

    expect(result.ok).toBe(true);
    expect(result.theme?.shape).toBe('orb');
    expect(result.warnings.join(' ')).toMatch(/Upgraded from version 1/);
  });
});
