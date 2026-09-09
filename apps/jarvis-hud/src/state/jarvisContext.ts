import { createContext, useContext } from 'react';
import type { JarvisSystem } from '../hooks/useJarvisSystem';

export const JarvisContext = createContext<JarvisSystem | null>(null);

/** Reads the shared HUD state. Throws if used outside <JarvisProvider>. */
export function useJarvis(): JarvisSystem {
  const value = useContext(JarvisContext);
  if (!value) throw new Error('useJarvis must be used inside <JarvisProvider>');
  return value;
}
