/**
 * Action policy and approval contract.
 *
 * Phase 4 can reach real systems, so anything beyond reading has to be asked
 * for. A handler cannot perform a guarded action by calling a service directly:
 * it must request approval, and the operator must say yes in the HUD.
 */

/** Risk classes. Everything above `read` is gated. */
export type ActionKind =
  /** Reads only. Never gated. */
  | 'read'
  /** Creates or updates data in an external system. */
  | 'write'
  /** Runs something: a task, a job, a command. */
  | 'execute'
  /** Deletes or overwrites irrecoverably. Never auto-approved. */
  | 'destructive'
  /** Moves money. Never auto-approved. */
  | 'financial';

export interface ApprovalRequest {
  id: string;
  /** Command that triggered this. */
  commandId: string;
  kind: ActionKind;
  /** Subsystem that would be touched, e.g. "openclaw" or "github". */
  target: string;
  /** One-line description of exactly what would happen. */
  summary: string;
  /** Extra lines shown in the dialog, e.g. the payload. */
  detail?: string[];
  requestedAt: number;
  /** Epoch ms at which the request auto-denies. */
  expiresAt: number;
}

export type ApprovalOutcome = 'approved' | 'denied' | 'expired' | 'blocked';

export interface ApprovalDecision {
  requestId: string;
  outcome: ApprovalOutcome;
  decidedAt: number;
  /** Why, for the activity log. */
  reason: string;
}

export interface ActionPolicy {
  /**
   * Kinds that may never be approved at all, whatever the operator clicks.
   * Phase 4 ships with destructive and financial blocked outright.
   */
  readonly blocked: ActionKind[];
  /** Kinds that pass without asking. Phase 4 ships with `read` only. */
  readonly autoApproved: ActionKind[];
  /** How long an approval request stays open, in ms. */
  readonly timeoutMs: number;
}

export interface ApprovalGate {
  /** The single entry point for anything that is not a plain read. */
  request(input: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'expiresAt'>): Promise<ApprovalDecision>;
  /** The request awaiting an answer, if any. */
  pending(): ApprovalRequest | null;
  /** Called by the HUD when the operator decides. */
  resolve(requestId: string, outcome: 'approved' | 'denied'): void;
  /** Notified whenever the pending request changes. */
  subscribe(listener: (pending: ApprovalRequest | null) => void): () => void;
}
