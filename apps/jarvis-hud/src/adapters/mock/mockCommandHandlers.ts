/**
 * Mock command handlers.
 *
 * Each handler implements the `CommandHandler` contract and genuinely uses the
 * context it is given — it delegates to agents through the registry and reads
 * memory and connector health through their service interfaces. That is what
 * makes the seam real: swapping an adapter changes the answers without
 * touching a handler.
 *
 * Nothing here executes anything. No shell, no filesystem, no network, no
 * message, no transaction.
 */

import type { CommandContext, CommandHandler } from '../../contracts';

/**
 * Both the Dutch phrasing the operator types and an English alias.
 *
 * Dutch puts the verb last in a subordinate clause ("kun je mijn systeem
 * analyseren"), so the patterns match the keywords in either order rather than
 * assuming the imperative form.
 */
function handler(
  id: string,
  title: string,
  example: string,
  match: RegExp,
  agents: CommandHandler['agents'],
  run: (ctx: CommandContext) => Promise<{ ok: boolean; reply: string; detail?: string[] }>,
): CommandHandler {
  return { id, title, example, agents, matches: (input) => match.test(input), run };
}

export function createMockCommandHandlers(): CommandHandler[] {
  return [
    handler(
      'projects',
      'Projects',
      'Open mijn projecten',
      /projecten|open projects|show projects|list projects/i,
      ['jarvis', 'coding'],
      async (ctx) => {
        ctx.progress('Scanning workspace');
        const agent = await ctx.runAgent('coding', 'Enumerate workspace projects');
        return {
          ok: agent.ok,
          reply: '1 project in the workspace: apps/jarvis-hud.',
          detail: [
            'apps/jarvis-hud — React 19 + Vite · phase 3 architecture',
            'Contracts, kernel, adapters and UI are separated',
            'No other project is registered in this mock workspace',
          ],
        };
      },
    ),

    handler(
      'system-analysis',
      'System analysis',
      'Analyseer mijn systeem',
      /(analys\w*|analyz\w*|diagnos\w*)[\s\S]*systeem|systeem[\s\S]*(analys\w*|analyz\w*)|analy[sz]e (my )?system|system analysis|diagnostics|diagnose/i,
      ['jarvis', 'automation'],
      async (ctx) => {
        ctx.progress('Probing connectors');
        const connectors = await ctx.connectors.checkAll();
        const reachable = connectors.filter((c) => c.status === 'mock' || c.status === 'connected');
        const agent = await ctx.runAgent('automation', 'Run system analysis');
        return {
          ok: agent.ok,
          reply: `System analysed. ${reachable.length}/${connectors.length} connectors responded.`,
          detail: [
            `Connectors reachable: ${reachable.map((c) => c.name).join(', ') || 'none'}`,
            `Not reachable: ${connectors.filter((c) => !reachable.includes(c)).map((c) => c.name).join(', ') || 'none'}`,
            'All readings are simulated — no host was probed',
          ],
        };
      },
    ),

    handler(
      'start-task',
      'Start task',
      'Start een taak',
      /start\w*[\s\S]*taak|taak[\s\S]*start\w*|start (a )?task|nieuwe taak|new task/i,
      ['jarvis', 'automation'],
      async (ctx) => {
        ctx.progress('Queueing task');
        const agent = await ctx.runAgent('automation', 'Queue a new task');
        return {
          ok: agent.ok,
          reply: 'Task queued on the Automation Agent (mock).',
          detail: [
            `Correlation id: ${ctx.request.id}`,
            'The task exists only in this session — nothing was scheduled or executed',
            'Phase 4 routes this to a real OpenClaw worker',
          ],
        };
      },
    ),

    handler(
      'active-today',
      'Active today',
      'Wat is er vandaag actief?',
      /vandaag[\s\S]*actief|actief[\s\S]*vandaag|wat is er actief|active today|what.?s active|active agents|show agents/i,
      ['jarvis', 'research'],
      async (ctx) => {
        ctx.progress('Collecting agent state');
        const agent = await ctx.runAgent('research', 'Summarise activity');
        return {
          ok: agent.ok,
          reply: 'Activity summary compiled from the live agent registry.',
          detail: [
            'Agent roster and statuses are read from the registry, not hardcoded',
            'Connector health was last refreshed by the background sweep',
            'Everything reported is simulated',
          ],
        };
      },
    ),

    handler(
      'memory-search',
      'Search memory',
      'Zoek in mijn geheugen',
      /geheugen|check memory|search memory|memory search|recall|memory status/i,
      ['jarvis', 'memory'],
      async (ctx) => {
        ctx.progress('Querying memory service');
        // Goes through the MemoryService contract, so an AIVM-BRAIN or
        // Claude-Mem adapter would answer this identically.
        const hits = await ctx.memory.search({ text: '', category: 'all' });
        const stats = ctx.memory.stats();
        const agent = await ctx.runAgent('memory', 'Serve recall query');
        const newest = hits[0];
        return {
          ok: agent.ok,
          reply: `Memory holds ${stats.total} records across ${stats.categories} categories.`,
          detail: [
            newest ? `Most recent: "${newest.title}" (${newest.category})` : 'Store is empty',
            `Adapter: ${stats.adapter}`,
            'Served through the MemoryService interface, not a database',
          ],
        };
      },
    ),

    handler(
      'browser',
      'Open browser',
      'Open browser',
      /open browser|launch browser|browse|open de browser/i,
      ['jarvis', 'browser'],
      async (ctx) => {
        ctx.progress('Requesting browser session');
        // The Browser Agent is offline, so the registry refuses. This is the
        // path that exercises the ERROR state end to end.
        const agent = await ctx.runAgent('browser', 'Open a browser session');
        return {
          ok: false,
          reply: 'Browser session refused — the Browser Agent is offline.',
          detail: [
            agent.summary,
            'BROWSER connector: disconnected',
            'Phase 3 performs no real actions',
          ],
        };
      },
    ),
  ];
}

/** Used when no handler claims the input. */
export function createFallbackHandler(): CommandHandler {
  return {
    id: 'fallback',
    title: 'Unrecognised',
    example: '',
    agents: ['jarvis'],
    matches: () => true,
    async run(ctx) {
      const agent = await ctx.runAgent('jarvis', `Interpret: ${ctx.request.input}`);
      return {
        ok: agent.ok,
        reply: `Acknowledged: "${ctx.request.input}".`,
        detail: [
          'No handler matches this command.',
          'Register one in adapters/mock/mockCommandHandlers.ts, or wire a real router in phase 4.',
          'Nothing was executed.',
        ],
      };
    },
  };
}
