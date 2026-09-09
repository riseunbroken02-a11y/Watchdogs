import { useEffect, useMemo, type ReactNode } from 'react';
import { createMockRuntime } from '../adapters/mock';
import { runtime as runtimeConfig } from '../config/jarvis.config';
import type { JarvisRuntime } from '../kernel/jarvisRuntime';
import { JarvisRuntimeContext } from './jarvisContext';

/**
 * Builds the runtime once and starts its heartbeats.
 *
 * This is the single place where the app chooses an adapter set. Phase 4 adds
 * a `createLiveRuntime()` next to `createMockRuntime()` and picks between them
 * here — nothing else in the UI needs to know.
 */
function buildRuntime(): JarvisRuntime {
  if (runtimeConfig.adapters === 'live') {
    console.warn(
      '[jarvis] runtime.adapters="live" is not implemented — falling back to the mock adapter set.',
    );
  }
  return createMockRuntime();
}

export function JarvisProvider({ children }: { children: ReactNode }) {
  const runtime = useMemo(() => buildRuntime(), []);

  useEffect(() => runtime.start(), [runtime]);

  return <JarvisRuntimeContext.Provider value={runtime}>{children}</JarvisRuntimeContext.Provider>;
}
