import { animation, coreShapes, stateMeta, stateTempo } from '../config/jarvis.config';
import type { CoreShapeId, CoreState } from '../types';
import { shapeRegistry } from './shapes/registry';
import './CoreStage.css';

interface CoreStageProps {
  shape: CoreShapeId;
  state: CoreState;
  intensity: number;
}

/**
 * Renders the currently selected core shape and the state caption underneath.
 * Shapes are swapped by id — adding a new one never touches this file.
 */
export function CoreStage({ shape, state, intensity }: CoreStageProps) {
  const Shape = shapeRegistry[shape];
  const meta = stateMeta[state];
  const shapeLabel = coreShapes.find((s) => s.id === shape)?.label ?? shape.toUpperCase();

  return (
    <div className="jv-stage">
      <div
        className="jv-stage__frame"
        style={
          {
            '--i': intensity.toFixed(3),
            '--tempo': animation.speed * stateTempo[state],
          } as React.CSSProperties
        }
      >
        <span className="jv-stage__shape-name">CORE // {shapeLabel}</span>
        <span className="jv-stage__bracket jv-stage__bracket--tl" />
        <span className="jv-stage__bracket jv-stage__bracket--tr" />
        <span className="jv-stage__bracket jv-stage__bracket--bl" />
        <span className="jv-stage__bracket jv-stage__bracket--br" />

        {/* key forces a remount so the entrance animation replays on every swap */}
        <div className="jv-stage__shape" key={shape}>
          <Shape state={state} intensity={intensity} />
        </div>

        <div className="jv-stage__caption">
          <span className="jv-stage__state">{meta.label}</span>
          <span className="jv-stage__divider" />
          <span className="jv-stage__hint">{meta.hint}</span>
        </div>
      </div>
    </div>
  );
}
