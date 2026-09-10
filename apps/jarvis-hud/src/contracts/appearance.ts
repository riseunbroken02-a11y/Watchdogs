/**
 * Appearance contract.
 *
 * The orb's look is data, not code: one `OrbTheme` object drives every visual
 * property of the core, and the studio edits that object. Persistence sits
 * behind `AppearanceStorage`, so where a theme is kept is a swappable detail.
 */

import type { CoreShapeId } from '../types';
import type { CoreState } from './core';

/** How the second colour stop is derived from the state colour. */
export type GradientStyle = 'solid' | 'radial' | 'dual' | 'aurora';

/** How the core moves. */
export type MotionStyle = 'smooth' | 'pulse' | 'orbit' | 'static';

/** Per-state overrides, layered on top of the base theme. */
export interface OrbStateStyle {
  /** Accent colour for this state, as #rrggbb. */
  color: string;
  /** Multiplier on the base speed. Lower is faster. */
  tempoScale: number;
  /** Multiplier on the base glow. */
  glowScale: number;
}

export interface OrbTheme {
  /** Bumped when the shape of this object changes; older saves are discarded. */
  version: number;
  shape: CoreShapeId;
  /** Scale of the core within its stage. */
  size: number;
  /** Glow strength multiplier. */
  glow: number;
  /** Animation duration multiplier. Lower is faster. */
  speed: number;
  gradient: GradientStyle;
  /** How far the second gradient stop departs from the first, 0..1. */
  gradientDepth: number;
  motion: MotionStyle;
  states: Record<CoreState, OrbStateStyle>;
}

/**
 * Where a theme is kept.
 *
 * `save()` returns false rather than throwing when it cannot persist — a
 * private window, a full quota, storage disabled by policy. The HUD stays
 * usable and says so instead of losing the edit.
 */
export interface AppearanceStorage {
  /** Adapter id, surfaced in the studio so "not saved" is never a surprise. */
  readonly id: string;
  /** False for the in-memory fallback. */
  readonly persistent: boolean;
  load(): OrbTheme | null;
  save(theme: OrbTheme): boolean;
  clear(): void;
}

export interface OrbPreset {
  id: string;
  label: string;
  /** Applied over the current theme; anything omitted is left alone. */
  theme: Partial<Omit<OrbTheme, 'version' | 'states'>> & {
    states?: Partial<Record<CoreState, Partial<OrbStateStyle>>>;
  };
}

/**
 * An exported theme file.
 *
 * The envelope exists so an import can tell "this is a Jarvis theme" from
 * "this is some other JSON", and refuse the second with a useful message
 * instead of silently producing a default theme.
 */
export interface ThemeFile {
  app: 'jarvis-hud';
  kind: 'orb-theme';
  version: number;
  /** ISO timestamp, informational only. */
  exportedAt: string;
  theme: OrbTheme;
}

export interface ThemeImportResult {
  ok: boolean;
  /** One line for the studio to show. */
  message: string;
  /**
   * Anything that was clamped, rejected or dropped. An import is never
   * silently lossy: if a value did not survive, it is listed here.
   */
  warnings: string[];
  /** Null when ok is false. */
  theme: OrbTheme | null;
}

/**
 * Moving a theme in and out of the app.
 *
 * Every one of these touches something outside the page — the system
 * clipboard, the download folder, a file the operator picked — so they live
 * behind this contract and in a single adapter, the same way the network and
 * browser storage do.
 */
export interface ThemeTransfer {
  /** True when the browser exposes a usable clipboard API. */
  readonly canCopy: boolean;
  /** Writes text to the system clipboard. False means the caller should fall back. */
  copy(text: string): Promise<boolean>;
  /** Offers the text to the operator as a file download. */
  download(filename: string, text: string): boolean;
  /** Reads a file the operator picked. Rejects nothing; errors come back as a string. */
  readFile(file: File): Promise<{ ok: boolean; text: string; error: string }>;
}

export interface AppearanceStore {
  getTheme(): OrbTheme;
  subscribe(listener: () => void): () => void;
  /** Merges top-level fields. Values outside their range are clamped. */
  patch(partial: Partial<Omit<OrbTheme, 'states' | 'version'>>): void;
  /** Merges one state's overrides. */
  patchState(state: CoreState, partial: Partial<OrbStateStyle>): void;
  applyPreset(presetId: string): void;
  /** Back to the shipped defaults. */
  reset(): void;
  /** Restores one state to its default. */
  resetState(state: CoreState): void;
  /** The current theme as a pretty-printed JSON file, ready to save or paste. */
  exportTheme(): string;
  /**
   * Replaces the theme from exported JSON.
   * Applies nothing when the result is not ok, so a bad paste never disturbs
   * what is on screen.
   */
  importTheme(json: string): ThemeImportResult;
  /** Whether the last write reached durable storage, and where. */
  storageStatus(): { id: string; persistent: boolean; saved: boolean };
}
