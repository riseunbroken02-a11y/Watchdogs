/**
 * Theme serialisation.
 *
 * Pure: turns a theme into a file and a file back into a theme, with an honest
 * account of anything that did not survive the trip. No I/O happens here — the
 * clipboard, the download and the file picker live in
 * `adapters/local/themeTransfer.ts`.
 *
 * The guiding rule for import is: repair what is repairable, refuse what is
 * not, and never do either silently. A paste that quietly produced the default
 * theme would be worse than an error message.
 */

import { THEME_VERSION, ranges } from '../config/orb.config';
import { coreShapes } from '../config/jarvis.config';
import type {
  CoreState,
  OrbStateStyle,
  OrbTheme,
  SavedPreset,
  ThemeFile,
  ThemeImportResult,
} from '../contracts';
import { isHexColor } from '../utils/color';
import { normalisePresets, normaliseTheme, STATES } from './themeSchema';

const THEME_KEYS = new Set([
  'version',
  'shape',
  'size',
  'glow',
  'opacity',
  'speed',
  'gradientEnabled',
  'gradient',
  'gradientDepth',
  'motion',
  'states',
]);

const STATE_KEYS = new Set(['color', 'color2', 'tempoScale', 'glowScale', 'opacityScale']);

/** Filename for a downloaded theme, dated so several exports do not collide. */
export function themeFilename(now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `jarvis-orb-theme-${date}.json`;
}

export function exportTheme(
  theme: OrbTheme,
  presets: SavedPreset[] = [],
  now = new Date(),
): string {
  const file: ThemeFile = {
    app: 'jarvis-hud',
    kind: 'orb-theme',
    version: THEME_VERSION,
    exportedAt: now.toISOString(),
    theme,
    // Omitted entirely when empty, so a plain theme file stays plain.
    ...(presets.length ? { presets } : {}),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Pulls the theme out of an envelope, a bare theme, or neither. */
function unwrap(parsed: unknown): { theme: unknown; envelope: boolean } | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;

  if ('theme' in record || 'kind' in record || 'app' in record) {
    return { theme: record.theme, envelope: true };
  }
  // A bare theme is accepted too: it is exactly what sits in browser storage,
  // so someone copying that out should not be told it is the wrong format.
  if ('states' in record || 'shape' in record) return { theme: record, envelope: false };
  return null;
}

/**
 * Lists what the normaliser changed, so the operator learns that their file
 * was not applied verbatim.
 */
function describeRepairs(raw: unknown, applied: OrbTheme): string[] {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') return warnings;
  const input = raw as Record<string, unknown>;

  const unknownKeys = Object.keys(input).filter((k) => !THEME_KEYS.has(k));
  if (unknownKeys.length) warnings.push(`Ignored unknown field(s): ${unknownKeys.join(', ')}`);

  if (typeof input.shape === 'string' && input.shape !== applied.shape) {
    warnings.push(`Unknown shape "${input.shape}" — kept ${applied.shape}`);
  }

  const numeric: [keyof typeof ranges, number][] = [
    ['size', applied.size],
    ['glow', applied.glow],
    ['opacity', applied.opacity],
    ['speed', applied.speed],
    ['gradientDepth', applied.gradientDepth],
  ];
  for (const [key, value] of numeric) {
    const incoming = input[key];
    if (typeof incoming === 'number' && Number.isFinite(incoming) && incoming !== value) {
      warnings.push(`${key} ${incoming} is outside ${ranges[key].min}–${ranges[key].max} — clamped to ${value}`);
    } else if (incoming !== undefined && typeof incoming !== 'number') {
      warnings.push(`${key} was not a number — kept ${value}`);
    }
  }

  for (const key of ['gradient', 'motion'] as const) {
    const incoming = input[key];
    if (typeof incoming === 'string' && incoming !== applied[key]) {
      warnings.push(`Unknown ${key} "${incoming}" — kept ${applied[key]}`);
    }
  }

  const states = input.states;
  if (states && typeof states === 'object') {
    const unknownStates = Object.keys(states).filter((k) => !STATES.includes(k as CoreState));
    if (unknownStates.length) warnings.push(`Ignored unknown state(s): ${unknownStates.join(', ')}`);

    for (const state of STATES) {
      const incoming = (states as Record<string, unknown>)[state];
      if (!incoming || typeof incoming !== 'object') continue;
      const style = incoming as Record<string, unknown>;

      const unknownFields = Object.keys(style).filter((k) => !STATE_KEYS.has(k));
      if (unknownFields.length) {
        warnings.push(`Ignored unknown field(s) on ${state}: ${unknownFields.join(', ')}`);
      }
      if (typeof style.color === 'string' && !isHexColor(style.color)) {
        warnings.push(`${state}: "${style.color}" is not a hex colour — kept ${applied.states[state].color}`);
      }
      for (const key of ['tempoScale', 'glowScale', 'opacityScale'] as const) {
        const value = style[key];
        const result = applied.states[state][key as keyof OrbStateStyle];
        if (typeof value === 'number' && Number.isFinite(value) && value !== result) {
          warnings.push(`${state}.${key} ${value} clamped to ${result}`);
        }
      }
    }
  }

  return warnings;
}

export function importTheme(json: string): ThemeImportResult {
  const fail = (message: string): ThemeImportResult => ({
    ok: false,
    message,
    warnings: [],
    theme: null,
    presets: [],
  });

  if (!json.trim()) return fail('Nothing to import.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return fail('That is not valid JSON.');
  }

  const unwrapped = unwrap(parsed);
  if (!unwrapped) return fail('That JSON is not a Jarvis orb theme.');

  const envelope = parsed as Partial<ThemeFile>;
  if (unwrapped.envelope) {
    if (envelope.app !== undefined && envelope.app !== 'jarvis-hud') {
      return fail(`That file came from "${String(envelope.app)}", not the Jarvis HUD.`);
    }
    if (envelope.kind !== undefined && envelope.kind !== 'orb-theme') {
      return fail(`That file is a "${String(envelope.kind)}", not an orb theme.`);
    }
  }

  const candidate = unwrapped.theme;
  if (!candidate || typeof candidate !== 'object') {
    return fail('That file has no theme in it.');
  }

  // Version lives on the theme; the envelope carries a copy for readability.
  const version = (candidate as Partial<OrbTheme>).version ?? envelope.version;
  const upgraded = version === 1 || version === 2;
  if (version !== THEME_VERSION && !upgraded) {
    return fail(
      `That theme is version ${String(version ?? 'unknown')}; this HUD reads version ${THEME_VERSION}.`,
    );
  }

  // normaliseTheme migrates a version 1 file rather than discarding it, so an
  // older export keeps working — and says so.
  const applied = normaliseTheme(candidate);
  const warnings = upgraded ? [] : describeRepairs(candidate, applied);
  if (upgraded) {
    warnings.push(
      version === 1
        ? 'Upgraded from version 1 — its derived second colour is now editable.'
        : 'Upgraded from version 2 — opacity was added at full strength.',
    );
  }

  const presets = normalisePresets(envelope.presets);
  const parts = [
    warnings.length
      ? `Theme applied with ${warnings.length} adjustment${warnings.length === 1 ? '' : 's'}.`
      : 'Theme applied.',
    presets.length ? `${presets.length} preset${presets.length === 1 ? '' : 's'} merged.` : '',
  ].filter(Boolean);

  return { ok: true, message: parts.join(' '), warnings, theme: applied, presets };
}

/** Shapes the HUD knows about, used by the tests to keep the two in step. */
export const knownShapes = coreShapes.map((s) => s.id);
