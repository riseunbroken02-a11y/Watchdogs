/**
 * Adapter resolver.
 *
 * Decides, per subsystem, whether the live adapter or the mock one actually
 * serves the HUD — by probing, never by assuming. Every outcome produces an
 * `IntegrationBinding` the interface renders, so what is live and what is mock
 * is visible on screen rather than buried in a config file.
 *
 * Rules:
 *   mode 'mock'            → mock, no network activity whatsoever
 *   endpoint empty         → mock, whatever the mode says
 *   mode 'auto', probe ok  → live
 *   mode 'auto', probe bad → mock, with the reason recorded
 *   mode 'live', probe ok  → live
 *   mode 'live', probe bad → failed; the subsystem still runs on mock data so
 *                            the HUD stays usable, but it is flagged as failed
 *                            rather than quietly degraded
 */

import type {
  BindingState,
  EventBus,
  IntegrationBinding,
  IntegrationMode,
  ProbeResult,
} from '../contracts';

export interface ResolveInput<T> {
  id: string;
  label: string;
  mode: IntegrationMode;
  endpoint: string;
  /** Name reported when the live adapter wins, e.g. "aivm-brain". */
  liveAdapter: string;
  /** Probes the endpoint. Only called when there is one and the mode allows it. */
  probe: () => Promise<ProbeResult>;
  /** Builds the live implementation. May return null if it cannot initialise. */
  createLive: () => Promise<T | null>;
  /** Always available. */
  createMock: () => T;
}

export interface Resolution<T> {
  value: T;
  binding: IntegrationBinding;
}

export async function resolveAdapter<T>(
  input: ResolveInput<T>,
  bus: EventBus,
): Promise<Resolution<T>> {
  const base: Omit<IntegrationBinding, 'state' | 'adapter' | 'reason' | 'latencyMs'> = {
    id: input.id,
    label: input.label,
    mode: input.mode,
    endpoint: input.endpoint,
  };

  // Named to read as a verb, not as a React hook.
  const fallBackToMock = (
    state: BindingState,
    reason: string,
    latencyMs: number | null = null,
  ) => {
    const binding: IntegrationBinding = {
      ...base,
      state,
      adapter: 'mock',
      reason,
      latencyMs,
    };
    announce(bus, binding);
    return { value: input.createMock(), binding };
  };

  if (input.mode === 'mock') {
    return fallBackToMock('mock', 'Configured as mock');
  }

  if (!input.endpoint) {
    return fallBackToMock(
      input.mode === 'live' ? 'failed' : 'mock',
      'No endpoint configured',
    );
  }

  const probe = await input.probe();
  if (!probe.ok) {
    return fallBackToMock(
      input.mode === 'live' ? 'failed' : 'mock',
      `Endpoint did not answer: ${probe.reason}`,
      probe.latencyMs,
    );
  }

  const live = await input.createLive();
  if (live === null) {
    return fallBackToMock(
      input.mode === 'live' ? 'failed' : 'mock',
      'Endpoint answered but returned no usable data',
      probe.latencyMs,
    );
  }

  const binding: IntegrationBinding = {
    ...base,
    state: 'live',
    adapter: input.liveAdapter,
    reason: '',
    latencyMs: probe.latencyMs,
  };
  announce(bus, binding);
  return { value: live, binding };
}

/** Puts every binding decision on the bus, so the activity log records it. */
function announce(bus: EventBus, binding: IntegrationBinding) {
  if (binding.state === 'live') {
    bus.emit('system.info', {
      source: 'ADAPTER RESOLVER',
      message: `${binding.label} → LIVE via ${binding.adapter} (${binding.latencyMs ?? '?'} ms)`,
      level: 'info',
    });
    return;
  }

  if (binding.state === 'failed') {
    bus.emit('system.error', {
      source: 'ADAPTER RESOLVER',
      message: `${binding.label} → FAILED, serving mock data. ${binding.reason}`,
    });
    return;
  }

  bus.emit('system.info', {
    source: 'ADAPTER RESOLVER',
    message: `${binding.label} → MOCK. ${binding.reason}`,
    // "Configured as mock" is the expected default and not worth a warning.
    level: binding.reason === 'Configured as mock' ? 'info' : 'warning',
  });
}
