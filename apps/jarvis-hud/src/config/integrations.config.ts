/**
 * ============================================================================
 *  JARVIS HUD — LIVE INTEGRATIONS
 * ============================================================================
 *  Feature flags for the real adapters.
 *
 *  SHIPPED DEFAULTS CONNECT TO NOTHING. Every subsystem is `mock` with an
 *  empty endpoint, so a fresh checkout performs no network activity at all.
 *  Point an endpoint at a running service and set its mode to switch it on.
 *
 *  THERE ARE NO CREDENTIALS IN THIS FILE, AND THERE MUST NEVER BE.
 *  This bundle ships to a browser, where anything in it is readable by whoever
 *  opens the page. Authenticated adapters take a `CredentialProvider` injected
 *  by the host — see ARCHITECTURE.md and `src/adapters/live/credentials.ts`.
 * ============================================================================
 */

import type { ActionKind, IntegrationMode } from '../contracts';

export interface IntegrationConfig {
  /**
   * 'mock' — never connect (default).
   * 'auto' — try the endpoint, fall back to mock if it does not answer.
   * 'live' — try the endpoint, report the subsystem as failed if it does not.
   */
  mode: IntegrationMode;
  /**
   * Base URL of the service. Empty means "not configured", which forces mock
   * regardless of the mode above.
   */
  endpoint: string;
  /** Per-request timeout in ms. Kept short: the HUD must never hang on a probe. */
  timeoutMs: number;
}

const OFF: IntegrationConfig = { mode: 'mock', endpoint: '', timeoutMs: 4000 };

export const integrations = {
  /**
   * AIVM-BRAIN behind the MemoryService contract.
   * Expects: GET /health · GET /memory/search · GET /memory/:id · POST /memory
   */
  memory: { ...OFF },

  /**
   * OpenClaw behind the AgentAdapter contract.
   * Expects: GET /health · GET /agents · POST /agents/:id/run
   */
  agents: { ...OFF },

  /**
   * Connector health via a local broker.
   * Expects: GET /health · GET /connectors
   */
  connectors: { ...OFF },

  /**
   * Machine metrics.
   * Expects: GET /health · GET /metrics
   */
  telemetry: { ...OFF },
} satisfies Record<string, IntegrationConfig>;

export type IntegrationId = keyof typeof integrations;

/* ------------------------------------------------------------------ policy */

/**
 * What the HUD is allowed to do once it is connected to something real.
 *
 * PHASE 4 SAFETY: destructive and financial actions are blocked outright — the
 * operator is not even offered an approve button, because a misclick must not
 * be able to delete data or move money. Writes and executions are allowed only
 * after an explicit approval in the HUD.
 */
export const actionPolicy = {
  blocked: ['destructive', 'financial'] as ActionKind[],
  autoApproved: ['read'] as ActionKind[],
  /** An unanswered approval auto-denies after this long. */
  timeoutMs: 45_000,
} as const;

/* ------------------------------------------------------------------- probe */

export const probe = {
  /** Path appended to an endpoint to test whether it is alive. */
  healthPath: '/health',
  /** Probes run once at startup; this bounds how long boot can take. */
  timeoutMs: 3000,
} as const;
