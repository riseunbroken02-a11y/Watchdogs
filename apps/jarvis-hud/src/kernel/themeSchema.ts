/**
 * Theme schema.
 *
 * The single definition of what a valid `OrbTheme` is, the repair function that
 * turns anything at all into one, and the migration from older saves. It lives
 * on its own so the store and the serialiser can both depend on it without
 * depending on each other.
 *
 * The rule: repair what is repairable, migrate what is migratable, and fall
 * back to the default for the rest. A theme is cosmetic — losing one must never
 * block boot, but silently throwing one away is still rude, so a version that
 * can be upgraded is upgraded.
 */

import {
  cloneDefaultTheme,
  legacyGradientShift,
  legacyGradientStyle,
  maxPresets,
  ranges,
  THEME_VERSION,
} from '../config/orb.config';
import { coreShapes } from '../config/jarvis.config';
import type {
  CoreState,
  GradientStyle,
  MotionStyle,
  OrbStateStyle,
  OrbTheme,
  SavedPreset,
} from '../contracts';
import { isHexColor, shift } from '../utils/color';

/** The six core states, in the order the studio lists them. */
export const STATES: CoreState[] = ['idle', 'listening', 'thinking', 'working', 'success', 'error'];
export const GRADIENTS: GradientStyle[] = ['radial', 'linear', 'conic', 'dual'];
export const MOTIONS: MotionStyle[] = ['smooth', 'pulse', 'orbit', 'static'];

const clamp = (value: number, { min, max }: { min: number; max: number }, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/**
 * Version 1 → 2.
 *
 * Version 1 had no secondary colour: it derived one from a gradient style and a
 * depth. Rather than discard such a save, we compute the colour it *was*
 * showing and store that explicitly, so an upgrade looks like nothing happened.
 */
function migrateV1toV2(input: Record<string, unknown>): Record<string, unknown> {
  const legacyStyle = typeof input.gradient === 'string' ? input.gradient : 'radial';
  const depth = typeof input.gradientDepth === 'number' ? input.gradientDepth : 0.55;
  const move = legacyGradientShift[legacyStyle] ?? legacyGradientShift.radial;

  const states: Record<string, unknown> = {};
  const incoming = (input.states ?? {}) as Record<string, Record<string, unknown>>;
  for (const state of STATES) {
    const style = incoming[state] ?? {};
    const primary = typeof style.color === 'string' && isHexColor(style.color) ? style.color : null;
    states[state] = {
      ...style,
      ...(primary
        ? {
            color2:
              legacyStyle === 'solid'
                ? primary
                : shift(primary, move.hue * depth, move.lightness * depth),
          }
        : {}),
    };
  }

  return {
    ...input,
    version: 2,
    gradientEnabled: legacyStyle !== 'solid',
    gradient: legacyGradientStyle[legacyStyle] ?? 'radial',
    states,
  };
}

/**
 * Version 2 → 3.
 *
 * Version 3 adds opacity. A version 2 orb was always fully solid, so the
 * upgrade is a pair of neutral defaults and nothing visibly changes.
 */
function migrateV2toV3(input: Record<string, unknown>): Record<string, unknown> {
  const incoming = (input.states ?? {}) as Record<string, Record<string, unknown>>;
  const states: Record<string, unknown> = {};
  for (const state of STATES) {
    states[state] = { ...(incoming[state] ?? {}), opacityScale: 1 };
  }
  return { ...input, version: 3, opacity: 1, states };
}

/**
 * Walks a saved theme forward one version at a time, so a file written by any
 * schema we have shipped still opens. A version we do not know is returned
 * untouched and rejected later by `normaliseTheme`.
 */
export function migrateTheme(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  let current = raw as Record<string, unknown>;

  if (current.version === 1) current = migrateV1toV2(current);
  if (current.version === 2) current = migrateV2toV3(current);

  return current;
}

/**
 * Turns anything at all into a usable theme.
 *
 * Unknown fields are dropped and bad values fall back rather than failing,
 * because a theme is cosmetic and losing it should never block boot.
 *
 * `base` is what a rejected value falls back TO. Loading a stored or imported
 * theme falls back to the shipped default; an in-place edit falls back to the
 * theme the operator already had, so a bad hex or a stale value never silently
 * resets a field to factory. Callers must pass a copy — `base` is written to.
 */
export function normaliseTheme(raw: unknown, base: OrbTheme = cloneDefaultTheme()): OrbTheme {
  const migrated = migrateTheme(raw);
  if (!migrated || typeof migrated !== 'object') return base;
  const input = migrated as Partial<OrbTheme>;

  // A save from a schema we cannot migrate is discarded rather than half-applied.
  if (input.version !== THEME_VERSION) return base;

  const shapeIds = coreShapes.map((s) => s.id);
  if (typeof input.shape === 'string' && shapeIds.includes(input.shape)) base.shape = input.shape;
  if (typeof input.size === 'number') base.size = clamp(input.size, ranges.size, base.size);
  if (typeof input.glow === 'number') base.glow = clamp(input.glow, ranges.glow, base.glow);
  if (typeof input.opacity === 'number') {
    base.opacity = clamp(input.opacity, ranges.opacity, base.opacity);
  }
  if (typeof input.speed === 'number') base.speed = clamp(input.speed, ranges.speed, base.speed);
  if (typeof input.gradientDepth === 'number') {
    base.gradientDepth = clamp(input.gradientDepth, ranges.gradientDepth, base.gradientDepth);
  }
  if (typeof input.gradientEnabled === 'boolean') base.gradientEnabled = input.gradientEnabled;
  if (typeof input.gradient === 'string' && GRADIENTS.includes(input.gradient)) {
    base.gradient = input.gradient;
  }
  if (typeof input.motion === 'string' && MOTIONS.includes(input.motion)) {
    base.motion = input.motion;
  }

  if (input.states && typeof input.states === 'object') {
    for (const state of STATES) {
      const incoming = (input.states as Partial<Record<CoreState, Partial<OrbStateStyle>>>)[state];
      if (!incoming) continue;
      const target = base.states[state];
      if (typeof incoming.color === 'string' && isHexColor(incoming.color)) {
        target.color = incoming.color;
      }
      if (typeof incoming.color2 === 'string' && isHexColor(incoming.color2)) {
        target.color2 = incoming.color2;
      }
      if (typeof incoming.tempoScale === 'number') {
        target.tempoScale = clamp(incoming.tempoScale, ranges.tempoScale, target.tempoScale);
      }
      if (typeof incoming.glowScale === 'number') {
        target.glowScale = clamp(incoming.glowScale, ranges.glowScale, target.glowScale);
      }
      if (typeof incoming.opacityScale === 'number') {
        target.opacityScale = clamp(incoming.opacityScale, ranges.opacityScale, target.opacityScale);
      }
    }
  }

  return base;
}

/** Repairs a stored preset library, dropping anything unusable. */
export function normalisePresets(raw: unknown): SavedPreset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();

  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => {
      const id = typeof entry.id === 'string' && entry.id ? entry.id : null;
      const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : null;
      if (!id || !label || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        label: label.slice(0, 40),
        createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
        updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now(),
        theme: normaliseTheme(entry.theme),
      } satisfies SavedPreset;
    })
    .filter((preset): preset is SavedPreset => preset !== null)
    .slice(0, maxPresets);
}
