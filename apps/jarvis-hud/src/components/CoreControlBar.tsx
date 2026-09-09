import { memo } from 'react';
import { coreShapes } from '../config/jarvis.config';
import type { CoreState } from '../contracts';
import type { CoreShapeId } from '../types';
import { ShapeGlyph } from './ShapeGlyph';
import { StateSelector } from './StateSelector';
import './CoreControlBar.css';

interface CoreControlBarProps {
  shape: CoreShapeId;
  onShape: (id: CoreShapeId) => void;
  state: CoreState;
  onState: (state: CoreState) => void;
  locked: boolean;
}

/**
 * The core's own control surface: an icon rail for CORE SHAPE and the pills for
 * CORE STATE, kept together under the core instead of buried in a sidebar.
 */
export const CoreControlBar = memo(function CoreControlBar({
  shape,
  onShape,
  state,
  onState,
  locked,
}: CoreControlBarProps) {
  return (
    <div className="jv-core-control">
      <div className="jv-core-control__group">
        <span className="jv-core-control__label">CORE SHAPE</span>
        <div className="jv-rail" role="group" aria-label="Core shape">
          {coreShapes
            .filter((s) => s.enabled)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                className="jv-rail__btn"
                data-label={s.label}
                aria-pressed={shape === s.id}
                aria-label={`${s.label} — ${s.description}`}
                title={`${s.label} — ${s.description}`}
                onClick={() => onShape(s.id)}
              >
                <ShapeGlyph id={s.id} />
              </button>
            ))}
        </div>
      </div>

      <span className="jv-core-control__divider" />

      <div className="jv-core-control__group">
        <span className="jv-core-control__label">CORE STATE</span>
        <StateSelector active={state} onSelect={onState} locked={locked} />
      </div>
    </div>
  );
});
