import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { command as commandConfig, palette } from '../config/jarvis.config';
import { useCommandHistory } from '../hooks/useCommandHistory';
import { useVoice } from '../hooks/useVoice';
import { useRuntime } from '../state/jarvisContext';
import { useJarvis } from '../state/useJarvis';
import { CommandPipeline } from './CommandPipeline';
import { VoiceControl } from './VoiceControl';
import './CommandCenter.css';

/**
 * COMMAND CENTER — text in, mock result out, with the three pipeline stages
 * visible above the input.
 *
 * The component owns no logic beyond the input itself: it calls
 * `runtime.dispatch()` and renders whatever the kernel reports.
 */
export const CommandCenter = memo(function CommandCenter() {
  const runtime = useRuntime();
  const { busy, stage, history, lastResult, coreState } = useJarvis();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { recall, reset } = useCommandHistory(history);

  /** Voice hands its mock transcript straight to the input. */
  const onTranscript = useCallback((text: string) => {
    setValue(text);
    inputRef.current?.focus();
  }, []);

  const voice = useVoice(onTranscript);

  // Example commands come from the registered handlers, not a separate list.
  const examples = runtime.router
    .list()
    .map((h) => h.example)
    .filter(Boolean);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    void runtime.dispatch(trimmed);
    setValue('');
    reset();
  };

  /** ↑ / ↓ walk the command history, like a shell. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const recalled = recall(event.key === 'ArrowUp' ? -1 : 1, value);
    if (recalled === null) return;
    event.preventDefault();
    setValue(recalled);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const tone = lastResult?.ok === false ? palette.danger : palette.success;

  return (
    <div className="jv-command-center">
      <div
        className={`jv-result ${lastResult ? '' : 'jv-result--empty'}`}
        style={{ '--jv-tone': tone } as React.CSSProperties}
        aria-live="polite"
      >
        {lastResult ? (
          <div className="jv-result__body" key={history[0]?.id ?? 'result'}>
            <div className="jv-result__head">
              <span className="jv-result__from">JARVIS</span>
              <p className="jv-result__reply">{lastResult.reply}</p>
            </div>
            {lastResult.detail ? (
              <ul className="jv-result__detail">
                {lastResult.detail.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
                <li>
                  handler: {lastResult.handlerId} · {lastResult.durationMs} ms
                </li>
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
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              className="jv-suggest__chip"
              disabled={busy}
              onClick={() => {
                setValue(example);
                inputRef.current?.focus();
              }}
            >
              {example}
            </button>
          ))}
          <CommandPipeline stage={stage} />
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
                <span>{coreState.toUpperCase()}</span>
              ) : (
                <>
                  <span>↑↓ HISTORY ({history.length})</span>
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
