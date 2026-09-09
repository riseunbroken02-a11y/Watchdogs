import { describe, expect, it } from 'vitest';
import { createAgentRoster, engageAgents, releaseAgents, tickAgents } from '../services/agents';
import { agentSeeds } from '../config/mock.config';

describe('agent roster', () => {
  it('creates one agent per seed, including all six required agents', () => {
    const roster = createAgentRoster();
    expect(roster).toHaveLength(6);
    expect(roster.map((a) => a.id)).toEqual([
      'main',
      'aivm',
      'claude-code',
      'openclaw',
      'browser',
      'memory',
    ]);
  });

  it('keeps activity inside 0..100 across many ticks', () => {
    let roster = createAgentRoster();
    for (let i = 0; i < 200; i += 1) roster = tickAgents(roster);
    for (const agent of roster) {
      expect(agent.activity).toBeGreaterThanOrEqual(0);
      expect(agent.activity).toBeLessThanOrEqual(100);
    }
  });

  it('leaves offline agents at zero activity', () => {
    let roster = createAgentRoster();
    for (let i = 0; i < 50; i += 1) roster = tickAgents(roster);
    const browser = roster.find((a) => a.id === 'browser');
    expect(browser?.status).toBe('offline');
    expect(browser?.activity).toBe(0);
  });

  it('engages the named agents and releases them to their seeded status', () => {
    const roster = createAgentRoster();
    const engaged = engageAgents(roster, ['main', 'aivm'], 'Processing: test');
    expect(engaged.find((a) => a.id === 'main')?.status).toBe('working');
    expect(engaged.find((a) => a.id === 'aivm')?.currentTask).toBe('Processing: test');
    expect(engaged.find((a) => a.id === 'memory')?.status).toBe('active');

    const released = releaseAgents(engaged, ['main', 'aivm'], 'Completed: test');
    const main = released.find((a) => a.id === 'main');
    expect(main?.status).toBe(agentSeeds.find((s) => s.id === 'main')?.status);
    expect(main?.lastAction).toBe('Completed: test');
  });

  it('never wakes an offline agent', () => {
    const roster = createAgentRoster();
    const engaged = engageAgents(roster, ['browser'], 'Processing: test');
    expect(engaged.find((a) => a.id === 'browser')?.status).toBe('offline');
  });
});
