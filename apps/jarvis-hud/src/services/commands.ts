/**
 * Command pipeline — SIMULATION ONLY.
 *
 * Phase 2 deliberately performs no real action: no shell, no filesystem, no
 * HTTP, no MCP call. `runCommand` walks the core through
 * LISTENING → THINKING → WORKING → SUCCESS/ERROR and emits matching events so
 * the whole HUD reacts as it would with a real backend behind it.
 *
 * WIRING UP FOR REAL LATER: replace the marked block inside `runCommand` with a
 * call into your OpenClaw / MCP bridge and flip `command.executeForReal` in
 * src/config/jarvis.config.ts.
 */

import { command as commandConfig } from '../config/jarvis.config';
import { commandFallback, commandSeeds } from '../config/mock.config';
import type { CommandResult, CoreState, EventKind } from '../types';

export interface CommandHooks {
  /** Called on every core state transition. */
  onState: (state: CoreState) => void;
  /** Called whenever the pipeline emits an event. */
  onEvent: (kind: EventKind, source: string, message: string) => void;
  /** Called when agents should be shown as engaged / released. */
  onAgents: (phase: 'engage' | 'release', ids: string[], label: string) => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Suggestion chips shown above the command input. */
export const exampleCommands: string[] = commandSeeds.map((s) => s.command);

/** Resolves free-form input against the mock handlers. */
export function resolveCommand(input: string): CommandResult {
  const hit = commandSeeds.find((s) => s.match.test(input));
  if (hit) return { reply: hit.reply, ok: !hit.fails, detail: hit.detail };
  const fallback = commandFallback(input.trim());
  return { reply: fallback.reply, ok: true, detail: fallback.detail };
}

/** Which agents a command lights up. Cosmetic only. */
function agentsFor(input: string): string[] {
  if (/memory|recall/i.test(input)) return ['main', 'memory'];
  if (/browser|open/i.test(input)) return ['main', 'browser'];
  if (/project|analy[sz]e|repo/i.test(input)) return ['main', 'claude-code'];
  if (/agents/i.test(input)) return ['main'];
  return ['main', 'aivm'];
}

export async function runCommand(input: string, hooks: CommandHooks): Promise<CommandResult> {
  const { simulation } = commandConfig;
  const trimmed = input.trim();
  const engaged = agentsFor(trimmed);

  hooks.onEvent('command', 'OPERATOR', trimmed);

  hooks.onState('listening');
  await wait(simulation.listeningMs);

  hooks.onState('thinking');
  hooks.onAgents('engage', engaged, `Processing: ${trimmed}`);
  hooks.onEvent('agent-start', 'MAIN AGENT', `Dispatching "${trimmed}" to ${engaged.length} agents`);
  hooks.onEvent('memory', 'AIVM-BRAIN', 'Retrieving context from knowledge graph');
  await wait(simulation.thinkingMs);

  hooks.onState('working');
  hooks.onEvent('agent-work', 'OPENCLAW', 'Executing simulated task chain');
  await wait(simulation.workingMs);

  // ---------------------------------------------------------------------
  // REAL EXECUTION WOULD GO HERE (phase 3).
  // Guard rail: phase 2 ships with executeForReal = false, so this branch is
  // dead code and no command ever leaves the browser.
  // ---------------------------------------------------------------------
  if (commandConfig.executeForReal) {
    hooks.onEvent(
      'warning',
      'JARVIS',
      'executeForReal is enabled but no backend is wired up. Nothing was executed.',
    );
  }

  const result = resolveCommand(trimmed);

  hooks.onState(result.ok ? 'success' : 'error');
  hooks.onAgents('release', engaged, result.ok ? `Completed: ${trimmed}` : `Failed: ${trimmed}`);
  hooks.onEvent(result.ok ? 'task-complete' : 'error', 'JARVIS', result.reply);

  await wait(simulation.resolveMs);
  hooks.onState('idle');

  return result;
}
