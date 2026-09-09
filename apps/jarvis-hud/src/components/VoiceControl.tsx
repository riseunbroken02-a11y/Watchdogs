import { memo } from 'react';
import { voiceLabel } from '../adapters/mock/mockVoice';
import type { VoiceState } from '../types';
import './VoiceControl.css';

interface VoiceControlProps {
  state: VoiceState;
  levels: number[];
  transcript: string;
  pushToTalk: boolean;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onPushStart: () => void;
  onPushEnd: () => void;
}

function MicGlyph({ muted }: { muted: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <path d="M12 18v3" strokeLinecap="round" />
      {muted ? <path d="M4 4l16 16" strokeLinecap="round" /> : null}
    </svg>
  );
}

/**
 * VOICE UI — microphone, listening indicator, waveform visualiser, mute toggle
 * and push-to-talk.
 *
 * MOCK ONLY: the microphone is never requested, nothing is recorded and no
 * speech-to-text runs. Every bar you see is generated locally.
 */
export const VoiceControl = memo(function VoiceControl({
  state,
  levels,
  transcript,
  pushToTalk,
  onToggleMic,
  onToggleMute,
  onPushStart,
  onPushEnd,
}: VoiceControlProps) {
  const engaged = state !== 'off' || pushToTalk;
  const muted = state === 'muted';
  const live = (state === 'listening' || pushToTalk) && !muted;

  return (
    <div
      className={`jv-voice ${live ? 'jv-voice--live' : ''} ${muted ? 'jv-voice--muted-state' : ''}`}
    >
      <button
        type="button"
        className={`jv-mic ${engaged ? 'jv-mic--on' : ''} ${muted ? 'jv-mic--muted' : ''}`}
        onClick={onToggleMic}
        aria-pressed={engaged}
        aria-label={engaged ? 'Stop listening' : 'Start listening'}
        title={engaged ? 'Stop listening (mock)' : 'Start listening (mock)'}
      >
        <MicGlyph muted={muted} />
      </button>

      <button
        type="button"
        className="jv-voice__mute"
        onClick={onToggleMute}
        disabled={state === 'off'}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
        title={muted ? 'Unmute (mock)' : 'Mute (mock)'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
          {muted ? (
            <path d="M17 9l4 6M21 9l-4 6" strokeLinecap="round" />
          ) : (
            <path d="M17 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
          )}
        </svg>
      </button>

      <div
        className={`jv-viz ${!engaged ? 'jv-viz--idle' : ''} ${muted ? 'jv-viz--muted' : ''}`}
        role="img"
        aria-label={`Voice level visualiser — ${voiceLabel(state, pushToTalk).toLowerCase()}`}
      >
        {levels.map((level, i) => (
          <span key={i} className="jv-viz__bar" style={{ height: `${Math.round(level * 100)}%` }} />
        ))}
      </div>

      <div className="jv-voice__status">
        <span className="jv-voice__label">{voiceLabel(state, pushToTalk)}</span>
        {engaged ? (
          <span className="jv-voice__transcript">{transcript || 'listening…'}</span>
        ) : (
          <span className="jv-voice__hint">hold SPACE to talk</span>
        )}
      </div>

      <button
        type="button"
        className={`jv-voice__ptt ${pushToTalk ? 'jv-voice__ptt--held' : ''}`}
        onPointerDown={onPushStart}
        onPointerUp={onPushEnd}
        onPointerLeave={() => pushToTalk && onPushEnd()}
        aria-pressed={pushToTalk}
        title="Hold to talk (mock)"
      >
        PUSH TO TALK
      </button>

      <span className="jv-voice__mock" title="Voice input is simulated in phase 2">
        MOCK
      </span>
    </div>
  );
});
