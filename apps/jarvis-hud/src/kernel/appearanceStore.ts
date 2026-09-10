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

import { cloneDefaultTheme, maxPresets, presets, THEME_VERSION } from '../config/orb.config';
import type {
  AppearanceStorage,
  AppearanceStore,
  CoreState,
  OrbStateStyle,
  OrbTheme,
  SavedPreset,
} from '../contracts';
import { normalisePresets, normaliseTheme, STATES } from './themeSchema';
import {
  exportTheme as serialiseTheme,
  importTheme as importSerialisedTheme,
} from './themeSerializer';

export function createAppearanceStore(storage: AppearanceStorage): AppearanceStore {
  let theme = normaliseTheme(storage.load());
  let library = normalisePresets(storage.loadPresets());
  let saved = true;
  let nextId = 0;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((l) => l());

  /** Ids only have to be unique within one library, not globally. */
  const makeId = () => {
    nextId += 1;
    return `preset-${Date.now().toString(36)}-${nextId}`;
  };

  const commitLibrary = (next: SavedPreset[]) => {
    library = next.slice(0, maxPresets);
    saved = storage.savePresets(library) && saved;
    notify();
  };

  const commit = (next: OrbTheme) => {
    theme = next;
    saved = storage.save(next);
    notify();
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
      // The current theme is both the input and the fallback: a value the
      // schema refuses leaves that field as it was, not as it shipped.
      commit(normaliseTheme({ ...copy(theme), ...partial, version: THEME_VERSION }, copy(theme)));
    },

    patchState(state, partial) {
      const next = copy(theme);
      next.states[state] = { ...next.states[state], ...partial };
      commit(normaliseTheme(next, copy(theme)));
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

    getPresets: () => library,

    savePreset(label) {
      const now = Date.now();
      const preset: SavedPreset = {
        id: makeId(),
        // A blank name would leave an unclickable row in the library.
        label: (label.trim() || 'Untitled').slice(0, 40),
        createdAt: now,
        updatedAt: now,
        theme: copy(theme),
      };
      commitLibrary([preset, ...library]);
      return preset;
    },

    loadPreset(id) {
      const preset = library.find((p) => p.id === id);
      if (!preset) return false;
      commit(normaliseTheme(preset.theme));
      return true;
    },

    duplicatePreset(id) {
      const source = library.find((p) => p.id === id);
      if (!source) return null;
      const now = Date.now();
      const copyOf: SavedPreset = {
        id: makeId(),
        label: `${source.label} COPY`.slice(0, 40),
        createdAt: now,
        updatedAt: now,
        theme: copy(source.theme),
      };
      // Placed next to its source rather than at the top, so a duplicate does
      // not jump away from the row the operator just clicked.
      const index = library.findIndex((p) => p.id === id);
      commitLibrary([...library.slice(0, index + 1), copyOf, ...library.slice(index + 1)]);
      return copyOf;
    },

    deletePreset(id) {
      if (!library.some((p) => p.id === id)) return false;
      commitLibrary(library.filter((p) => p.id !== id));
      return true;
    },

    exportTheme: () => serialiseTheme(theme, library),

    importTheme(json) {
      const result = importSerialisedTheme(json);
      // Nothing is applied unless the file was actually readable, so a failed
      // paste leaves the operator looking at exactly what they had.
      if (!result.ok || !result.theme) return result;

      if (result.presets.length) {
        // Merged, not replaced: an import must never wipe presets the operator
        // built up. Ids that already exist are re-issued so nothing collides.
        const existing = new Set(library.map((p) => p.id));
        const incoming = result.presets.map((preset) =>
          existing.has(preset.id) ? { ...preset, id: makeId() } : preset,
        );
        library = [...incoming, ...library].slice(0, maxPresets);
        saved = storage.savePresets(library);
      }
      commit(result.theme);
      return result;
    },

    storageStatus: () => ({ id: storage.id, persistent: storage.persistent, saved }),
  };
}
