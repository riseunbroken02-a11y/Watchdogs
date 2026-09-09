import { describe, expect, it } from 'vitest';
import { bootEvents, createEvent, randomAmbientEvent } from '../services/events';
import { ambientEvents } from '../config/mock.config';

describe('event stream', () => {
  it('gives every event a unique id', () => {
    const ids = Array.from({ length: 50 }, (_, i) => createEvent('info', 'TEST', `m${i}`).id);
    expect(new Set(ids).size).toBe(50);
  });

  it('boots with the newest line first', () => {
    const events = bootEvents();
    expect(events).toHaveLength(5);
    expect(events[events.length - 1].message).toMatch(/phase 2 initialised/);
  });

  it('only emits ambient events drawn from the mock config', () => {
    const messages = new Set(ambientEvents.map((e) => e.message));
    for (let i = 0; i < 40; i += 1) {
      expect(messages.has(randomAmbientEvent().message)).toBe(true);
    }
  });
});
