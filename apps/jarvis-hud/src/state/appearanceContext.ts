import { createContext, useContext } from 'react';
import type { AppearanceStore } from '../contracts';

export const AppearanceContext = createContext<AppearanceStore | null>(null);

export function useAppearanceStore(): AppearanceStore {
  const store = useContext(AppearanceContext);
  if (!store) throw new Error('useAppearanceStore must be used inside <AppearanceProvider>');
  return store;
}
