/**
 * Command contract.
 *
 * The router turns free text into a handler call. Handlers are registered, not
 * hardcoded, so a real backend registers its own without touching the UI.
 */

import type { AgentId } from './agent';

export interface CommandRequest {
  /** Correlation id shared by every event this command emits. */
  id: string;
  input: string;
  receivedAt: number;
}

export interface CommandResult {
  ok: boolean;
  /** Headline answer shown in the result panel. */
  reply: string;
  /** Optional supporting lines. */
  detail?: string[];
  /** Which handler produced this. */
  handlerId: string;
  durationMs: number;
}

/** The three stages the command center visualises. */
export type CommandStage = 'idle' | 'input' | 'processing' | 'result';

export interface CommandContext {
  request: CommandRequest;
  /** Lets a handler delegate to agents. */
  runAgent(id: AgentId, input: string): Promise<{ ok: boolean; summary: string }>;
  /** Lets a handler read memory through the service contract. */
  memory: import('./memory').MemoryService;
  /** Lets a handler read connector health. */
  connectors: import('./connector').ConnectorRegistry;
  /** Reports progress; surfaced as events. */
  progress(message: string): void;
  /**
   * The ONLY way to perform anything that is not a plain read.
   * Returns the operator's decision; a handler must honour it.
   */
  requestApproval(
    input: Omit<import('./policy').ApprovalRequest, 'id' | 'commandId' | 'requestedAt' | 'expiresAt'>,
  ): Promise<import('./policy').ApprovalDecision>;
}

export interface CommandHandler {
  id: string;
  /** Human label used in the suggestion chips. */
  title: string;
  /** Example phrasing offered to the operator. */
  example: string;
  /** Decides whether this handler owns the input. */
  matches(input: string): boolean;
  /** Agents this handler engages, for the UI. */
  agents: AgentId[];
  run(ctx: CommandContext): Promise<Omit<CommandResult, 'handlerId' | 'durationMs'>>;
}

export interface CommandRouter {
  register(handler: CommandHandler): void;
  list(): CommandHandler[];
  /** Returns the handler that claims this input, or the fallback. */
  resolve(input: string): CommandHandler;
  /** Runs the full pipeline and emits command.* events. */
  dispatch(input: string): Promise<CommandResult>;
}
