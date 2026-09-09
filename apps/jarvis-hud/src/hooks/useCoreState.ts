import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoreState } from '../types';

/** Activity level each core state settles at (0..1). */
const INTENSITY: Record<CoreState, number> = {
  idle: 0.32,
  listening: 0.55,
  thinking: 0.78,
  working: 0.95,
  success: 0.7,
  error: 0.85,
};

/**
 * Owns the core's activity state.
 *
 * The 0..1 "intensity" the shapes animate on is written straight to the
 * `--jv-i` CSS custom property instead of React state. `--jv-i` is registered
 * via @property (see styles/tokens.css) so the browser eases it smoothly —
 * which means a state change costs exactly one React render instead of one per
 * animation frame. That matters now the HUD renders eight panels.
 */
export function useCoreState(initial: CoreState = 'idle') {
  const [state, setState] = useState<CoreState>(initial);
  const busy = useRef(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--jv-i', String(INTENSITY[state]));
  }, [state]);

  /** Marks the core as driven by a running command (blocks manual override). */
  const setBusy = useCallback((value: boolean) => {
    busy.current = value;
  }, []);

  /** Manual state change; ignored while a command owns the core. */
  const requestState = useCallback((next: CoreState) => {
    if (busy.current) return false;
    setState(next);
    return true;
  }, []);

  return { state, setState, requestState, setBusy };
}

export { INTENSITY as coreIntensity };
