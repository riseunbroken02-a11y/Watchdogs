/**
 * Approval gate.
 *
 * Once the HUD can reach real systems, anything beyond reading has to be asked
 * for. This is the single chokepoint: a handler cannot write, execute, delete
 * or spend by calling a service directly — it calls `request()` and honours the
 * decision it gets back.
 *
 * Three outcomes are decided here rather than by the operator:
 *   - `blocked`  — the policy forbids this kind outright (destructive,
 *                  financial). No approve button is ever offered.
 *   - `approved` — the kind is auto-approved by policy (reads).
 *   - `expired`  — nobody answered in time. Silence is never consent.
 */

import type {
  ActionPolicy,
  ApprovalDecision,
  ApprovalGate,
  ApprovalRequest,
  EventBus,
} from '../contracts';

export interface ApprovalGateDeps {
  bus: EventBus;
  policy: ActionPolicy;
  /** Injectable so tests do not have to wait out the real timeout. */
  now?: () => number;
}

export function createApprovalGate(deps: ApprovalGateDeps): ApprovalGate {
  const { bus, policy } = deps;
  const now = deps.now ?? (() => Date.now());

  let pending: ApprovalRequest | null = null;
  let resolveCurrent: ((decision: ApprovalDecision) => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(pending: ApprovalRequest | null) => void>();
  let counter = 0;

  const notify = () => listeners.forEach((l) => l(pending));

  const settle = (decision: ApprovalDecision) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const resolver = resolveCurrent;
    pending = null;
    resolveCurrent = null;
    notify();
    resolver?.(decision);
  };

  return {
    async request(input) {
      const decidedAt = now();

      // 1. Hard block — never offered to the operator at all.
      if (policy.blocked.includes(input.kind)) {
        const reason = `${input.kind} actions are blocked by policy`;
        bus.emit('system.error', {
          source: 'APPROVAL GATE',
          message: `Blocked ${input.kind} on ${input.target}: ${input.summary}`,
        });
        return { requestId: 'blocked', outcome: 'blocked', decidedAt, reason };
      }

      // 2. Auto-approved by policy — reads, by default.
      if (policy.autoApproved.includes(input.kind)) {
        return {
          requestId: 'auto',
          outcome: 'approved',
          decidedAt,
          reason: `${input.kind} is auto-approved by policy`,
        };
      }

      // 3. One at a time: a second request while one is open is refused rather
      //    than queued, so an operator can never approve the wrong thing.
      if (pending) {
        return {
          requestId: 'busy',
          outcome: 'denied',
          decidedAt,
          reason: 'Another approval is already awaiting a decision',
        };
      }

      counter += 1;
      const request: ApprovalRequest = {
        ...input,
        id: `apr-${counter}`,
        requestedAt: decidedAt,
        expiresAt: decidedAt + policy.timeoutMs,
      };

      // The resolver and the timer are armed BEFORE anyone is told about the
      // request. A listener may answer synchronously — a keyboard shortcut, a
      // very fast click, a test — and that answer must not fall on the floor.
      const decided = new Promise<ApprovalDecision>((resolve) => {
        resolveCurrent = resolve;
      });
      timer = setTimeout(() => {
        bus.emit('system.info', {
          source: 'APPROVAL GATE',
          message: `Approval expired — ${request.summary}`,
          level: 'warning',
        });
        settle({
          requestId: request.id,
          outcome: 'expired',
          decidedAt: now(),
          reason: 'No decision before the request expired',
        });
      }, policy.timeoutMs);

      pending = request;
      notify();

      bus.emit('system.info', {
        source: 'APPROVAL GATE',
        message: `Approval requested — ${input.kind} on ${input.target}: ${input.summary}`,
        level: 'warning',
      });

      return decided;
    },

    pending: () => pending,

    resolve(requestId, outcome) {
      if (!pending || pending.id !== requestId) return;
      const request = pending;
      bus.emit(outcome === 'approved' ? 'system.info' : 'system.error', {
        source: 'APPROVAL GATE',
        ...(outcome === 'approved'
          ? { message: `Approved — ${request.summary}`, level: 'info' as const }
          : { message: `Denied — ${request.summary}` }),
      } as never);
      settle({
        requestId,
        outcome,
        decidedAt: now(),
        reason: outcome === 'approved' ? 'Approved by operator' : 'Denied by operator',
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
