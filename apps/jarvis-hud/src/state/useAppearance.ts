import { useSyncExternalStore } from 'react';
import type { OrbTheme } from '../contracts';
import { useAppearanceStore } from './appearanceContext';

/** The live orb theme. Re-renders only when the store actually changes it. */
export function useAppearance(): OrbTheme {
  const store = useAppearanceStore();
  return useSyncExternalStore(store.subscribe, store.getTheme, store.getTheme);
}

export { useAppearanceStore };
