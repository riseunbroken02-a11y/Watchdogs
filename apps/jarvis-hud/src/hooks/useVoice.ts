import { useCallback, useEffect, useRef, useState } from 'react';
import { voice as voiceConfig } from '../config/jarvis.config';
import { BAR_COUNT, mockTranscript, sampleLevels, silentLevels } from '../adapters/mock/mockVoice';
import type { VoiceSnapshot, VoiceState } from '../types';

const SILENT = silentLevels();

/**
 * Mock voice interface.
 *
 * IMPORTANT: this never calls getUserMedia and never records anything. The
 * microphone is not requested, and no speech-to-text runs. It drives the
 * visualiser and the listening indicator so the voice UI can be reviewed before
 * real audio is wired up in a later phase.
 */
export function useVoice(onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceState>('off');
  const [pushToTalk, setPushToTalk] = useState(false);
  const [levels, setLevels] = useState<number[]>(SILENT);
  const [transcript, setTranscript] = useState('');
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const engaged = state !== 'off' || pushToTalk;
  const muted = state === 'muted';

  // Waveform animation. Only mounted while the mic UI is engaged, so the
  // inactive case needs no state write — it is derived below instead.
  useEffect(() => {
    if (!engaged) return;
    let raf = 0;
    const start = performance.now();
    let last = 0;
    const tick = (now: number) => {
      // Throttled to ~24fps: the visualiser reads fine and stays cheap.
      if (now - last > 42) {
        last = now;
        setLevels(sampleLevels((now - start) / 1000, muted));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engaged, muted]);

  // Mock transcript types itself out word by word while listening unmuted.
  // Sessions are cleared by the event handlers below, never from the effect.
  useEffect(() => {
    if (!engaged || muted) return;
    const words = mockTranscript().split(' ');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTranscript(words.slice(0, i).join(' '));
      if (i >= words.length) window.clearInterval(id);
    }, voiceConfig.transcriptWordMs);
    return () => window.clearInterval(id);
  }, [engaged, muted]);

  /** Hands the recognised phrase to the command input and stands down. */
  const commit = useCallback((text: string) => {
    if (text) onTranscriptRef.current(text);
    setTranscript('');
    setState('off');
    setPushToTalk(false);
  }, []);

  const toggleMic = useCallback(() => {
    setState((s) => {
      if (s === 'off') {
        setTranscript('');
        return 'listening';
      }
      return 'off';
    });
  }, []);

  const toggleMute = useCallback(() => {
    setState((s) => (s === 'off' ? 'off' : s === 'muted' ? 'listening' : 'muted'));
  }, []);

  const startPushToTalk = useCallback(() => {
    setTranscript('');
    setPushToTalk(true);
  }, []);

  const transcriptRef = useRef(transcript);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const endPushToTalk = useCallback(() => {
    setPushToTalk(false);
    commit(transcriptRef.current);
  }, [commit]);

  // Hold SPACE for push-to-talk, unless the operator is typing.
  useEffect(() => {
    if (!voiceConfig.pushToTalkKey) return;
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

    const down = (e: KeyboardEvent) => {
      if (e.code !== voiceConfig.pushToTalkKey || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      startPushToTalk();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== voiceConfig.pushToTalkKey || isTyping(e.target)) return;
      e.preventDefault();
      endPushToTalk();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [startPushToTalk, endPushToTalk]);

  const snapshot: VoiceSnapshot = {
    state,
    // Derived, not stored: an idle mic shows a flat line without a state write.
    levels: engaged ? levels : SILENT,
    transcript: engaged ? transcript : '',
    pushToTalk,
  };

  return {
    ...snapshot,
    barCount: BAR_COUNT,
    toggleMic,
    toggleMute,
    startPushToTalk,
    endPushToTalk,
  };
}
