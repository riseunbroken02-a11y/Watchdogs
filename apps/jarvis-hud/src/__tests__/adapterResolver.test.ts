import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAdapter } from '../kernel/adapterResolver';
import { createEventBus } from '../kernel/eventBus';
import type { EventBus, ProbeResult } from '../contracts';

let bus: EventBus;
beforeEach(() => {
  bus = createEventBus();
});

const OK: ProbeResult = { ok: true, latencyMs: 12, reason: '' };
const DEAD: ProbeResult = { ok: false, latencyMs: null, reason: 'Endpoint unreachable' };

function input(overrides: Partial<Parameters<typeof resolveAdapter<string>>[0]> = {}) {
  return {
    id: 'memory',
    label: 'Memory',
    mode: 'auto' as const,
    endpoint: 'http://127.0.0.1:8787',
    liveAdapter: 'aivm-brain',
    probe: async () => OK,
    createLive: async () => 'LIVE',
    createMock: () => 'MOCK',
    ...overrides,
  };
}

describe('adapter resolver', () => {
  it('mode "mock" never probes at all', async () => {
    const probe = vi.fn(async () => OK);
    const { value, binding } = await resolveAdapter(input({ mode: 'mock', probe }), bus);

    expect(probe).not.toHaveBeenCalled();
    expect(value).toBe('MOCK');
    expect(binding.state).toBe('mock');
    expect(binding.reason).toBe('Configured as mock');
  });

  it('an empty endpoint forces mock, whatever the mode says', async () => {
    const probe = vi.fn(async () => OK);
    const { value, binding } = await resolveAdapter(
      input({ mode: 'auto', endpoint: '', probe }),
      bus,
    );

    expect(probe).not.toHaveBeenCalled();
    expect(value).toBe('MOCK');
    expect(binding.reason).toBe('No endpoint configured');
  });

  it('binds live when the probe answers', async () => {
    const { value, binding } = await resolveAdapter(input(), bus);

    expect(value).toBe('LIVE');
    expect(binding.state).toBe('live');
    expect(binding.adapter).toBe('aivm-brain');
    expect(binding.latencyMs).toBe(12);
    expect(binding.reason).toBe('');
  });

  it('mode "auto" falls back to mock and records why', async () => {
    const { value, binding } = await resolveAdapter(input({ probe: async () => DEAD }), bus);

    expect(value).toBe('MOCK');
    expect(binding.state).toBe('mock');
    expect(binding.reason).toMatch(/Endpoint did not answer/);
  });

  it('mode "live" is marked failed, but still serves mock so the HUD works', async () => {
    const { value, binding } = await resolveAdapter(
      input({ mode: 'live', probe: async () => DEAD }),
      bus,
    );

    expect(value).toBe('MOCK');
    expect(binding.state).toBe('failed');
    expect(binding.adapter).toBe('mock');
  });

  it('treats a probe that answers but yields nothing usable as a failure', async () => {
    const { value, binding } = await resolveAdapter(input({ createLive: async () => null }), bus);

    expect(value).toBe('MOCK');
    expect(binding.reason).toMatch(/no usable data/);
  });

  it('announces every decision on the bus', async () => {
    const infos: string[] = [];
    const errors: string[] = [];
    bus.on('system.info', (r) => infos.push(r.payload.message));
    bus.on('system.error', (r) => errors.push(r.payload.message));

    await resolveAdapter(input(), bus);
    expect(infos.some((m) => /Memory → LIVE via aivm-brain/.test(m))).toBe(true);

    await resolveAdapter(input({ mode: 'live', probe: async () => DEAD }), bus);
    expect(errors.some((m) => /Memory → FAILED, serving mock data/.test(m))).toBe(true);
  });

  it('does not warn about the expected mock default', async () => {
    const levels: string[] = [];
    bus.on('system.info', (r) => levels.push(r.payload.level));
    await resolveAdapter(input({ mode: 'mock' }), bus);
    expect(levels).toEqual(['info']);
  });

  it('never lets a caller mistake a fallback for a live binding', async () => {
    for (const mode of ['auto', 'live'] as const) {
      const { binding } = await resolveAdapter(input({ mode, probe: async () => DEAD }), bus);
      expect(binding.state).not.toBe('live');
      expect(binding.adapter).toBe('mock');
      expect(binding.reason.length).toBeGreaterThan(0);
    }
  });
});
