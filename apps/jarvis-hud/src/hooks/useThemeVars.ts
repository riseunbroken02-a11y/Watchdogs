import { useEffect } from 'react';
import { animation, palette, stateColors } from '../config/jarvis.config';
import type { CoreState } from '../types';

const toRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
};

/**
 * Pushes the values from jarvis.config.ts into CSS custom properties, and keeps
 * `--jv-state` in sync with the current core state so the whole HUD re-tints.
 */
export function useThemeVars(state: CoreState) {
  // Static tokens — applied once.
  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = {
      '--jv-bg': palette.bg,
      '--jv-bg-elevated': palette.bgElevated,
      '--jv-panel': palette.panel,
      '--jv-panel-border': palette.panelBorder,
      '--jv-grid': palette.grid,
      '--jv-accent': palette.accent,
      '--jv-accent-soft': palette.accentSoft,
      '--jv-accent-bright': palette.accentBright,
      '--jv-text': palette.text,
      '--jv-text-dim': palette.textDim,
      '--jv-text-faint': palette.textFaint,
      '--jv-success': palette.success,
      '--jv-warning': palette.warning,
      '--jv-danger': palette.danger,
      '--jv-violet': palette.violet,
      '--jv-pulse': `${animation.pulseSeconds}s`,
      '--jv-rotate': `${animation.rotationSeconds}s`,
      '--jv-transition': `${animation.transitionMs}ms`,
      '--jv-i': '0.32',
    };
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.reducedMotion = String(animation.reducedMotion);
  }, []);

  // State accent — applied on every state change.
  useEffect(() => {
    const root = document.documentElement;
    const color = stateColors[state];
    root.style.setProperty('--jv-state', color);
    root.style.setProperty('--jv-state-glow', toRgba(color, 0.3));
    root.dataset.coreState = state;
  }, [state]);
}
