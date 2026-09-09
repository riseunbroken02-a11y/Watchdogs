import type { ReactNode } from 'react';
import { useJarvisSystem } from '../hooks/useJarvisSystem';
import { JarvisContext } from './jarvisContext';

/**
 * Single source of truth for the HUD. Panels read what they need through
 * `useJarvis()` instead of receiving props drilled down from App.
 */
export function JarvisProvider({ children }: { children: ReactNode }) {
  const system = useJarvisSystem();
  return <JarvisContext.Provider value={system}>{children}</JarvisContext.Provider>;
}
