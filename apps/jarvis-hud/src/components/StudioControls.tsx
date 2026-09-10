import { memo, useState } from 'react';
import { isHexColor } from '../utils/color';
import './StudioControls.css';

/* ------------------------------------------------------------------ slider */

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** How the number reads, e.g. "1.25×". */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export const Slider = memo(function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: SliderProps) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="jv-ctrl">
      <div className="jv-ctrl__top">
        <span className="jv-ctrl__label">{label}</span>
        <span className="jv-ctrl__value">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        className="jv-slider"
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
});

/* -------------------------------------------------------- segmented control */

interface SegmentedProps<T extends string> {
  label?: string;
  options: { id: T; label: string; hint?: string }[];
  value: T;
  /** Two columns instead of one row, for longer option lists. */
  wrap?: boolean;
  onChange: (id: T) => void;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  wrap,
  onChange,
}: SegmentedProps<T>) {
  const active = options.find((o) => o.id === value);
  return (
    <div className="jv-ctrl">
      {label ? (
        <div className="jv-ctrl__top">
          <span className="jv-ctrl__label">{label}</span>
        </div>
      ) : null}
      <div className={`jv-seg ${wrap ? 'jv-seg--wrap' : ''}`} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="jv-seg__btn"
            aria-pressed={value === option.id}
            title={option.hint}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {active?.hint ? <span className="jv-ctrl__hint">{active.hint}</span> : null}
    </div>
  );
}

/* --------------------------------------------------------------- swatches */

export const Swatches = memo(function Swatches({
  colors,
  value,
  onPick,
}: {
  colors: string[];
  value: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className="jv-swatches" role="group" aria-label="Colour swatches">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className="jv-swatch"
          style={{ '--jv-swatch': color } as React.CSSProperties}
          aria-pressed={value.toLowerCase() === color.toLowerCase()}
          aria-label={color}
          title={color}
          onClick={() => onPick(color)}
        />
      ))}
    </div>
  );
});

/* ------------------------------------------------------------ colour field */

/**
 * Native picker plus a hex field.
 *
 * The typed value is kept locally while it is being edited, so half-typed
 * input like "#22d" does not repaint the HUD; it commits only once it parses.
 */
export const ColorField = memo(function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [valid, setValid] = useState(true);
  const [lastValue, setLastValue] = useState(value);

  // Adjusting state from a prop belongs in render, not an effect: this way the
  // field re-syncs in the same pass a preset changes the colour, with no
  // intermediate frame showing the old hex.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
    setValid(true);
  }

  const commit = (next: string) => {
    setDraft(next);
    const withHash = next.startsWith('#') ? next : `#${next}`;
    const ok = isHexColor(withHash);
    setValid(ok || next.length < 4);
    if (ok) onChange(withHash.toLowerCase());
  };

  return (
    <div className="jv-colorfield">
      <input
        className="jv-colorfield__picker"
        type="color"
        value={isHexColor(value) ? value : '#22d3ee'}
        aria-label="Pick colour"
        onChange={(e) => onChange(e.target.value.toLowerCase())}
      />
      <input
        className="jv-colorfield__hex"
        value={draft}
        aria-label="Colour hex"
        aria-invalid={!valid}
        spellCheck={false}
        maxLength={7}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setDraft(value)}
      />
    </div>
  );
});
