import { describe, expect, it } from 'vitest';
import { exportTheme, importTheme, themeFilename } from '../kernel/themeSerializer';
import { cloneDefaultTheme, presets, THEME_VERSION } from '../config/orb.config';
import { createAppearanceStore } from '../kernel/appearanceStore';
import { createMemoryAppearanceStorage } from '../adapters/local/memoryAppearanceStorage';
import type { OrbTheme } from '../contracts';

const parse = (json: string) => JSON.parse(json);

describe('export', () => {
  it('wraps the theme in an identifiable envelope', () => {
    const file = parse(exportTheme(cloneDefaultTheme(), [], new Date('2026-09-10T12:00:00Z')));

    expect(file.app).toBe('jarvis-hud');
    expect(file.kind).toBe('orb-theme');
    expect(file.version).toBe(THEME_VERSION);
    expect(file.exportedAt).toBe('2026-09-10T12:00:00.000Z');
    expect(file.theme).toEqual(cloneDefaultTheme());
  });

  it('is pretty-printed and newline-terminated, so it reads and diffs well', () => {
    const json = exportTheme(cloneDefaultTheme());
    expect(json).toContain('\n  "app"');
    expect(json.endsWith('\n')).toBe(true);
  });

  it('carries nothing but appearance', () => {
    const file = parse(exportTheme(cloneDefaultTheme()));
    expect(Object.keys(file).sort()).toEqual(['app', 'exportedAt', 'kind', 'theme', 'version']);
    expect(JSON.stringify(file)).not.toMatch(/token|secret|endpoint|command|memory|session/i);
  });

  it('names the file by date', () => {
    expect(themeFilename(new Date('2026-09-10T12:00:00Z'))).toBe('jarvis-orb-theme-2026-09-10.json');
  });
});

describe('import — round trip', () => {
  it('restores exactly what was exported', () => {
    const original: OrbTheme = {
      ...cloneDefaultTheme(),
      shape: 'hologram',
      size: 1.2,
      glow: 1.6,
      speed: 0.8,
      gradientEnabled: true,
      gradient: 'conic',
      gradientDepth: 0.85,
      motion: 'pulse',
    };
    original.states.thinking.color = '#ff00aa';

    const result = importTheme(exportTheme(original));

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.theme).toEqual(original);
  });

  it('round-trips every shipped preset', () => {
    for (const preset of presets) {
      const store = createAppearanceStore(createMemoryAppearanceStorage());
      store.applyPreset(preset.id);
      const before = store.getTheme();

      const result = importTheme(store.exportTheme());

      expect(result.ok, preset.id).toBe(true);
      expect(result.theme, preset.id).toEqual(before);
    }
  });

  it('accepts a bare theme too — that is what sits in browser storage', () => {
    const bare = JSON.stringify({ ...cloneDefaultTheme(), shape: 'wave' });
    const result = importTheme(bare);

    expect(result.ok).toBe(true);
    expect(result.theme?.shape).toBe('wave');
  });
});

describe('import — refusals', () => {
  const refuses = (json: string, pattern: RegExp) => {
    const result = importTheme(json);
    expect(result.ok).toBe(false);
    expect(result.theme).toBeNull();
    expect(result.message).toMatch(pattern);
  };

  it('refuses empty input', () => refuses('   ', /Nothing to import/));
  it('refuses malformed JSON', () => refuses('{ not json', /not valid JSON/));
  it('refuses a JSON array', () => refuses('[1,2,3]', /not a Jarvis orb theme/));
  it('refuses a string', () => refuses('"hello"', /not a Jarvis orb theme/));
  it('refuses unrelated JSON', () => refuses('{"hello":"world"}', /not a Jarvis orb theme/));

  it('refuses a file from another app', () => {
    refuses(
      JSON.stringify({ app: 'something-else', kind: 'orb-theme', theme: cloneDefaultTheme() }),
      /came from "something-else"/,
    );
  });

  it('refuses a different kind of file from this app', () => {
    refuses(
      JSON.stringify({ app: 'jarvis-hud', kind: 'command-history', theme: cloneDefaultTheme() }),
      /is a "command-history"/,
    );
  });

  it('refuses an envelope with no theme in it', () => {
    refuses(JSON.stringify({ app: 'jarvis-hud', kind: 'orb-theme' }), /no theme in it/);
  });

  it('refuses a theme from a different schema version, rather than half-applying it', () => {
    const stale = { ...cloneDefaultTheme(), version: 0 };
    refuses(exportTheme(stale as OrbTheme).replace('"version": 1', '"version": 0'), /version 0/);
  });
});

describe('import — repairs are reported, never silent', () => {
  const importPartial = (theme: Record<string, unknown>) =>
    importTheme(JSON.stringify({ ...theme, version: THEME_VERSION }));

  it('clamps an out-of-range number and says so', () => {
    const result = importPartial({ ...cloneDefaultTheme(), glow: 99 });

    expect(result.ok).toBe(true);
    expect(result.theme?.glow).toBe(2);
    expect(result.warnings.join(' ')).toMatch(/glow 99 is outside 0–2 — clamped to 2/);
    expect(result.message).toMatch(/1 adjustment/);
  });

  it('reports an unknown shape', () => {
    const result = importPartial({ ...cloneDefaultTheme(), shape: 'triangle' });
    expect(result.theme?.shape).toBe('reactor');
    expect(result.warnings.join(' ')).toMatch(/Unknown shape "triangle"/);
  });

  it('reports an unknown gradient and motion', () => {
    const result = importPartial({ ...cloneDefaultTheme(), gradient: 'plaid', motion: 'jitter' });
    expect(result.warnings.join(' ')).toMatch(/Unknown gradient "plaid"/);
    expect(result.warnings.join(' ')).toMatch(/Unknown motion "jitter"/);
  });

  it('reports a bad colour and keeps the previous one', () => {
    const theme = cloneDefaultTheme();
    const result = importPartial({
      ...theme,
      states: { ...theme.states, idle: { ...theme.states.idle, color: 'cyan' } },
    });

    expect(result.theme?.states.idle.color).toBe('#22d3ee');
    expect(result.warnings.join(' ')).toMatch(/idle: "cyan" is not a hex colour/);
  });

  it('reports fields it did not recognise', () => {
    const result = importPartial({ ...cloneDefaultTheme(), rotationSpeed: 5, author: 'me' });
    expect(result.warnings.join(' ')).toMatch(/Ignored unknown field\(s\): rotationSpeed, author/);
  });

  it('reports an unknown state', () => {
    const theme = cloneDefaultTheme();
    const result = importPartial({
      ...theme,
      states: { ...theme.states, sleeping: { color: '#ffffff' } },
    });
    expect(result.warnings.join(' ')).toMatch(/Ignored unknown state\(s\): sleeping/);
  });

  it('reports a per-state value that was clamped', () => {
    const theme = cloneDefaultTheme();
    const result = importPartial({
      ...theme,
      states: { ...theme.states, error: { ...theme.states.error, glowScale: 50 } },
    });
    expect(result.warnings.join(' ')).toMatch(/error\.glowScale 50 clamped to 2/);
  });

  it('says nothing when a file needs no repair', () => {
    const result = importTheme(exportTheme(cloneDefaultTheme()));
    expect(result.warnings).toEqual([]);
    expect(result.message).toBe('Theme applied.');
  });
});

describe('store integration', () => {
  it('importTheme applies and persists a good file', () => {
    const store = createAppearanceStore(createMemoryAppearanceStorage());
    const source = createAppearanceStore(createMemoryAppearanceStorage());
    source.applyPreset('void');

    const result = store.importTheme(source.exportTheme());

    expect(result.ok).toBe(true);
    expect(store.getTheme()).toEqual(source.getTheme());
  });

  it('a failed import leaves the current theme untouched', () => {
    const store = createAppearanceStore(createMemoryAppearanceStorage());
    store.applyPreset('crimson');
    const before = store.getTheme();

    const result = store.importTheme('{ garbage');

    expect(result.ok).toBe(false);
    expect(store.getTheme()).toEqual(before);
  });

  it('a failed import does not notify subscribers', () => {
    const store = createAppearanceStore(createMemoryAppearanceStorage());
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.importTheme('nonsense');
    expect(notified).toBe(0);

    store.importTheme(store.exportTheme());
    expect(notified).toBe(1);
  });
});
