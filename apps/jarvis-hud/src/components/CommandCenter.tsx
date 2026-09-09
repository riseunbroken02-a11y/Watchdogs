import { useState } from 'react';
import { command as commandConfig } from '../config/jarvis.config';
import type { CoreState, LogEntry } from '../types';
import './CommandCenter.css';

interface CommandCenterProps {
  onSubmit: (value: string) => void;
  busy: boolean;
  state: CoreState;
}

/**
 * The bottom command bar. Phase 1: submitting only drives the visual state
 * machine — no command leaves the browser.
 */
export function CommandCenter({ onSubmit, busy, state }: CommandCenterProps) {
  const [value, setValue] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <form className="jv-command" onSubmit={submit}>
      <div className="jv-command__field">
        <span className="jv-command__prompt">{busy ? '///' : '>_'}</span>
        <input
          className="jv-command__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={commandConfig.placeholder}
          disabled={busy}
          aria-label="Command input"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="jv-command__hint">
          {busy ? state.toUpperCase() : 'SIMULATION · NO ACTION'}
        </span>
      </div>
      <button
        type="submit"
        className={`jv-command__submit ${busy ? 'jv-command__submit--busy' : ''}`}
        disabled={busy || value.trim().length === 0}
      >
        {busy ? <span className="jv-command__spinner" /> : null}
        {busy ? 'RUNNING' : commandConfig.submitLabel}
      </button>
    </form>
  );
}

/** Scrolling activity log underneath the command bar. */
export function ActivityLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return <p className="jv-log__empty">No activity. Send a command to see the core react.</p>;
  }
  return (
    <div className="jv-log">
      {entries.map((entry) => (
        <div key={entry.id} className={`jv-log__row jv-log__row--${entry.level}`}>
          <span className="jv-log__time">{entry.time}</span>
          <span className="jv-log__source">{entry.source}</span>
          <span className="jv-log__msg">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
