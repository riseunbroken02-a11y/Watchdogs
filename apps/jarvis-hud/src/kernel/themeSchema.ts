/**
 * Theme schema.
 *
 * The single definition of what a valid `OrbTheme` is, and the repair function
 * that turns anything at all into one. It lives on its own so the store and the
 * serialiser can both depend on it without depending on each other.
 *
 * The rule: repair what is repairable and fall back to the default for the
 * rest. A theme is cosmetic — losing one must never block boot.
 */

import { cloneDefaultTheme, ranges, THEME_VERSION } from '../config/orb.config';
import { coreShapes } from '../config/jarvis.config';
import type {
  CoreState,
  GradientStyle,
  MotionStyle,
  OrbStateStyle,
  OrbTheme,
} from '../contracts';
import { isHexColor } from '../utils/color';

/** The six core states, in the order the studio lists them. */
export const STATES: CoreState[] = ['idle', 'listening', 'thinking', 'working', 'success', 'error'];
export const GRADIENTS: GradientStyle[] = ['solid', 'radial', 'dual', 'aurora'];
export const MOTIONS: MotionStyle[] = ['smooth', 'pulse', 'orbit', 'static'];

const clamp = (value: number, { min, max }: { min: number; max: number }, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/**
 * Turns anything at all into a usable theme.
 * Unknown fields are dropped; bad values fall back to the default rather than
 * failing, because a theme is cosmetic and losing it should never block boot.
 */
export function normaliseTheme(raw: unknown): OrbTheme {
  const base = cloneDefaultTheme();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<OrbTheme>;

  // A save from an older schema is discarded rather than half-applied.
  if (input.version !== THEME_VERSION) return base;

  const shapeIds = coreShapes.map((s) => s.id);
  if (typeof input.shape === 'string' && shapeIds.includes(input.shape)) base.shape = input.shape;
  if (typeof input.size === 'number') base.size = clamp(input.size, ranges.size, base.size);
  if (typeof input.glow === 'number') base.glow = clamp(input.glow, ranges.glow, base.glow);
  if (typeof input.speed === 'number') base.speed = clamp(input.speed, ranges.speed, base.speed);
  if (typeof input.gradientDepth === 'number') {
    base.gradientDepth = clamp(input.gradientDepth, ranges.gradientDepth, base.gradientDepth);
  }
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
      if (typeof incoming.tempoScale === 'number') {
        target.tempoScale = clamp(incoming.tempoScale, ranges.tempoScale, target.tempoScale);
      }
      if (typeof incoming.glowScale === 'number') {
        target.glowScale = clamp(incoming.glowScale, ranges.glowScale, target.glowScale);
      }
    }
  }

  return base;
}
