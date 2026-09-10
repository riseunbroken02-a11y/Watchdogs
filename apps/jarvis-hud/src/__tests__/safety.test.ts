import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { command, runtime, telemetry, voice } from '../config/jarvis.config';
import { actionPolicy, integrations } from '../config/integrations.config';
import { MOCK_MODE, connectorSeeds } from '../config/mock.config';
import { createConnectorRegistry } from '../kernel/connectorRegistry';
import { createEventBus } from '../kernel/eventBus';
import { createMockConnectors } from '../adapters/mock/mockConnectors';

/**
 * Phase 5 safety contract.
 *
 * These tests fail loudly if the HUD is pointed at something real, or if a
 * forbidden capability sneaks into the source, without that being a deliberate
 * and visible change.
 *
 * WHAT CHANGED IN PHASE 4, AND WHY
 * Phase 3 forbade `fetch` outright. Phase 4 has live adapters, so it is now
 * permitted in EXACTLY ONE file — `adapters/live/httpClient.ts` — and still
 * forbidden everywhere else. That single chokepoint is what keeps the rest of
 * these assertions meaningful: every request in the app is issued there, with
 * a timeout, with `credentials: 'omit'`, and with a bearer token only when an
 * injected provider supplies one.
 *
 * WHAT CHANGED IN PHASE 5, AND WHY
 * Phase 5 persists the orb theme, so `localStorage` is now permitted in
 * EXACTLY ONE file — `adapters/local/localAppearanceStorage.ts` — and still
 * forbidden everywhere else. What it stores is asserted separately in
 * appearanceStorage.test.ts: appearance only, under one key, no identifiers.
 *
 * Everything else phase 3 forbade is still forbidden.
 */

const SRC = new URL('..', import.meta.url).pathname;

/** The one file allowed to touch the network, relative to src/. */
const NETWORK_CHOKEPOINT = 'adapters/live/httpClient.ts';

/** The one file allowed to touch browser storage, relative to src/. */
const STORAGE_CHOKEPOINT = 'adapters/local/localAppearanceStorage.ts';

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') sourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !full.includes('__tests__')) {
      acc.push(full);
    }
  }
  return acc;
}

/** Reads every source file with its comments stripped, so prose about a
 *  forbidden API never trips the scan — only real code does. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('ships connecting to nothing', () => {
  it('mock mode is on and the mock adapter set is selected', () => {
    expect(MOCK_MODE).toBe(true);
    expect(runtime.adapters).toBe('mock');
    expect(telemetry.source).toBe('mock');
  });

  it('every integration ships disabled, with no endpoint', () => {
    for (const [id, config] of Object.entries(integrations)) {
      expect(config.mode, `${id}.mode`).toBe('mock');
      expect(config.endpoint, `${id}.endpoint`).toBe('');
    }
  });

  it('destructive and financial actions are blocked outright, not merely gated', () => {
    expect(actionPolicy.blocked).toContain('destructive');
    expect(actionPolicy.blocked).toContain('financial');
    // Only reads may pass without an explicit decision.
    expect(actionPolicy.autoApproved).toEqual(['read']);
  });

  it('real command execution stays switched off', () => {
    expect(command.executeForReal).toBe(false);
  });

  it('no connector claims a real connection', async () => {
    const bus = createEventBus();
    const registry = createConnectorRegistry(bus);
    createMockConnectors().forEach((c) => registry.register(c));
    const views = await registry.checkAll();
    expect(views.some((v) => v.status === 'connected')).toBe(false);
    expect(connectorSeeds.every((c) => c.state !== 'connected')).toBe(true);
  });

  it('the microphone is opt-in and never auto-engaged', () => {
    expect(voice.enabled).toBe(true);
    expect(voice.pushToTalkKey).toBe('Space');
  });
});

describe('forbidden capabilities are absent from the source', () => {
  const files = sourceFiles(SRC);

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it(`issues network requests from ${NETWORK_CHOKEPOINT} and nowhere else`, () => {
    const callers = files
      .filter((f) => /\bfetch\s*\(/.test(codeOf(f)))
      .map((f) => f.replace(SRC, ''));
    expect(callers).toEqual([NETWORK_CHOKEPOINT]);
  });

  it(`reads browser storage from ${STORAGE_CHOKEPOINT} and nowhere else`, () => {
    const callers = files
      .filter((f) => /\blocalStorage\b/.test(codeOf(f)))
      .map((f) => f.replace(SRC, ''));
    expect(callers).toEqual([STORAGE_CHOKEPOINT]);
  });

  it('the storage chokepoint wraps every access, so blocked storage cannot break boot', () => {
    const code = readFileSync(join(SRC, STORAGE_CHOKEPOINT), 'utf8');
    // One try/catch per access: probe, load, save, clear.
    expect((code.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('the network chokepoint always times out and never sends ambient cookies', () => {
    const code = readFileSync(join(SRC, NETWORK_CHOKEPOINT), 'utf8');
    expect(code).toMatch(/AbortController/);
    expect(code).toMatch(/credentials:\s*'omit'/);
  });

  const FORBIDDEN: [string, RegExp][] = [
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['WebSocket', /new\s+WebSocket/],
    ['EventSource', /new\s+EventSource/],
    ['sendBeacon', /sendBeacon/],
    ['microphone capture', /getUserMedia|MediaRecorder|SpeechRecognition/],
    ['shell execution', /child_process|execSync|spawnSync/],
    ['filesystem writes', /writeFileSync|unlinkSync|rmSync/],
    ['environment secrets', /process\.env|import\.meta\.env/],
    ['sessionStorage', /sessionStorage/],
    ['indexedDB', /indexedDB/],
  ];

  for (const [label, pattern] of FORBIDDEN) {
    it(`contains no ${label}`, () => {
      const offenders = files.filter((f) => pattern.test(codeOf(f)));
      expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
    });
  }

  it('the shipped credential provider supplies nothing', async () => {
    const { nullCredentials } = await import('../adapters/live/credentials');
    expect(await nullCredentials.getToken('memory')).toBeUndefined();
    expect(await nullCredentials.getToken('agents')).toBeUndefined();
  });

  it('contains no credential-shaped literals', () => {
    // Long opaque strings assigned to key/token/secret names.
    const pattern = /(api[_-]?key|secret|token|password|bearer)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]/i;
    const offenders = files.filter((f) => pattern.test(codeOf(f)));
    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});
