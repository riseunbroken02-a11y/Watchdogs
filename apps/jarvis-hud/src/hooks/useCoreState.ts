import { useCallback, useEffect, useRef, useState } from 'react';
import { stateTempo } from '../config/jarvis.config';
import type { CoreState } from '../types';

/**
 * Owns the core's activity state plus a smoothed 0..1 "intensity" value that
 * the shapes use to drive their glow and animation amplitude.
 */
export function useCoreState(initial: CoreState = 'idle') {
  const [state, setState] = useState<CoreState>(initial);
  const [intensity, setIntensity] = useState(0.35);
  const target = useRef(0.35);
  const busy = useRef(false);

  useEffect(() => {
    const targets: Record<CoreState, number> = {
      idle: 0.32,
      listening: 0.55,
      thinking: 0.78,
      working: 0.95,
      success: 0.7,
      error: 0.85,
    };
    target.current = targets[state];
  }, [state]);

  // Ease the intensity towards its target so state changes never snap.
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setIntensity((current) => {
        const delta = target.current - current;
        if (Math.abs(delta) < 0.002) return target.current;
        return current + delta * 0.08;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Marks the core as driven by a running command (blocks manual override). */
  const setBusy = useCallback((value: boolean) => {
    busy.current = value;
  }, []);

  const requestState = useCallback((next: CoreState) => {
    if (busy.current) return false;
    setState(next);
    return true;
  }, []);

  return {
    state,
    setState,
    requestState,
    setBusy,
    isBusy: busy,
    intensity,
    tempo: stateTempo[state],
  };
}
