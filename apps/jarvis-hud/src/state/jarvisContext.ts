import { createContext, useContext } from 'react';
import type { JarvisRuntime } from '../kernel/jarvisRuntime';

/**
 * The React layer holds a reference to the runtime and nothing else — no
 * business logic lives on this side of the boundary.
 */
export const JarvisRuntimeContext = createContext<JarvisRuntime | null>(null);

export function useRuntime(): JarvisRuntime {
  const runtime = useContext(JarvisRuntimeContext);
  if (!runtime) throw new Error('useRuntime must be used inside <JarvisProvider>');
  return runtime;
}
