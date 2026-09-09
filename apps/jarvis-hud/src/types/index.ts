/**
 * UI-local types.
 *
 * Everything that crosses a layer boundary lives in `src/contracts` instead.
 * What is left here is presentation-only: which shape the core is drawing and
 * what the voice widget is doing.
 */

export type CoreShapeId =
  | 'orb'
  | 'ring'
  | 'hexagon'
  | 'hologram'
  | 'reactor'
  | 'wave'
  | 'minimal'
  | 'custom';

/**
 * Every core shape component receives exactly this.
 * Activity intensity is NOT passed as a prop — it lives in the `--jv-i` CSS
 * custom property so shapes animate without re-rendering React.
 */
export interface CoreShapeProps {
  /** Current activity state of JARVIS — drives colour + animation speed. */
  state: import('../contracts').CoreState;
  /** Extra class hook for layout. */
  className?: string;
}

/** `off` = mic not engaged, `muted` = engaged but input suppressed. */
export type VoiceState = 'off' | 'listening' | 'muted';

export interface VoiceSnapshot {
  state: VoiceState;
  /** Bars driving the visualiser, each 0..1. */
  levels: number[];
  /** Mock transcript that builds up while "listening". */
  transcript: string;
  /** True while the push-to-talk key is held. */
  pushToTalk: boolean;
}
