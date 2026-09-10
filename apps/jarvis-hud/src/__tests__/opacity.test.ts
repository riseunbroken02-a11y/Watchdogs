import { beforeEach, describe, expect, it } from 'vitest';
import { createAppearanceStore } from '../kernel/appearanceStore';
import { createMemoryAppearanceStorage } from '../adapters/local/memoryAppearanceStorage';
import { normaliseTheme } from '../kernel/themeSchema';
import { cloneDefaultTheme, presets, ranges, THEME_VERSION } from '../config/orb.config';
import type { AppearanceStore, CoreState } from '../contracts';

const STATES: CoreState[] = ['idle', 'listening', 'thinking', 'working', 'success', 'error'];

let store: AppearanceStore;
beforeEach(() => {
  store = createAppearanceStore(createMemoryAppearanceStorage());
});

describe('opacity — base', () => {
  it('ships fully solid, so nothing looks different until it is touched', () => {
    expect(store.getTheme().opacity).toBe(1);
    for (const state of STATES) {
      expect(store.getTheme().states[state].opacityScale).toBe(1);
    }
  });

  it('is adjustable and clamped to its range', () => {
    store.patch({ opacity: 0.5 });
    expect(store.getTheme().opacity).toBeCloseTo(0.5);

    store.patch({ opacity: 5 });
    expect(store.getTheme().opacity).toBe(ranges.opacity.max);

    store.patch({ opacity: -1 });
    expect(store.getTheme().opacity).toBe(ranges.opacity.min);
  });

  it('never floors at zero — an invisible orb you cannot find again is a trap', () => {
    store.patch({ opacity: 0 });
    expect(store.getTheme().opacity).toBeGreaterThan(0.1);
  });

  it('keeps the operator’s value when handed something that is not a number', () => {
    store.patch({ opacity: 0.4 });
    store.patch({ opacity: 'ghostly' as never });
    expect(store.getTheme().opacity).toBeCloseTo(0.4);
  });
});

describe('opacity — per state', () => {
  it('is set independently of the other states', () => {
    store.patchState('thinking', { opacityScale: 0.5 });

    expect(store.getTheme().states.thinking.opacityScale).toBeCloseTo(0.5);
    expect(store.getTheme().states.idle.opacityScale).toBe(1);
  });

  it('multiplies the base, the same way tempo and glow do', () => {
    store.patch({ opacity: 0.8 });
    store.patchState('error', { opacityScale: 0.5 });

    // The product is what the HUD renders; the two values stay separate.
    expect(store.getTheme().opacity).toBeCloseTo(0.8);
    expect(store.getTheme().states.error.opacityScale).toBeCloseTo(0.5);
  });

  it('is clamped per state too', () => {
    store.patchState('idle', { opacityScale: 99 });
    expect(store.getTheme().states.idle.opacityScale).toBe(ranges.opacityScale.max);
  });

  it('is restored by resetting one state', () => {
    store.patchState('success', { opacityScale: 0.3 });
    store.resetState('success');
    expect(store.getTheme().states.success.opacityScale).toBe(1);
  });
});

describe('opacity — presets and transfer', () => {
  it('every built-in preset sets a usable opacity', () => {
    for (const preset of presets) {
      const s = createAppearanceStore(createMemoryAppearanceStorage());
      s.applyPreset(preset.id);
      const { opacity } = s.getTheme();
      expect(opacity, preset.id).toBeGreaterThanOrEqual(ranges.opacity.min);
      expect(opacity, preset.id).toBeLessThanOrEqual(1);
    }
  });

  it('VOID is translucent — a hologram should read as projected light', () => {
    store.applyPreset('void');
    expect(store.getTheme().opacity).toBeLessThan(1);
  });

  it('survives a round trip through export and import', () => {
    store.patch({ opacity: 0.42 });
    store.patchState('working', { opacityScale: 0.6 });

    const target = createAppearanceStore(createMemoryAppearanceStorage());
    const result = target.importTheme(store.exportTheme());

    expect(result.ok).toBe(true);
    expect(target.getTheme().opacity).toBeCloseTo(0.42);
    expect(target.getTheme().states.working.opacityScale).toBeCloseTo(0.6);
  });

  it('is reported when an imported file is out of range', () => {
    const theme = { ...cloneDefaultTheme(), opacity: 9 };
    const result = createAppearanceStore(createMemoryAppearanceStorage()).importTheme(
      JSON.stringify({ app: 'jarvis-hud', kind: 'orb-theme', version: THEME_VERSION, theme }),
    );

    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/opacity 9 is outside 0.15–1 — clamped to 1/);
  });

  it('a preset saved with a custom opacity restores it', () => {
    store.patch({ opacity: 0.33 });
    const preset = store.savePreset('Ghost');
    store.patch({ opacity: 1 });

    store.loadPreset(preset.id);
    expect(store.getTheme().opacity).toBeCloseTo(0.33);
  });
});

describe('opacity — schema', () => {
  it('a theme with no opacity at all still normalises', () => {
    const theme = normaliseTheme({ version: THEME_VERSION, shape: 'orb' });
    expect(theme.opacity).toBe(1);
    expect(theme.states.idle.opacityScale).toBe(1);
  });
});
