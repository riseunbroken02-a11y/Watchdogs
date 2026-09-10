import { useSyncExternalStore } from 'react';
import type { OrbTheme, SavedPreset } from '../contracts';
import { useAppearanceStore } from './appearanceContext';

/** The live orb theme. Re-renders only when the store actually changes it. */
export function useAppearance(): OrbTheme {
  const store = useAppearanceStore();
  return useSyncExternalStore(store.subscribe, store.getTheme, store.getTheme);
}

/**
 * The saved preset library.
 *
 * A separate subscription on purpose: saving a preset does not change the
 * theme, so a component reading only `useAppearance()` would never re-render
 * and the list would go stale.
 */
export function usePresets(): SavedPreset[] {
  const store = useAppearanceStore();
  return useSyncExternalStore(store.subscribe, store.getPresets, store.getPresets);
}

export { useAppearanceStore };
