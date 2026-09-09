import { describe, expect, it } from 'vitest';
import { exampleCommands, resolveCommand } from '../services/commands';
import { command as commandConfig } from '../config/jarvis.config';
import { commandSeeds } from '../config/mock.config';

describe('command resolution', () => {
  it('exposes every seeded example command as a suggestion', () => {
    expect(exampleCommands).toEqual(commandSeeds.map((s) => s.command));
    expect(exampleCommands).toHaveLength(6);
  });

  it('resolves each example command to its own mock answer', () => {
    for (const seed of commandSeeds) {
      const result = resolveCommand(seed.command);
      expect(result.reply).toBe(seed.reply);
      expect(result.ok).toBe(!seed.fails);
    }
  });

  it('matches free-form phrasing, not just the exact chip text', () => {
    expect(resolveCommand('can you run diagnostics for me').reply).toMatch(/Diagnostics complete/);
    expect(resolveCommand('SHOW ACTIVE AGENTS').reply).toMatch(/agents active/);
  });

  it('routes "open browser" to a failure so the ERROR state is reachable', () => {
    expect(resolveCommand('open browser').ok).toBe(false);
  });

  it('falls back without failing for unknown input', () => {
    const result = resolveCommand('make me a sandwich');
    expect(result.ok).toBe(true);
    expect(result.reply).toContain('make me a sandwich');
    expect(result.detail?.join(' ')).toMatch(/nothing was executed/i);
  });

  it('keeps real execution switched off in phase 2', () => {
    expect(commandConfig.executeForReal).toBe(false);
  });
});
