import { beforeEach, describe, expect, it } from 'vitest';
import { createAppearanceStore } from '../kernel/appearanceStore';
import { createMemoryAppearanceStorage } from '../adapters/local/memoryAppearanceStorage';
import { gradientStyles, presets } from '../config/orb.config';
import { GRADIENTS } from '../kernel/themeSchema';
import type { AppearanceStore } from '../contracts';

let store: AppearanceStore;
beforeEach(() => {
  store = createAppearanceStore(createMemoryAppearanceStorage());
});

describe('primary and secondary colours', () => {
  it('every state ships with both colours set', () => {
    for (const style of Object.values(store.getTheme().states)) {
      expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.color2).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('the two are edited independently', () => {
    store.patchState('idle', { color: '#111111' });
    expect(store.getTheme().states.idle.color2).not.toBe('#111111');

    store.patchState('idle', { color2: '#222222' });
    expect(store.getTheme().states.idle.color).toBe('#111111');
    expect(store.getTheme().states.idle.color2).toBe('#222222');
  });

  it('rejects a secondary that is not a hex value', () => {
    const before = store.getTheme().states.idle.color2;
    store.patchState('idle', { color2: 'chartreuse' });
    expect(store.getTheme().states.idle.color2).toBe(before);
  });

  it('resetting a state restores both colours', () => {
    store.patchState('error', { color: '#000000', color2: '#ffffff' });
    store.resetState('error');

    expect(store.getTheme().states.error.color).toBe('#f87171');
    expect(store.getTheme().states.error.color2).toBe('#fbb0b0');
  });
});

describe('gradient on/off', () => {
  it('is on by default', () => {
    expect(store.getTheme().gradientEnabled).toBe(true);
  });

  it('toggles without disturbing the chosen style or colours', () => {
    store.patch({ gradient: 'conic', gradientDepth: 0.8 });
    store.patchState('idle', { color2: '#ff00aa' });

    store.patch({ gradientEnabled: false });

    expect(store.getTheme().gradient).toBe('conic');
    expect(store.getTheme().gradientDepth).toBeCloseTo(0.8);
    expect(store.getTheme().states.idle.color2).toBe('#ff00aa');

    // ...so switching it back on restores exactly what was there.
    store.patch({ gradientEnabled: true });
    expect(store.getTheme().gradientEnabled).toBe(true);
  });

  it('survives a round trip through export and import', () => {
    store.patch({ gradientEnabled: false });
    const target = createAppearanceStore(createMemoryAppearanceStorage());

    target.importTheme(store.exportTheme());

    expect(target.getTheme().gradientEnabled).toBe(false);
  });
});

describe('gradient blend styles', () => {
  it('offers exactly the styles the schema accepts', () => {
    expect(gradientStyles.map((g) => g.id).sort()).toEqual([...GRADIENTS].sort());
  });

  it('every style has a label and a hint', () => {
    for (const style of gradientStyles) {
      expect(style.label.length).toBeGreaterThan(0);
      expect(style.hint.length).toBeGreaterThan(0);
    }
  });

  it('accepts each style', () => {
    for (const id of GRADIENTS) {
      store.patch({ gradient: id });
      expect(store.getTheme().gradient).toBe(id);
    }
  });

  it('a rejected value keeps what the operator had, rather than resetting to factory', () => {
    store.patch({ gradient: 'dual' });
    store.patch({ gradient: 'plaid' as never });
    expect(store.getTheme().gradient).toBe('dual');

    store.patchState('idle', { color2: '#ff00aa' });
    store.patchState('idle', { color2: 'chartreuse' });
    expect(store.getTheme().states.idle.color2).toBe('#ff00aa');

    store.patch({ shape: 'wave' });
    store.patch({ shape: 'not-a-shape' as never });
    expect(store.getTheme().shape).toBe('wave');
  });
});

describe('built-in presets under the new schema', () => {
  it('every preset sets both colours for all six states', () => {
    for (const preset of presets) {
      const s = createAppearanceStore(createMemoryAppearanceStorage());
      s.applyPreset(preset.id);
      for (const [state, style] of Object.entries(s.getTheme().states)) {
        expect(style.color, `${preset.id}.${state}`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(style.color2, `${preset.id}.${state}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('MONO is the one that ships with the gradient off', () => {
    store.applyPreset('mono');
    expect(store.getTheme().gradientEnabled).toBe(false);

    store.applyPreset('void');
    expect(store.getTheme().gradientEnabled).toBe(true);
  });
});
