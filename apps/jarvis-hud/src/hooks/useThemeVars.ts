import { useEffect } from 'react';
import { animation, palette } from '../config/jarvis.config';
import { gradientShift } from '../config/orb.config';
import type { CoreState, OrbTheme } from '../contracts';
import { shift, toRgba } from '../utils/color';

/**
 * Pushes the palette and the orb theme into CSS custom properties.
 *
 * Everything the core draws reads from these variables, so a studio edit is one
 * property write away from being on screen — no component re-renders, no
 * re-mount of the shape.
 */
export function useThemeVars(state: CoreState, theme: OrbTheme) {
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
      '--jv-transition': `${animation.transitionMs}ms`,
      '--jv-i': '0.32',
    };
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.reducedMotion = String(animation.reducedMotion);
  }, []);

  // Theme + state — the two together decide how the core looks right now.
  useEffect(() => {
    const root = document.documentElement;
    const style = theme.states[state];

    // Per-state overrides multiply the base, so "make everything slower" and
    // "make THINKING slower still" compose instead of fighting.
    const speed = theme.speed * style.tempoScale;
    const glow = theme.glow * style.glowScale;

    const { hue, lightness } = gradientShift[theme.gradient];
    const secondary =
      theme.gradient === 'solid'
        ? style.color
        : shift(style.color, hue * theme.gradientDepth, lightness * theme.gradientDepth);

    root.style.setProperty('--jv-state', style.color);
    root.style.setProperty('--jv-state-2', secondary);
    root.style.setProperty('--jv-state-glow', toRgba(style.color, 0.3 * Math.min(1.6, glow)));
    root.style.setProperty('--jv-glow', glow.toFixed(3));
    root.style.setProperty('--jv-orb-size', theme.size.toFixed(3));
    root.style.setProperty('--jv-pulse', `${(animation.pulseSeconds * speed).toFixed(2)}s`);
    root.style.setProperty('--jv-rotate', `${(animation.rotationSeconds * speed).toFixed(2)}s`);

    root.dataset.coreState = state;
    root.dataset.gradient = theme.gradient;
    root.dataset.motion = theme.motion;
  }, [state, theme]);
}
