import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppearanceStore, normaliseTheme } from '../kernel/appearanceStore';
import { createMemoryAppearanceStorage } from '../adapters/local/memoryAppearanceStorage';
import { cloneDefaultTheme, presets, ranges, THEME_VERSION } from '../config/orb.config';
import type { AppearanceStore, CoreState, OrbTheme } from '../contracts';

let store: AppearanceStore;
beforeEach(() => {
  store = createAppearanceStore(createMemoryAppearanceStorage());
});

describe('appearance store — defaults', () => {
  it('starts on the shipped default, which reproduces the phase 1-4 look', () => {
    const theme = store.getTheme();
    expect(theme).toEqual(cloneDefaultTheme());
    expect(theme.shape).toBe('reactor');
    expect(theme.states.idle.color).toBe('#22d3ee');
    expect(theme.states.error.color).toBe('#f87171');
  });

  it('covers all six states', () => {
    const states: CoreState[] = ['idle', 'listening', 'thinking', 'working', 'success', 'error'];
    for (const state of states) {
      const style = store.getTheme().states[state];
      expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.tempoScale).toBeGreaterThan(0);
      expect(style.glowScale).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('appearance store — editing', () => {
  it('patches top-level fields and notifies subscribers', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.patch({ shape: 'orb', glow: 1.4, motion: 'orbit' });

    expect(store.getTheme().shape).toBe('orb');
    expect(store.getTheme().glow).toBeCloseTo(1.4);
    expect(store.getTheme().motion).toBe('orbit');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('patches one state without disturbing the others', () => {
    const before = store.getTheme().states.error.color;
    store.patchState('thinking', { color: '#ff00aa', glowScale: 1.8 });

    expect(store.getTheme().states.thinking.color).toBe('#ff00aa');
    expect(store.getTheme().states.thinking.glowScale).toBeCloseTo(1.8);
    expect(store.getTheme().states.error.color).toBe(before);
  });

  it('returns a new object each change, so useSyncExternalStore can diff it', () => {
    const first = store.getTheme();
    store.patch({ size: 1.2 });
    expect(store.getTheme()).not.toBe(first);
    // and the previous snapshot is untouched
    expect(first.size).toBe(1);
  });

  it('clamps every numeric control to its range', () => {
    store.patch({ size: 99, glow: -5, speed: 0, gradientDepth: 4 });
    const theme = store.getTheme();

    expect(theme.size).toBe(ranges.size.max);
    expect(theme.glow).toBe(ranges.glow.min);
    expect(theme.speed).toBe(ranges.speed.min);
    expect(theme.gradientDepth).toBe(ranges.gradientDepth.max);

    store.patchState('idle', { tempoScale: 99, glowScale: -1 });
    expect(store.getTheme().states.idle.tempoScale).toBe(ranges.tempoScale.max);
    expect(store.getTheme().states.idle.glowScale).toBe(ranges.glowScale.min);
  });

  it('rejects a colour that is not a hex value', () => {
    store.patchState('idle', { color: 'rgb(1,2,3)' });
    expect(store.getTheme().states.idle.color).toBe('#22d3ee');

    store.patchState('idle', { color: '#abc' });
    expect(store.getTheme().states.idle.color).toBe('#abc');
  });

  it('ignores an unknown shape', () => {
    store.patch({ shape: 'not-a-shape' as never });
    expect(store.getTheme().shape).toBe('reactor');
  });
});

describe('appearance store — presets and reset', () => {
  it('applies a preset across shape, motion and every state colour', () => {
    store.applyPreset('crimson');
    const theme = store.getTheme();

    expect(theme.shape).toBe('ring');
    expect(theme.motion).toBe('orbit');
    expect(theme.states.idle.color).toBe('#f43f5e');
    expect(theme.states.error.color).toBe('#dc2626');
  });

  it('leaves fields a preset does not mention alone', () => {
    store.patch({ size: 1.25 });
    store.applyPreset('mono');
    expect(store.getTheme().size).toBeCloseTo(1.25);
  });

  it('ignores an unknown preset id', () => {
    const before = store.getTheme();
    store.applyPreset('does-not-exist');
    expect(store.getTheme()).toEqual(before);
  });

  it('every shipped preset produces a valid theme', () => {
    for (const preset of presets) {
      const fresh = createAppearanceStore(createMemoryAppearanceStorage());
      fresh.applyPreset(preset.id);
      const theme = fresh.getTheme();
      expect(theme.version).toBe(THEME_VERSION);
      for (const style of Object.values(theme.states)) {
        expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('reset() returns to the default and clears storage', () => {
    const storage = createMemoryAppearanceStorage();
    const clear = vi.spyOn(storage, 'clear');
    const s = createAppearanceStore(storage);

    s.patch({ shape: 'wave', glow: 0.2 });
    s.reset();

    expect(s.getTheme()).toEqual(cloneDefaultTheme());
    expect(clear).toHaveBeenCalled();
  });

  it('resetState() restores one state only', () => {
    store.patchState('idle', { color: '#ffffff' });
    store.patchState('error', { color: '#000000' });

    store.resetState('idle');

    expect(store.getTheme().states.idle.color).toBe('#22d3ee');
    expect(store.getTheme().states.error.color).toBe('#000000');
  });
});

describe('appearance store — persistence', () => {
  it('loads a previously saved theme', () => {
    const saved: OrbTheme = { ...cloneDefaultTheme(), shape: 'hexagon', glow: 1.75 };
    const s = createAppearanceStore(createMemoryAppearanceStorage(saved));

    expect(s.getTheme().shape).toBe('hexagon');
    expect(s.getTheme().glow).toBeCloseTo(1.75);
  });

  it('writes through on every change', () => {
    const storage = createMemoryAppearanceStorage();
    const save = vi.spyOn(storage, 'save');
    const s = createAppearanceStore(storage);

    s.patch({ shape: 'orb' });
    s.patchState('idle', { color: '#111111' });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].states.idle.color).toBe('#111111');
  });

  it('reports honestly when the theme could not be persisted', () => {
    // The in-memory adapter always reports false: it is not durable.
    store.patch({ glow: 1.1 });
    const status = store.storageStatus();
    expect(status.persistent).toBe(false);
    expect(status.saved).toBe(false);
  });
});

describe('normaliseTheme — repairs anything', () => {
  it('falls back to the default for junk', () => {
    for (const junk of [null, undefined, 42, 'theme', [], {}]) {
      expect(normaliseTheme(junk)).toEqual(cloneDefaultTheme());
    }
  });

  it('discards a save from an older schema version', () => {
    const stale = { ...cloneDefaultTheme(), version: 0, shape: 'wave' as const };
    expect(normaliseTheme(stale).shape).toBe('reactor');
  });

  it('keeps the good fields of a partially corrupt theme', () => {
    const partial = {
      version: THEME_VERSION,
      shape: 'hologram',
      glow: 'very bright',
      size: 1.15,
      states: { idle: { color: 'not-a-colour', tempoScale: 0.5 } },
    };

    const theme = normaliseTheme(partial);
    expect(theme.shape).toBe('hologram');
    expect(theme.size).toBeCloseTo(1.15);
    expect(theme.glow).toBe(1);
    expect(theme.states.idle.color).toBe('#22d3ee');
    expect(theme.states.idle.tempoScale).toBeCloseTo(0.5);
  });

  it('never returns a theme missing a state', () => {
    const theme = normaliseTheme({ version: THEME_VERSION, states: {} });
    expect(Object.keys(theme.states).sort()).toEqual(
      ['error', 'idle', 'listening', 'success', 'thinking', 'working'],
    );
  });
});
