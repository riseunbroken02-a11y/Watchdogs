/**
 * Command pipeline — SIMULATION ONLY.
 *
 * Phase 1 deliberately performs no real action: no shell, no API, no MCP call.
 * `runCommand` walks the core through LISTENING → THINKING → WORKING →
 * SUCCESS/ERROR purely so the visual states can be demonstrated.
 *
 * WIRING UP FOR REAL LATER: replace the body of `dispatch()` with a call into
 * your OpenClaw / MCP bridge and flip `command.executeForReal` in the config.
 */

import { command as commandConfig } from '../config/jarvis.config';
import type { CoreState, LogEntry } from '../types';

export interface CommandRun {
  /** Called on every state transition. */
  onState: (state: CoreState) => void;
  /** Called whenever the simulated pipeline emits a log line. */
  onLog: (entry: Omit<LogEntry, 'id' | 'time'>) => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Deterministic demo responses so the HUD feels alive without doing anything. */
const responses: { match: RegExp; reply: string; fail?: boolean }[] = [
  { match: /status|health|report/i, reply: 'All five subsystems reporting nominal. Router latency 34 ms.' },
  { match: /memory|mem|recall/i, reply: 'CLAUDE-MEM holds 418 entries across 27 topic documents.' },
  { match: /route|model|omniroute/i, reply: 'OMNIROUTE active routes: 6. Primary lane healthy.' },
  { match: /deploy|build|ship/i, reply: 'Simulation only — no build pipeline is connected in phase 1.', fail: true },
  { match: /brain|aivm|graph/i, reply: 'AIVM-BRAIN knowledge graph: 1,204 nodes, 3,870 edges indexed.' },
];

function resolve(input: string): { reply: string; fail: boolean } {
  const hit = responses.find((r) => r.match.test(input));
  if (hit) return { reply: hit.reply, fail: Boolean(hit.fail) };
  return {
    reply: `Acknowledged: "${input}". Phase 1 is interface-only — no action was performed.`,
    fail: false,
  };
}

export async function runCommand(input: string, run: CommandRun): Promise<void> {
  const { simulation } = commandConfig;
  const trimmed = input.trim();

  run.onLog({ level: 'info', source: 'OPERATOR', message: trimmed });

  run.onState('listening');
  await wait(simulation.listeningMs);

  run.onState('thinking');
  run.onLog({ level: 'info', source: 'AIVM-BRAIN', message: 'Retrieving context from knowledge graph…' });
  await wait(simulation.thinkingMs);

  run.onState('working');
  run.onLog({ level: 'info', source: 'OPENCLAW', message: 'Dispatching simulated task chain…' });
  await wait(simulation.workingMs);

  if (commandConfig.executeForReal) {
    // Guard rail: phase 1 ships with executeForReal = false.
    run.onLog({
      level: 'warn',
      source: 'JARVIS',
      message: 'executeForReal is enabled but no backend is wired up. Nothing was executed.',
    });
  }

  const { reply, fail } = resolve(trimmed);
  run.onState(fail ? 'error' : 'success');
  run.onLog({ level: fail ? 'error' : 'success', source: 'JARVIS', message: reply });

  await wait(simulation.resolveMs);
  run.onState('idle');
}
