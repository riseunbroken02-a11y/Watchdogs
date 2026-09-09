import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApprovalGate } from '../kernel/approvalGate';
import { createEventBus } from '../kernel/eventBus';
import type { ApprovalGate, EventBus } from '../contracts';

let bus: EventBus;
let gate: ApprovalGate;

const POLICY = {
  blocked: ['destructive', 'financial'] as const,
  autoApproved: ['read'] as const,
  timeoutMs: 60,
};

beforeEach(() => {
  bus = createEventBus();
  gate = createApprovalGate({
    bus,
    policy: { blocked: [...POLICY.blocked], autoApproved: [...POLICY.autoApproved], timeoutMs: POLICY.timeoutMs },
  });
});

const ask = (kind: 'read' | 'write' | 'execute' | 'destructive' | 'financial') =>
  gate.request({ commandId: 'c1', kind, target: 'test', summary: `do a ${kind}` });

describe('approval gate', () => {
  it('auto-approves reads without troubling the operator', async () => {
    const decision = await ask('read');
    expect(decision.outcome).toBe('approved');
    expect(gate.pending()).toBeNull();
  });

  it('blocks destructive and financial actions outright — no dialog is ever offered', async () => {
    for (const kind of ['destructive', 'financial'] as const) {
      const decision = await ask(kind);
      expect(decision.outcome).toBe('blocked');
      // Crucially, nothing was ever pending: an operator could not approve it.
      expect(gate.pending()).toBeNull();
    }
  });

  it('reports a blocked action as an error on the bus', async () => {
    const errors: string[] = [];
    bus.on('system.error', (r) => errors.push(r.payload.message));
    await ask('destructive');
    expect(errors[0]).toMatch(/Blocked destructive/);
  });

  it('holds a write until the operator approves', async () => {
    const inFlight = ask('write');
    await vi.waitFor(() => expect(gate.pending()).not.toBeNull());

    const pending = gate.pending()!;
    expect(pending.kind).toBe('write');
    gate.resolve(pending.id, 'approved');

    const decision = await inFlight;
    expect(decision.outcome).toBe('approved');
    expect(decision.reason).toMatch(/operator/i);
    expect(gate.pending()).toBeNull();
  });

  it('honours a denial', async () => {
    const inFlight = ask('execute');
    await vi.waitFor(() => expect(gate.pending()).not.toBeNull());
    gate.resolve(gate.pending()!.id, 'denied');

    expect((await inFlight).outcome).toBe('denied');
  });

  it('auto-denies when nobody answers — silence is not consent', async () => {
    const decision = await ask('write');
    expect(decision.outcome).toBe('expired');
    expect(gate.pending()).toBeNull();
  });

  it('refuses a second request while one is open, rather than queueing it', async () => {
    const first = ask('write');
    await vi.waitFor(() => expect(gate.pending()).not.toBeNull());

    const second = await ask('execute');
    expect(second.outcome).toBe('denied');
    expect(second.reason).toMatch(/already awaiting/);

    gate.resolve(gate.pending()!.id, 'approved');
    expect((await first).outcome).toBe('approved');
  });

  it('ignores a decision for a request that is not the pending one', async () => {
    const inFlight = ask('write');
    await vi.waitFor(() => expect(gate.pending()).not.toBeNull());

    gate.resolve('apr-does-not-exist', 'approved');
    expect(gate.pending()).not.toBeNull();

    gate.resolve(gate.pending()!.id, 'denied');
    expect((await inFlight).outcome).toBe('denied');
  });

  it('notifies subscribers as the pending request comes and goes', async () => {
    const seen: (string | null)[] = [];
    gate.subscribe((pending) => seen.push(pending?.kind ?? null));

    const inFlight = ask('write');
    await vi.waitFor(() => expect(gate.pending()).not.toBeNull());
    gate.resolve(gate.pending()!.id, 'approved');
    await inFlight;

    expect(seen).toEqual(['write', null]);
  });

  it('stamps an expiry so the dialog can count down', async () => {
    const inFlight = ask('write');
    await vi.waitFor(() => expect(gate.pending()).not.toBeNull());
    const pending = gate.pending()!;

    expect(pending.expiresAt - pending.requestedAt).toBe(POLICY.timeoutMs);
    gate.resolve(pending.id, 'denied');
    await inFlight;
  });
});
