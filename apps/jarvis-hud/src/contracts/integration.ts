/**
 * Integration contract.
 *
 * Phase 4 introduces real adapters alongside the mock ones. Which set actually
 * runs is decided at startup by probing the configured endpoint — never by
 * assumption. Whatever happens, the HUD reports the truth per subsystem.
 */

/** What the operator asked for. */
export type IntegrationMode =
  /** Never connect. The default for every subsystem. */
  | 'mock'
  /** Probe the endpoint; fall back to mock if it does not answer. */
  | 'auto'
  /** Probe the endpoint; report the subsystem as failed if it does not answer. */
  | 'live';

/** What actually happened. */
export type BindingState = 'mock' | 'live' | 'failed';

export interface IntegrationBinding {
  /** Subsystem id, e.g. "memory" or "agents". */
  id: string;
  label: string;
  /** Configured intent. */
  mode: IntegrationMode;
  /** Resolved reality. */
  state: BindingState;
  /** Adapter that ended up serving this subsystem, e.g. "mock" or "aivm-brain". */
  adapter: string;
  /** Human explanation, shown in the HUD. Always populated for mock/failed. */
  reason: string;
  /** Endpoint that was probed, with any credential stripped. Empty when none. */
  endpoint: string;
  /** Probe round-trip in ms, or null when no probe ran. */
  latencyMs: number | null;
}

/**
 * Supplies credentials at call time.
 *
 * NEVER implement this by reading a literal from this repository, and never
 * from `import.meta.env` — this bundle ships to a browser. A host that wants
 * authenticated live adapters injects a provider that fetches short-lived
 * tokens from its own backend.
 *
 * The default provider returns undefined for everything, which is why the
 * shipped live adapters only work against an unauthenticated local endpoint.
 */
export interface CredentialProvider {
  /** Returns a bearer token for the named integration, or undefined. */
  getToken(integrationId: string): Promise<string | undefined>;
}

/** Result of probing an endpoint before binding an adapter. */
export interface ProbeResult {
  ok: boolean;
  latencyMs: number | null;
  /** Populated when ok is false. */
  reason: string;
}
