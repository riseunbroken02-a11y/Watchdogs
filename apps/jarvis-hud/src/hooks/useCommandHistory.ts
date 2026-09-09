import { useCallback, useRef } from 'react';
import type { CommandHistoryEntry } from '../kernel/jarvisRuntime';

/**
 * Shell-style ↑ / ↓ recall over the runtime's command history.
 *
 * The history itself lives in the kernel; this hook only tracks where the
 * operator is currently pointing.
 */
export function useCommandHistory(entries: CommandHistoryEntry[]) {
  const cursor = useRef(-1);
  const draft = useRef('');

  /**
   * `direction` -1 steps further back, +1 comes forward.
   * Returns the value the input should show, or null to leave it alone.
   */
  const recall = useCallback(
    (direction: -1 | 1, current: string): string | null => {
      if (entries.length === 0) return null;

      if (cursor.current === -1) {
        if (direction === 1) return null;
        draft.current = current;
      }

      const next = cursor.current + (direction === -1 ? 1 : -1);

      if (next < 0) {
        cursor.current = -1;
        return draft.current;
      }
      if (next >= entries.length) return null;

      cursor.current = next;
      return entries[next].input;
    },
    [entries],
  );

  const reset = useCallback(() => {
    cursor.current = -1;
    draft.current = '';
  }, []);

  return { recall, reset };
}
