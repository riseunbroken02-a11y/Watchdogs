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
export const THEME_VERSION = 1;

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
  { id: 'solid', label: 'SOLID', hint: 'One flat accent' },
  { id: 'radial', label: 'RADIAL', hint: 'Bright core fading outward' },
  { id: 'dual', label: 'DUAL', hint: 'Complementary second tone' },
  { id: 'aurora', label: 'AURORA', hint: 'Neighbouring hue, lifted' },
];

export const motionStyles: { id: MotionStyle; label: string; hint: string }[] = [
  { id: 'smooth', label: 'SMOOTH', hint: 'Balanced pulse and rotation' },
  { id: 'pulse', label: 'PULSE', hint: 'Breathes hard, turns slowly' },
  { id: 'orbit', label: 'ORBIT', hint: 'Turns fast, barely breathes' },
  { id: 'static', label: 'STATIC', hint: 'No motion at all' },
];

/**
 * How far each gradient style pushes the second stop, at depth 1.
 * `hue` is in degrees, `lightness` in percentage points.
 */
export const gradientShift: Record<GradientStyle, { hue: number; lightness: number }> = {
  solid: { hue: 0, lightness: 0 },
  radial: { hue: 0, lightness: 30 },
  dual: { hue: 150, lightness: 6 },
  aurora: { hue: 62, lightness: 18 },
};

/** Per-state defaults. Colours match the phase 1-4 palette exactly. */
const defaultStates: Record<CoreState, OrbStateStyle> = {
  idle: { color: '#22d3ee', tempoScale: 1, glowScale: 1 },
  listening: { color: '#38bdf8', tempoScale: 0.7, glowScale: 1.1 },
  thinking: { color: '#a78bfa', tempoScale: 0.45, glowScale: 1.25 },
  working: { color: '#fbbf24', tempoScale: 0.35, glowScale: 1.4 },
  success: { color: '#34d399', tempoScale: 0.8, glowScale: 1.2 },
  error: { color: '#f87171', tempoScale: 0.25, glowScale: 1.5 },
};

export const defaultTheme: OrbTheme = {
  version: THEME_VERSION,
  shape: 'reactor',
  size: 1,
  glow: 1,
  speed: 1,
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
      gradient: 'radial',
      gradientDepth: 0.55,
      motion: 'smooth',
      states: {
        idle: { color: '#22d3ee' },
        listening: { color: '#38bdf8' },
        thinking: { color: '#a78bfa' },
        working: { color: '#fbbf24' },
        success: { color: '#34d399' },
        error: { color: '#f87171' },
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
      gradient: 'radial',
      gradientDepth: 0.9,
      motion: 'pulse',
      states: {
        idle: { color: '#7dd3fc' },
        listening: { color: '#bae6fd' },
        thinking: { color: '#93c5fd' },
        working: { color: '#e0f2fe' },
        success: { color: '#a7f3d0' },
        error: { color: '#fca5a5' },
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
      gradient: 'dual',
      gradientDepth: 0.4,
      motion: 'orbit',
      states: {
        idle: { color: '#f43f5e' },
        listening: { color: '#fb7185' },
        thinking: { color: '#e879f9' },
        working: { color: '#fb923c' },
        success: { color: '#fbbf24' },
        error: { color: '#dc2626' },
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
      gradient: 'aurora',
      gradientDepth: 0.6,
      motion: 'smooth',
      states: {
        idle: { color: '#10b981' },
        listening: { color: '#34d399' },
        thinking: { color: '#2dd4bf' },
        working: { color: '#a3e635' },
        success: { color: '#4ade80' },
        error: { color: '#f87171' },
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
      gradient: 'aurora',
      gradientDepth: 0.85,
      motion: 'pulse',
      states: {
        idle: { color: '#8b5cf6' },
        listening: { color: '#a78bfa' },
        thinking: { color: '#c084fc' },
        working: { color: '#f0abfc' },
        success: { color: '#22d3ee' },
        error: { color: '#fb7185' },
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
      gradient: 'solid',
      gradientDepth: 0,
      motion: 'smooth',
      states: {
        idle: { color: '#cbd5e1' },
        listening: { color: '#e2e8f0' },
        thinking: { color: '#94a3b8' },
        working: { color: '#f1f5f9' },
        success: { color: '#a7f3d0' },
        error: { color: '#fda4af' },
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
