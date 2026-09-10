/**
 * In-memory appearance storage.
 *
 * The fallback when the browser refuses durable storage, and what the tests
 * run against. `persistent: false` is what the studio reads to tell the
 * operator their theme will not survive a reload.
 */

import type { AppearanceStorage, OrbTheme } from '../../contracts';

export function createMemoryAppearanceStorage(initial: OrbTheme | null = null): AppearanceStorage {
  let theme = initial;
  return {
    id: 'memory',
    persistent: false,
    load: () => theme,
    save(next) {
      theme = next;
      // Reports false deliberately: it did not reach anywhere durable.
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
