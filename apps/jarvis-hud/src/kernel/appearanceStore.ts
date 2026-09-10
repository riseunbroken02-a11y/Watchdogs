/**
 * Appearance store.
 *
 * Owns the orb theme: validates it, clamps it, persists it and tells anyone who
 * cares that it changed. Framework-free, like the rest of the kernel — the
 * studio is just one possible editor for this object.
 *
 * Every value that arrives from outside (a preset, a saved theme, a control) is
 * clamped and validated here rather than at the edges, so a corrupt save or a
 * bad slider can never put the HUD into an unrenderable state.
 */

import {
  cloneDefaultTheme,
  presets,
  ranges,
  THEME_VERSION,
} from '../config/orb.config';
import type {
  AppearanceStorage,
  AppearanceStore,
  CoreState,
  GradientStyle,
  MotionStyle,
  OrbStateStyle,
  OrbTheme,
} from '../contracts';
import { coreShapes } from '../config/jarvis.config';
import { isHexColor } from '../utils/color';

const STATES: CoreState[] = ['idle', 'listening', 'thinking', 'working', 'success', 'error'];
const GRADIENTS: GradientStyle[] = ['solid', 'radial', 'dual', 'aurora'];
const MOTIONS: MotionStyle[] = ['smooth', 'pulse', 'orbit', 'static'];

const clamp = (value: number, { min, max }: { min: number; max: number }, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/**
 * Turns anything at all into a usable theme.
 * Unknown fields are dropped; bad values fall back to the default rather than
 * failing, because a theme is cosmetic and losing it should never block boot.
 */
export function normaliseTheme(raw: unknown): OrbTheme {
  const base = cloneDefaultTheme();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<OrbTheme>;

  // A save from an older schema is discarded rather than half-applied.
  if (input.version !== THEME_VERSION) return base;

  const shapeIds = coreShapes.map((s) => s.id);
  if (typeof input.shape === 'string' && shapeIds.includes(input.shape)) base.shape = input.shape;
  if (typeof input.size === 'number') base.size = clamp(input.size, ranges.size, base.size);
  if (typeof input.glow === 'number') base.glow = clamp(input.glow, ranges.glow, base.glow);
  if (typeof input.speed === 'number') base.speed = clamp(input.speed, ranges.speed, base.speed);
  if (typeof input.gradientDepth === 'number') {
    base.gradientDepth = clamp(input.gradientDepth, ranges.gradientDepth, base.gradientDepth);
  }
  if (typeof input.gradient === 'string' && GRADIENTS.includes(input.gradient)) {
    base.gradient = input.gradient;
  }
  if (typeof input.motion === 'string' && MOTIONS.includes(input.motion)) {
    base.motion = input.motion;
  }

  if (input.states && typeof input.states === 'object') {
    for (const state of STATES) {
      const incoming = (input.states as Partial<Record<CoreState, Partial<OrbStateStyle>>>)[state];
      if (!incoming) continue;
      const target = base.states[state];
      if (typeof incoming.color === 'string' && isHexColor(incoming.color)) {
        target.color = incoming.color;
      }
      if (typeof incoming.tempoScale === 'number') {
        target.tempoScale = clamp(incoming.tempoScale, ranges.tempoScale, target.tempoScale);
      }
      if (typeof incoming.glowScale === 'number') {
        target.glowScale = clamp(incoming.glowScale, ranges.glowScale, target.glowScale);
      }
    }
  }

  return base;
}

export function createAppearanceStore(storage: AppearanceStorage): AppearanceStore {
  let theme = normaliseTheme(storage.load());
  let saved = true;
  const listeners = new Set<() => void>();

  const commit = (next: OrbTheme) => {
    theme = next;
    saved = storage.save(next);
    listeners.forEach((l) => l());
  };

  /** Shallow copy that still detaches the per-state objects. */
  const copy = (source: OrbTheme): OrbTheme => ({
    ...source,
    states: Object.fromEntries(
      (Object.entries(source.states) as [CoreState, OrbStateStyle][]).map(([k, v]) => [k, { ...v }]),
    ) as OrbTheme['states'],
  });

  return {
    getTheme: () => theme,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    patch(partial) {
      commit(normaliseTheme({ ...copy(theme), ...partial, version: THEME_VERSION }));
    },

    patchState(state, partial) {
      const next = copy(theme);
      next.states[state] = { ...next.states[state], ...partial };
      commit(normaliseTheme(next));
    },

    applyPreset(presetId) {
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;

      const next = copy(theme);
      const { states, ...top } = preset.theme;
      Object.assign(next, top);
      if (states) {
        for (const state of STATES) {
          const override = states[state];
          if (override) next.states[state] = { ...next.states[state], ...override };
        }
      }
      commit(normaliseTheme(next));
    },

    reset() {
      storage.clear();
      commit(cloneDefaultTheme());
    },

    resetState(state) {
      const next = copy(theme);
      next.states[state] = { ...cloneDefaultTheme().states[state] };
      commit(normaliseTheme(next));
    },

    storageStatus: () => ({ id: storage.id, persistent: storage.persistent, saved }),
  };
}
