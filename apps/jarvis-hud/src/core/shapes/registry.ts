import type { ComponentType } from 'react';
import type { CoreShapeId, CoreShapeProps } from '../../types';
import { OrbCore } from './OrbCore';
import { RingCore } from './RingCore';
import { HexagonCore } from './HexagonCore';
import { HologramCore } from './HologramCore';
import { ReactorCore } from './ReactorCore';
import { WaveCore } from './WaveCore';
import { MinimalCore } from './MinimalCore';
import { CustomCore } from './CustomCore';

/**
 * Maps a shape id from the config to its component.
 * Add your own shape here + in `coreShapes` in jarvis.config.ts and it shows up
 * in the CORE SHAPE selector without touching anything else.
 */
export const shapeRegistry: Record<CoreShapeId, ComponentType<CoreShapeProps>> = {
  orb: OrbCore,
  ring: RingCore,
  hexagon: HexagonCore,
  hologram: HologramCore,
  reactor: ReactorCore,
  wave: WaveCore,
  minimal: MinimalCore,
  custom: CustomCore,
};
