/**
 * ============================================================================
 *  JARVIS HUD — ORB APPEARANCE
 * ============================================================================
 *  Defaults, ranges and presets for the orb studio.
 *
 *  The shipped default reproduces the phase 1-4 look exactly, so opening this
 *  phase changes nothing until the operator moves a control.
 * ============================================================================
 */

import type {
  CoreState,
  GradientStyle,
  MotionStyle,
  OrbPreset,
  OrbStateStyle,
  OrbTheme,
} from '../contracts';

/** Bumped when OrbTheme's shape changes; older saves are then discarded. */
export const THEME_VERSION = 2;

/** Every numeric control, with the range the store clamps to. */
export const ranges = {
  size: { min: 0.6, max: 1.3, step: 0.01, label: 'SIZE' },
  glow: { min: 0, max: 2, step: 0.05, label: 'GLOW' },
  speed: { min: 0.35, max: 2.2, step: 0.05, label: 'SPEED' },
  gradientDepth: { min: 0, max: 1, step: 0.02, label: 'DEPTH' },
  tempoScale: { min: 0.2, max: 2, step: 0.05, label: 'TEMPO' },
  glowScale: { min: 0, max: 2, step: 0.05, label: 'GLOW' },
} as const;

export const gradientStyles: { id: GradientStyle; label: string; hint: string }[] = [
  { id: 'radial', label: 'RADIAL', hint: 'Secondary at the centre, fading out' },
  { id: 'linear', label: 'LINEAR', hint: 'Top-to-bottom sweep' },
  { id: 'conic', label: 'CONIC', hint: 'Angular sweep around the core' },
  { id: 'dual', label: 'DUAL', hint: 'Hard two-tone split' },
];

export const motionStyles: { id: MotionStyle; label: string; hint: string }[] = [
  { id: 'smooth', label: 'SMOOTH', hint: 'Balanced pulse and rotation' },
  { id: 'pulse', label: 'PULSE', hint: 'Breathes hard, turns slowly' },
  { id: 'orbit', label: 'ORBIT', hint: 'Turns fast, barely breathes' },
  { id: 'static', label: 'STATIC', hint: 'No motion at all' },
];

/**
 * How version 1 derived its second stop, kept solely so a theme saved by that
 * version can be migrated to an explicit secondary colour rather than
 * discarded. Nothing in the running app uses this any more.
 */
export const legacyGradientShift: Record<string, { hue: number; lightness: number }> = {
  solid: { hue: 0, lightness: 0 },
  radial: { hue: 0, lightness: 30 },
  dual: { hue: 150, lightness: 6 },
  aurora: { hue: 62, lightness: 18 },
};

/** Version 1 gradient names mapped onto version 2's blend styles. */
export const legacyGradientStyle: Record<string, GradientStyle> = {
  solid: 'radial',
  radial: 'radial',
  dual: 'dual',
  aurora: 'conic',
};

/**
 * Per-state defaults. Primaries match the phase 1-4 palette exactly, and each
 * secondary is the lifted tone version 1 used to derive, so the shipped default
 * still looks identical.
 */
const defaultStates: Record<CoreState, OrbStateStyle> = {
  idle: { color: '#22d3ee', color2: '#70e3f4', tempoScale: 1, glowScale: 1 },
  listening: { color: '#38bdf8', color2: '#8ed6fb', tempoScale: 0.7, glowScale: 1.1 },
  thinking: { color: '#a78bfa', color2: '#cdbcfc', tempoScale: 0.45, glowScale: 1.25 },
  working: { color: '#fbbf24', color2: '#fddb8b', tempoScale: 0.35, glowScale: 1.4 },
  success: { color: '#34d399', color2: '#84e6bf', tempoScale: 0.8, glowScale: 1.2 },
  error: { color: '#f87171', color2: '#fbb0b0', tempoScale: 0.25, glowScale: 1.5 },
};

export const defaultTheme: OrbTheme = {
  version: THEME_VERSION,
  shape: 'reactor',
  size: 1,
  glow: 1,
  speed: 1,
  gradientEnabled: true,
  gradient: 'radial',
  gradientDepth: 0.55,
  motion: 'smooth',
  states: defaultStates,
};

/** Deep copy, so callers can never mutate the default by reference. */
export function cloneDefaultTheme(): OrbTheme {
  return {
    ...defaultTheme,
    states: Object.fromEntries(
      (Object.entries(defaultTheme.states) as [CoreState, OrbStateStyle][]).map(([k, v]) => [
        k,
        { ...v },
      ]),
    ) as OrbTheme['states'],
  };
}

/** One-click looks. Anything a preset omits keeps its current value. */
export const presets: OrbPreset[] = [
  {
    id: 'classic',
    label: 'JARVIS',
    theme: {
      shape: 'reactor',
      glow: 1,
      speed: 1,
      gradientEnabled: true,
      gradient: 'radial',
      gradientDepth: 0.55,
      motion: 'smooth',
      states: {
        idle: { color: '#22d3ee', color2: '#70e3f4' },
        listening: { color: '#38bdf8', color2: '#8ed6fb' },
        thinking: { color: '#a78bfa', color2: '#cdbcfc' },
        working: { color: '#fbbf24', color2: '#fddb8b' },
        success: { color: '#34d399', color2: '#84e6bf' },
        error: { color: '#f87171', color2: '#fbb0b0' },
      },
    },
  },
  {
    id: 'arc',
    label: 'ARC',
    theme: {
      shape: 'orb',
      glow: 1.5,
      speed: 1.2,
      gradientEnabled: true,
      gradient: 'radial',
      gradientDepth: 0.9,
      motion: 'pulse',
      states: {
        idle: { color: '#7dd3fc', color2: '#ffffff' },
        listening: { color: '#bae6fd', color2: '#ffffff' },
        thinking: { color: '#93c5fd', color2: '#e0f2fe' },
        working: { color: '#e0f2fe', color2: '#ffffff' },
        success: { color: '#a7f3d0', color2: '#ecfdf5' },
        error: { color: '#fca5a5', color2: '#fee2e2' },
      },
    },
  },
  {
    id: 'crimson',
    label: 'CRIMSON',
    theme: {
      shape: 'ring',
      glow: 1.2,
      speed: 0.8,
      gradientEnabled: true,
      gradient: 'dual',
      gradientDepth: 0.6,
      motion: 'orbit',
      states: {
        idle: { color: '#f43f5e', color2: '#fb923c' },
        listening: { color: '#fb7185', color2: '#fbbf24' },
        thinking: { color: '#e879f9', color2: '#f43f5e' },
        working: { color: '#fb923c', color2: '#fbbf24' },
        success: { color: '#fbbf24', color2: '#a3e635' },
        error: { color: '#dc2626', color2: '#f87171' },
      },
    },
  },
  {
    id: 'emerald',
    label: 'EMERALD',
    theme: {
      shape: 'hexagon',
      glow: 0.9,
      speed: 1.3,
      gradientEnabled: true,
      gradient: 'conic',
      gradientDepth: 0.7,
      motion: 'smooth',
      states: {
        idle: { color: '#10b981', color2: '#a3e635' },
        listening: { color: '#34d399', color2: '#bef264' },
        thinking: { color: '#2dd4bf', color2: '#5eead4' },
        working: { color: '#a3e635', color2: '#fde047' },
        success: { color: '#4ade80', color2: '#bbf7d0' },
        error: { color: '#f87171', color2: '#fca5a5' },
      },
    },
  },
  {
    id: 'void',
    label: 'VOID',
    theme: {
      shape: 'hologram',
      glow: 1.6,
      speed: 0.7,
      gradientEnabled: true,
      gradient: 'conic',
      gradientDepth: 0.85,
      motion: 'pulse',
      states: {
        idle: { color: '#8b5cf6', color2: '#22d3ee' },
        listening: { color: '#a78bfa', color2: '#38bdf8' },
        thinking: { color: '#c084fc', color2: '#f0abfc' },
        working: { color: '#f0abfc', color2: '#fbbf24' },
        success: { color: '#22d3ee', color2: '#a7f3d0' },
        error: { color: '#fb7185', color2: '#c084fc' },
      },
    },
  },
  {
    id: 'mono',
    label: 'MONO',
    theme: {
      shape: 'minimal',
      glow: 0.6,
      speed: 1.5,
      // The one preset that deliberately ships with the gradient off.
      gradientEnabled: false,
      gradient: 'radial',
      gradientDepth: 0,
      motion: 'smooth',
      states: {
        idle: { color: '#cbd5e1', color2: '#cbd5e1' },
        listening: { color: '#e2e8f0', color2: '#e2e8f0' },
        thinking: { color: '#94a3b8', color2: '#94a3b8' },
        working: { color: '#f1f5f9', color2: '#f1f5f9' },
        success: { color: '#a7f3d0', color2: '#a7f3d0' },
        error: { color: '#fda4af', color2: '#fda4af' },
      },
    },
  },
];

/** Swatches offered next to the colour picker for each state. */
export const swatches: string[] = [
  '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc',
  '#f472b6', '#fb7185', '#f87171', '#fb923c', '#fbbf24', '#facc15',
  '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#cbd5e1', '#f1f5f9',
];

/** Where a saved theme lives. Appearance only — never anything sensitive. */
export const storageKey = 'jarvis.hud.orb.theme';

/** Where the operator's own presets live. Appearance only, same as the theme. */
export const presetsKey = 'jarvis.hud.orb.presets';

/** Upper bound on the preset library, so storage can never grow unbounded. */
export const maxPresets = 40;
