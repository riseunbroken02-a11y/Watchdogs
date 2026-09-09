import { useEffect, useState, type ReactNode } from 'react';
import { createRuntime } from '../adapters';
import type { JarvisRuntime } from '../kernel/jarvisRuntime';
import { JarvisRuntimeContext } from './jarvisContext';
import './JarvisProvider.css';

/**
 * Builds the runtime and starts its heartbeats.
 *
 * Construction is asynchronous because each configured integration is probed
 * before it is bound — the HUD refuses to claim a subsystem is live without
 * having asked it. With the shipped defaults nothing is configured, so no probe
 * runs and boot is immediate.
 */
export function JarvisProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<JarvisRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;

    void createRuntime()
      .then((built) => {
        if (cancelled) return;
        stop = built.start();
        setRuntime(built);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  if (error) {
    return (
      <div className="jv-boot jv-boot--error">
        <span className="jv-boot__label">JARVIS FAILED TO START</span>
        <span className="jv-boot__detail">{error}</span>
      </div>
    );
  }

  if (!runtime) {
    return (
      <div className="jv-boot">
        <span className="jv-boot__ring" />
        <span className="jv-boot__label">INITIALISING JARVIS</span>
        <span className="jv-boot__detail">Resolving adapters…</span>
      </div>
    );
  }

  return <JarvisRuntimeContext.Provider value={runtime}>{children}</JarvisRuntimeContext.Provider>;
}
