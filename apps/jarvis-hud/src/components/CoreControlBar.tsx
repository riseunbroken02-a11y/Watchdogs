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
  studioOpen: boolean;
  onToggleStudio: () => void;
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
  studioOpen,
  onToggleStudio,
}: CoreControlBarProps) {
  return (
    <div className="jv-core-control">
      <div className="jv-core-control__group">
        <span className="jv-core-control__label">SHAPE</span>
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
        <span className="jv-core-control__label">STATE</span>
        <StateSelector active={state} onSelect={onState} locked={locked} />
      </div>

      <span className="jv-core-control__divider" />

      <button
        type="button"
        className="jv-studio-toggle"
        aria-pressed={studioOpen}
        onClick={onToggleStudio}
        aria-label="Open the orb studio"
        title="Orb studio — shape, colour, glow, motion"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" strokeLinecap="round" />
        </svg>
        <span className="jv-studio-toggle__text">STUDIO</span>
      </button>
    </div>
  );
});
