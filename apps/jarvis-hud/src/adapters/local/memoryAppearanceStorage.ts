/**
 * In-memory appearance storage.
 *
 * The fallback when the browser refuses durable storage, and what the tests
 * run against. `persistent: false` is what the studio reads to tell the
 * operator their theme will not survive a reload.
 */

import type { AppearanceStorage, OrbTheme, SavedPreset } from '../../contracts';

export function createMemoryAppearanceStorage(
  initial: OrbTheme | null = null,
  initialPresets: SavedPreset[] = [],
): AppearanceStorage {
  let theme = initial;
  let presets = initialPresets;

  return {
    id: 'memory',
    persistent: false,
    load: () => theme,
    save(next) {
      theme = next;
      // Reports false deliberately: it did not reach anywhere durable.
      return false;
    },
    loadPresets: () => presets,
    savePresets(next) {
      presets = next;
      return false;
    },
    clear() {
      theme = null;
    },
  };
}

/** Picks durable storage when the browser allows it, memory otherwise. */
export function createAppearanceStorage(
  available: boolean,
  durable: () => AppearanceStorage,
): AppearanceStorage {
  return available ? durable() : createMemoryAppearanceStorage();
}
