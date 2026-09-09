import { describe, expect, it } from 'vitest';
import { MOCK_MODE, connectorSeeds, serviceSeeds } from '../config/mock.config';
import { telemetry, voice } from '../config/jarvis.config';
import { createConnectors } from '../services/connectors';
import { sampleLevels, silentLevels, voiceLabel } from '../services/voice';

/**
 * Phase 2 safety contract. These tests fail loudly if the HUD is ever pointed
 * at something real without that being a deliberate change.
 */
describe('phase 2 safety contract', () => {
  it('runs in mock mode with a mock telemetry source', () => {
    expect(MOCK_MODE).toBe(true);
    expect(telemetry.source).toBe('mock');
  });

  it('never reports a service as really online', () => {
    for (const s of serviceSeeds) {
      expect(['mock', 'warning', 'offline']).toContain(s.status);
    }
  });

  it('never reports a connector as really connected', () => {
    for (const c of createConnectors()) {
      expect(c.state).not.toBe('connected');
    }
    expect(connectorSeeds).toHaveLength(8);
  });
});

describe('voice visualiser (mock)', () => {
  it('produces one level per bar, always inside 0..1', () => {
    for (const t of [0, 0.5, 1.7, 42]) {
      const levels = sampleLevels(t, false);
      expect(levels).toHaveLength(24);
      for (const l of levels) {
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThanOrEqual(1);
      }
    }
  });

  it('flattens the waveform while muted', () => {
    const muted = sampleLevels(3, true);
    expect(new Set(muted).size).toBe(1);
  });

  it('is silent when the mic is off', () => {
    expect(Math.max(...silentLevels())).toBeLessThan(0.1);
  });

  it('labels each voice state', () => {
    expect(voiceLabel('off', false)).toBe('MIC OFF');
    expect(voiceLabel('listening', false)).toBe('LISTENING');
    expect(voiceLabel('muted', false)).toBe('MUTED');
    expect(voiceLabel('off', true)).toBe('PUSH-TO-TALK');
  });

  it('keeps the microphone opt-in and push-to-talk configurable', () => {
    expect(voice.enabled).toBe(true);
    expect(voice.pushToTalkKey).toBe('Space');
  });
});
