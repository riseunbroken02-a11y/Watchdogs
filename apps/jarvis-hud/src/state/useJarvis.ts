import { useSyncExternalStore } from 'react';
import type { JarvisSnapshot } from '../kernel/jarvisRuntime';
import { useRuntime } from './jarvisContext';

/**
 * Reads the runtime's immutable snapshot.
 *
 * `useSyncExternalStore` is the right primitive here: the kernel is the store,
 * it rebuilds its snapshot once per change, and React re-renders only when that
 * reference actually moves.
 */
export function useJarvis(): JarvisSnapshot {
  const runtime = useRuntime();
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
}

export { useRuntime };
