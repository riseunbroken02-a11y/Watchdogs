import { useMemo, type ReactNode } from 'react';
import { createAppearanceStore } from '../kernel/appearanceStore';
import {
  createLocalAppearanceStorage,
  storageAvailable,
} from '../adapters/local/localAppearanceStorage';
import { createAppearanceStorage } from '../adapters/local/memoryAppearanceStorage';
import { AppearanceContext } from './appearanceContext';

/**
 * Builds the appearance store once, on durable storage when the browser allows
 * it and in memory otherwise. Either way the HUD renders — a blocked
 * localStorage costs the operator persistence, never the interface.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const store = useMemo(
    () => createAppearanceStore(createAppearanceStorage(storageAvailable(), createLocalAppearanceStorage)),
    [],
  );

  return <AppearanceContext.Provider value={store}>{children}</AppearanceContext.Provider>;
}
