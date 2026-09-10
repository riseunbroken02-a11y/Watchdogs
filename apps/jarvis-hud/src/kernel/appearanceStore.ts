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

import { cloneDefaultTheme, presets, THEME_VERSION } from '../config/orb.config';
import type {
  AppearanceStorage,
  AppearanceStore,
  CoreState,
  OrbStateStyle,
  OrbTheme,
} from '../contracts';
import { normaliseTheme, STATES } from './themeSchema';
import {
  exportTheme as serialiseTheme,
  importTheme as importSerialisedTheme,
} from './themeSerializer';

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

    exportTheme: () => serialiseTheme(theme),

    importTheme(json) {
      const result = importSerialisedTheme(json);
      // Nothing is applied unless the file was actually readable, so a failed
      // paste leaves the operator looking at exactly what they had.
      if (result.ok && result.theme) commit(result.theme);
      return result;
    },

    storageStatus: () => ({ id: storage.id, persistent: storage.persistent, saved }),
  };
}
