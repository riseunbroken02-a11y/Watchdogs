import { coreShapes } from '../config/jarvis.config';
import type { CoreShapeId } from '../types';
import { ShapeGlyph } from './ShapeGlyph';
import './ShapeSelector.css';

interface ShapeSelectorProps {
  active: CoreShapeId;
  onSelect: (id: CoreShapeId) => void;
}

/** One-click switcher for the central core shape. Driven entirely by config. */
export function ShapeSelector({ active, onSelect }: ShapeSelectorProps) {
  return (
    <div className="jv-shapes" role="group" aria-label="Core shape">
      {coreShapes
        .filter((shape) => shape.enabled)
        .map((shape) => (
          <button
            key={shape.id}
            type="button"
            className="jv-shape-btn"
            aria-pressed={active === shape.id}
            onClick={() => onSelect(shape.id)}
            title={shape.description}
          >
            <ShapeGlyph id={shape.id} />
            <span className="jv-shape-btn__text">
              <span className="jv-shape-btn__label">{shape.label}</span>
              <span className="jv-shape-btn__desc">{shape.description}</span>
            </span>
          </button>
        ))}
    </div>
  );
}
