/**
 * Voice interface — SIMULATION ONLY.
 *
 * There is deliberately NO getUserMedia, NO MediaRecorder and NO speech-to-text
 * here. The microphone is never requested. `sampleLevels` produces a plausible
 * waveform so the visualiser can be built and reviewed ahead of real audio.
 */

import { voiceTranscripts } from '../config/mock.config';
import type { VoiceState } from '../types';

export const BAR_COUNT = 24;

export const silentLevels = (): number[] => new Array(BAR_COUNT).fill(0.04);

/**
 * Next frame of the mock visualiser.
 * `t` is a monotonically rising time in seconds; `muted` flattens the waveform.
 */
export function sampleLevels(t: number, muted: boolean): number[] {
  if (muted) return new Array(BAR_COUNT).fill(0.06);
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    // Centre bars swing widest, like a real speech envelope.
    const envelope = Math.sin((i / (BAR_COUNT - 1)) * Math.PI) ** 1.3;
    const wobble =
      Math.sin(i * 0.7 + t * 7.5) * 0.5 +
      Math.sin(i * 0.31 - t * 4.2) * 0.3 +
      Math.sin(i * 1.9 + t * 11) * 0.2;
    return Math.max(0.05, Math.min(1, 0.12 + envelope * (0.45 + wobble * 0.45)));
  });
}

/** A phrase the mock STT "recognises" — used to prefill the command input. */
export function mockTranscript(): string {
  return voiceTranscripts[Math.floor(Math.random() * voiceTranscripts.length)];
}

/** Label shown next to the microphone button. */
export function voiceLabel(state: VoiceState, pushToTalk: boolean): string {
  if (pushToTalk) return 'PUSH-TO-TALK';
  if (state === 'listening') return 'LISTENING';
  if (state === 'muted') return 'MUTED';
  return 'MIC OFF';
}
