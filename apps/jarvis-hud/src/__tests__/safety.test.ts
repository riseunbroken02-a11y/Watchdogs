import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { command, runtime, telemetry, voice } from '../config/jarvis.config';
import { MOCK_MODE, connectorSeeds } from '../config/mock.config';
import { createConnectorRegistry } from '../kernel/connectorRegistry';
import { createEventBus } from '../kernel/eventBus';
import { createMockConnectors } from '../adapters/mock/mockConnectors';

/**
 * Phase 3 safety contract.
 *
 * These tests fail loudly if the HUD is ever pointed at something real, or if
 * a forbidden capability sneaks into the source, without that being a
 * deliberate and visible change.
 */

const SRC = new URL('..', import.meta.url).pathname;

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

describe('runs on mock adapters only', () => {
  it('mock mode is on and the mock adapter set is selected', () => {
    expect(MOCK_MODE).toBe(true);
    expect(runtime.adapters).toBe('mock');
    expect(telemetry.source).toBe('mock');
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

  const FORBIDDEN: [string, RegExp][] = [
    ['network fetch', /\bfetch\s*\(/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['WebSocket', /new\s+WebSocket/],
    ['EventSource', /new\s+EventSource/],
    ['sendBeacon', /sendBeacon/],
    ['microphone capture', /getUserMedia|MediaRecorder|SpeechRecognition/],
    ['shell execution', /child_process|execSync|spawnSync/],
    ['filesystem writes', /writeFileSync|unlinkSync|rmSync/],
    ['environment secrets', /process\.env|import\.meta\.env/],
    ['browser storage', /localStorage|sessionStorage|indexedDB/],
  ];

  for (const [label, pattern] of FORBIDDEN) {
    it(`contains no ${label}`, () => {
      const offenders = files.filter((f) => pattern.test(codeOf(f)));
      expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
    });
  }

  it('contains no credential-shaped literals', () => {
    // Long opaque strings assigned to key/token/secret names.
    const pattern = /(api[_-]?key|secret|token|password|bearer)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]/i;
    const offenders = files.filter((f) => pattern.test(codeOf(f)));
    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});
