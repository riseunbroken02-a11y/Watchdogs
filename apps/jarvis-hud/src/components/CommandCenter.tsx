import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { command as commandConfig } from '../config/jarvis.config';
import { exampleCommands } from '../services/commands';
import { useVoice } from '../hooks/useVoice';
import { useJarvis } from '../state/jarvisContext';
import { palette } from '../config/jarvis.config';
import { VoiceControl } from './VoiceControl';
import './CommandCenter.css';

/**
 * COMMAND CENTER — text input (Enter to run), example commands, shell-style
 * ↑/↓ history recall, the last mock result, and the voice UI.
 *
 * Phase 2 executes nothing: `runCommand` only drives the visual state machine
 * and the event stream.
 */
export const CommandCenter = memo(function CommandCenter() {
  const { execute, busy, core, history } = useJarvis();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** Voice hands its mock transcript straight to the input. */
  const onTranscript = useCallback((text: string) => {
    setValue(text);
    inputRef.current?.focus();
  }, []);

  const voice = useVoice(onTranscript);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    void execute(trimmed);
    setValue('');
    history.reset();
  };

  /** ↑ / ↓ walk the command history, like a shell. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const recalled = history.recall(event.key === 'ArrowUp' ? -1 : 1, value);
    if (recalled === null) return;
    event.preventDefault();
    setValue(recalled);
  };

  // Focus the input on load so the HUD is immediately usable.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const last = history.entries.find((e) => e.result !== null);
  const tone = last?.result?.ok === false ? palette.danger : palette.success;

  return (
    <div className="jv-command-center">
      <div
        className={`jv-result ${last?.result ? '' : 'jv-result--empty'}`}
        style={{ '--jv-tone': tone } as React.CSSProperties}
        aria-live="polite"
      >
        {last?.result ? (
          <div className="jv-result__body" key={last.id}>
            <div className="jv-result__head">
              <span className="jv-result__from">JARVIS</span>
              <p className="jv-result__reply">{last.result.reply}</p>
            </div>
            {last.result.detail ? (
              <ul className="jv-result__detail">
                {last.result.detail.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <span className="jv-result__placeholder">
            Awaiting command — responses are simulated.
          </span>
        )}
      </div>

      {commandConfig.showSuggestions ? (
        <div className="jv-suggest">
          <span className="jv-suggest__label">TRY</span>
          {exampleCommands.map((cmd) => (
            <button
              key={cmd}
              type="button"
              className="jv-suggest__chip"
              disabled={busy}
              onClick={() => {
                setValue(cmd);
                inputRef.current?.focus();
              }}
            >
              {cmd}
            </button>
          ))}
        </div>
      ) : null}

      <div className="jv-command-row">
        <VoiceControl
          state={voice.state}
          levels={voice.levels}
          transcript={voice.transcript}
          pushToTalk={voice.pushToTalk}
          onToggleMic={voice.toggleMic}
          onToggleMute={voice.toggleMute}
          onPushStart={voice.startPushToTalk}
          onPushEnd={voice.endPushToTalk}
        />

        <form className="jv-command" onSubmit={submit}>
          <div className="jv-command__field">
            <span className="jv-command__prompt">{busy ? '///' : '>_'}</span>
            <input
              ref={inputRef}
              className="jv-command__input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={commandConfig.placeholder}
              disabled={busy}
              aria-label="Command input"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="jv-command__meta">
              {busy ? (
                <span>{core.state.toUpperCase()}</span>
              ) : (
                <>
                  <span>↑↓ HISTORY ({history.entries.length})</span>
                  <span>ENTER TO RUN</span>
                  <span>SIMULATION · NO ACTION</span>
                </>
              )}
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
      </div>
    </div>
  );
});
