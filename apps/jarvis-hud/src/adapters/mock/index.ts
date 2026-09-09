/**
 * Mock runtime assembly.
 *
 * This is the ONLY file that decides which adapters the HUD runs on. Phase 4
 * adds a sibling (`adapters/live/index.ts`) that builds the same runtime from
 * real adapters, and a switch in the config chooses between them.
 */

import { agents as agentsConfig, command, panels, telemetry } from '../../config/jarvis.config';
import { ambientNotices, MOCK_MODE } from '../../config/mock.config';
import { createAgentRegistry } from '../../kernel/agentRegistry';
import { createCommandRouter } from '../../kernel/commandRouter';
import { createConnectorRegistry } from '../../kernel/connectorRegistry';
import { createCoreMachine } from '../../kernel/coreMachine';
import { createEventBus } from '../../kernel/eventBus';
import { createJarvisRuntime, type JarvisRuntime } from '../../kernel/jarvisRuntime';
import { createMockAgents } from './mockAgents';
import { createFallbackHandler, createMockCommandHandlers } from './mockCommandHandlers';
import { createMockConnectors } from './mockConnectors';
import { createMockMemory } from './mockMemory';
import { createMockTelemetry } from './mockTelemetry';

/**
 * Overrides for tests and for tuning the deployment.
 *
 * The pacing that makes the pipeline readable on screen (roughly six seconds
 * per command) is far too slow for a test suite, so both are expressed here
 * rather than being read straight from the config inside the kernel.
 */
export interface MockRuntimeOptions {
  timing?: Partial<{ listening: number; thinking: number; working: number; resolve: number }>;
  intervals?: Partial<{ agentTick: number; ambient: number; connectorSweep: number }>;
}

export function createMockRuntime(options: MockRuntimeOptions = {}): JarvisRuntime {
  const bus = createEventBus();
  const core = createCoreMachine('idle');

  const agents = createAgentRegistry(bus);
  createMockAgents().forEach((adapter) => agents.register(adapter));

  const connectors = createConnectorRegistry(bus);
  createMockConnectors().forEach((connector) => connectors.register(connector));

  const memory = createMockMemory(bus);
  const telemetryProvider = createMockTelemetry(telemetry.pollIntervalMs);

  const router = createCommandRouter({
    bus,
    core,
    agents,
    memory,
    connectors,
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
    agents,
    connectors,
    memory,
    telemetry: telemetryProvider,
    router,
    handlers: createMockCommandHandlers(),
    intervals: {
      agentTick: agentsConfig.tickIntervalMs,
      ambient: agentsConfig.ambientIntervalMs,
      connectorSweep: agentsConfig.connectorSweepMs,
      ...options.intervals,
    },
    ambient: ambientNotices,
    eventLimit: panels.eventStreamLimit,
  });

  bus.emit('system.info', {
    source: 'SYSTEM',
    message: `JARVIS runtime online — ${MOCK_MODE ? 'mock adapters' : 'live adapters'}`,
    level: 'info',
  });

  return runtime;
}

export { BAR_COUNT, mockTranscript, sampleLevels, silentLevels, voiceLabel } from './mockVoice';
