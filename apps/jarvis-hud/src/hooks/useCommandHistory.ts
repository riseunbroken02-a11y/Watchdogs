import { useCallback, useRef, useState } from 'react';
import type { CommandHistoryEntry, CommandResult } from '../types';

const MAX_HISTORY = 50;

/**
 * Command history with shell-style ↑ / ↓ recall.
 *
 * The cursor is -1 when the operator is typing a fresh command; stepping back
 * walks into previous entries and stepping forward returns to the draft.
 */
export function useCommandHistory() {
  const [entries, setEntries] = useState<CommandHistoryEntry[]>([]);
  const cursor = useRef(-1);
  const draft = useRef('');
  const nextId = useRef(0);

  const add = useCallback((input: string): string => {
    nextId.current += 1;
    const id = `cmd-${nextId.current}`;
    setEntries((prev) => [{ id, input, result: null, timestamp: Date.now() }, ...prev].slice(0, MAX_HISTORY));
    cursor.current = -1;
    draft.current = '';
    return id;
  }, []);

  const complete = useCallback((id: string, result: CommandResult) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, result } : e)));
  }, []);

  /**
   * Steps through history. `direction` -1 goes further back, +1 comes forward.
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

  return { entries, add, complete, recall, reset };
}
