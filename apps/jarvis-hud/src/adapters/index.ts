/**
 * Runtime assembly.
 *
 * The single place where concrete adapters are chosen. Each subsystem is
 * resolved independently: memory can be live while agents stay mock, and a
 * failure in one never takes the HUD down.
 *
 * Nothing here reads a credential. An authenticated deployment injects a
 * `CredentialProvider` through `options.credentials`.
 */

import { agents as agentsConfig, command, panels, telemetry as telemetryConfig } from '../config/jarvis.config';
import { actionPolicy, integrations, probe } from '../config/integrations.config';
import { ambientNotices } from '../config/mock.config';
import { createAgentRegistry } from '../kernel/agentRegistry';
import { resolveAdapter } from '../kernel/adapterResolver';
import { createApprovalGate } from '../kernel/approvalGate';
import { createCommandRouter } from '../kernel/commandRouter';
import { createConnectorRegistry } from '../kernel/connectorRegistry';
import { createCoreMachine } from '../kernel/coreMachine';
import { createEventBus } from '../kernel/eventBus';
import { createJarvisRuntime, type JarvisRuntime } from '../kernel/jarvisRuntime';
import type {
  AgentAdapter,
  Connector,
  CredentialProvider,
  IntegrationBinding,
  MemoryService,
  TelemetryProvider,
} from '../contracts';
import { createHttpClient } from './live/httpClient';
import { nullCredentials } from './live/credentials';
import { createLiveAgents } from './live/liveAgents';
import { createLiveConnectors } from './live/liveConnectors';
import { createLiveMemory } from './live/liveMemory';
import { createLiveTelemetry } from './live/liveTelemetry';
import { createMockAgents } from './mock/mockAgents';
import { createFallbackHandler, createMockCommandHandlers } from './mock/mockCommandHandlers';
import { createMockConnectors } from './mock/mockConnectors';
import { createMockMemory } from './mock/mockMemory';
import { createMockTelemetry } from './mock/mockTelemetry';

export interface RuntimeOptions {
  /**
   * Supplies bearer tokens for live adapters. Omit and nothing is
   * authenticated — which is why the shipped live adapters only reach
   * unauthenticated local endpoints.
   */
  credentials?: CredentialProvider;
  /** Overrides for tests and for tuning a deployment. */
  timing?: Partial<{ listening: number; thinking: number; working: number; resolve: number }>;
  intervals?: Partial<{ agentTick: number; ambient: number; connectorSweep: number }>;
  /** Per-subsystem config override, so a host can point at its own services. */
  integrations?: Partial<typeof integrations>;
  /** Approval timeout override, for tests. */
  approvalTimeoutMs?: number;
}

/**
 * Builds the runtime, probing each configured integration first.
 *
 * Always resolves: a subsystem whose endpoint is unreachable falls back to its
 * mock adapter and is reported as such, rather than throwing.
 */
export async function createRuntime(options: RuntimeOptions = {}): Promise<JarvisRuntime> {
  const bus = createEventBus();
  const core = createCoreMachine('idle');
  const credentials = options.credentials ?? nullCredentials;
  const config = { ...integrations, ...options.integrations };
  const bindings: IntegrationBinding[] = [];

  const clientFor = (id: keyof typeof integrations) =>
    createHttpClient({
      baseUrl: config[id].endpoint,
      timeoutMs: config[id].timeoutMs,
      integrationId: id,
      credentials,
    });

  /* ------------------------------------------------------------- memory -- */
  const memoryHttp = clientFor('memory');
  const memoryResolution = await resolveAdapter<MemoryService>(
    {
      id: 'memory',
      label: 'Memory',
      mode: config.memory.mode,
      endpoint: memoryHttp.baseUrl,
      liveAdapter: 'aivm-brain',
      probe: () => memoryHttp.probe(probe.healthPath, probe.timeoutMs),
      createLive: async () => createLiveMemory(memoryHttp, bus),
      createMock: () => createMockMemory(bus),
    },
    bus,
  );
  bindings.push(memoryResolution.binding);
  const memory = memoryResolution.value;

  /* ------------------------------------------------------------- agents -- */
  const agentsHttp = clientFor('agents');
  const agentsResolution = await resolveAdapter<AgentAdapter[]>(
    {
      id: 'agents',
      label: 'Agents',
      mode: config.agents.mode,
      endpoint: agentsHttp.baseUrl,
      liveAdapter: 'openclaw',
      probe: () => agentsHttp.probe(probe.healthPath, probe.timeoutMs),
      createLive: async () => {
        const live = await createLiveAgents(agentsHttp, bus);
        // An empty roster is not a working integration.
        return live.length > 0 ? live : null;
      },
      createMock: () => createMockAgents(),
    },
    bus,
  );
  bindings.push(agentsResolution.binding);
  const agentRegistry = createAgentRegistry(bus);
  agentsResolution.value.forEach((adapter) => agentRegistry.register(adapter));

  /* --------------------------------------------------------- connectors -- */
  const connectorsHttp = clientFor('connectors');
  const connectorsResolution = await resolveAdapter<Connector[]>(
    {
      id: 'connectors',
      label: 'Connectors',
      mode: config.connectors.mode,
      endpoint: connectorsHttp.baseUrl,
      liveAdapter: 'broker',
      probe: () => connectorsHttp.probe(probe.healthPath, probe.timeoutMs),
      createLive: async () => {
        const live = await createLiveConnectors(connectorsHttp);
        return live.length > 0 ? live : null;
      },
      createMock: () => createMockConnectors(),
    },
    bus,
  );
  bindings.push(connectorsResolution.binding);
  const connectorRegistry = createConnectorRegistry(bus);
  connectorsResolution.value.forEach((connector) => connectorRegistry.register(connector));

  /* ---------------------------------------------------------- telemetry -- */
  const telemetryHttp = clientFor('telemetry');
  const telemetryResolution = await resolveAdapter<TelemetryProvider>(
    {
      id: 'telemetry',
      label: 'Telemetry',
      mode: config.telemetry.mode,
      endpoint: telemetryHttp.baseUrl,
      liveAdapter: 'metrics',
      probe: () => telemetryHttp.probe(probe.healthPath, probe.timeoutMs),
      createLive: async () =>
        createLiveTelemetry(telemetryHttp, bus, telemetryConfig.pollIntervalMs),
      createMock: () => createMockTelemetry(telemetryConfig.pollIntervalMs),
    },
    bus,
  );
  bindings.push(telemetryResolution.binding);

  /* ------------------------------------------------------------- kernel -- */
  const approvals = createApprovalGate({
    bus,
    policy: {
      blocked: actionPolicy.blocked,
      autoApproved: actionPolicy.autoApproved,
      timeoutMs: options.approvalTimeoutMs ?? actionPolicy.timeoutMs,
    },
  });

  const router = createCommandRouter({
    bus,
    core,
    agents: agentRegistry,
    memory,
    connectors: connectorRegistry,
    approvals,
    timing: {
      listening: command.simulation.listeningMs,
      thinking: command.simulation.thinkingMs,
      working: command.simulation.workingMs,
      resolve: command.simulation.resolveMs,
      ...options.timing,
    },
    fallback: createFallbackHandler(),
  });

  const runtime = createJarvisRuntime({
    bus,
    core,
    agents: agentRegistry,
    connectors: connectorRegistry,
    memory,
    telemetry: telemetryResolution.value,
    router,
    approvals,
    handlers: createMockCommandHandlers(),
    bindings,
    intervals: {
      agentTick: agentsConfig.tickIntervalMs,
      ambient: agentsConfig.ambientIntervalMs,
      connectorSweep: agentsConfig.connectorSweepMs,
      ...options.intervals,
    },
    ambient: ambientNotices,
    eventLimit: panels.eventStreamLimit,
  });

  const live = bindings.filter((b) => b.state === 'live').length;
  bus.emit('system.info', {
    source: 'SYSTEM',
    message:
      live === 0
        ? 'JARVIS runtime online — all subsystems on mock adapters'
        : `JARVIS runtime online — ${live}/${bindings.length} subsystems live`,
    level: 'info',
  });

  return runtime;
}

/** Mock-only runtime. Used by the tests that do not exercise the resolver. */
export function createMockRuntimeConfig(): Partial<typeof integrations> {
  return {
    memory: { mode: 'mock', endpoint: '', timeoutMs: 1000 },
    agents: { mode: 'mock', endpoint: '', timeoutMs: 1000 },
    connectors: { mode: 'mock', endpoint: '', timeoutMs: 1000 },
    telemetry: { mode: 'mock', endpoint: '', timeoutMs: 1000 },
  };
}
