/**
 * The ONE place in this application that touches browser storage.
 *
 * Everything else goes through the `AppearanceStorage` contract, which is what
 * makes the scan in `src/__tests__/safety.test.ts` meaningful: `localStorage`
 * is permitted in this file and forbidden everywhere else.
 *
 * WHAT IS STORED: the orb theme only — shape, size, glow, speed, gradient,
 * motion and six colours. No command history, no memory records, no telemetry,
 * no credential, nothing about the operator. It is a cosmetic preference, and
 * losing it costs nothing.
 *
 * Every access is wrapped: a private window, a full quota or storage disabled
 * by policy throws on the *first* touch, and none of that may take the HUD
 * down over a colour preference.
 */

import { storageKey } from '../../config/orb.config';
import type { AppearanceStorage, OrbTheme } from '../../contracts';

/** True when the browser will actually let us read and write. */
export function storageAvailable(): boolean {
  try {
    const probe = `${storageKey}.probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function createLocalAppearanceStorage(): AppearanceStorage {
  return {
    id: 'local',
    persistent: true,

    load() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        // The store normalises whatever comes back, so a truncated or hand
        // edited value is repaired rather than trusted.
        return JSON.parse(raw) as OrbTheme;
      } catch {
        return null;
      }
    },

    save(theme) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(theme));
        return true;
      } catch {
        // Quota exceeded, private mode, storage blocked — the edit still
        // applies for this session, it just will not survive a reload.
        return false;
      }
    },

    clear() {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* nothing to do; the next save will report the failure */
      }
    },
  };
}
