import { memo, useState } from 'react';
import type { CoreState, SavedPreset } from '../contracts';
import { useAppearanceStore } from '../state/useAppearance';

/** The three states whose colours read best as a preset's fingerprint. */
const SWATCH_STATES: CoreState[] = ['idle', 'thinking', 'error'];

function Glyph({ d }: { d: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DUPLICATE = 'M9 9h10v10H9zM5 15V5h10';
const TRASH = 'M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13';

/**
 * LIBRARY — the operator's own presets.
 *
 * Save the current theme under a name, load it back, duplicate it or delete it.
 * Deletion asks for a second click rather than opening a dialog: a theme is
 * cheap to lose but annoying to lose by accident.
 */
export const PresetLibrary = memo(function PresetLibrary({ presets }: { presets: SavedPreset[] }) {
  const store = useAppearanceStore();
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const save = () => {
    store.savePreset(name);
    setName('');
  };

  return (
    <div className="jv-library">
      <div className="jv-library__save">
        <input
          className="jv-library__name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Name this look…"
          aria-label="Preset name"
          maxLength={40}
          spellCheck={false}
        />
        <button type="button" className="jv-transfer__btn" onClick={save}>
          SAVE
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="jv-library__empty">
          No saved presets yet. Tune the orb, name it, and it lands here.
        </p>
      ) : (
        <div className="jv-library__list">
          {presets.map((preset) => (
            <div key={preset.id} className="jv-saved">
              <button
                type="button"
                className="jv-saved__load"
                onClick={() => store.loadPreset(preset.id)}
                title={`Load "${preset.label}"`}
              >
                <span className="jv-saved__dots">
                  {SWATCH_STATES.map((state) => (
                    <span
                      key={state}
                      className="jv-saved__dot"
                      style={{ '--jv-dot': preset.theme.states[state].color } as React.CSSProperties}
                    />
                  ))}
                </span>
                <span className="jv-saved__label">{preset.label}</span>
              </button>

              <span className="jv-saved__actions">
                <button
                  type="button"
                  className="jv-saved__btn"
                  onClick={() => store.duplicatePreset(preset.id)}
                  aria-label={`Duplicate ${preset.label}`}
                  title="Duplicate"
                >
                  <Glyph d={DUPLICATE} />
                </button>
                <button
                  type="button"
                  className={`jv-saved__btn jv-saved__btn--danger ${confirming === preset.id ? 'jv-saved__btn--confirm' : ''}`}
                  onClick={() => {
                    // Two clicks to delete: the first arms, the second removes.
                    if (confirming === preset.id) {
                      store.deletePreset(preset.id);
                      setConfirming(null);
                    } else {
                      setConfirming(preset.id);
                    }
                  }}
                  onBlur={() => setConfirming((id) => (id === preset.id ? null : id))}
                  aria-label={
                    confirming === preset.id
                      ? `Confirm deleting ${preset.label}`
                      : `Delete ${preset.label}`
                  }
                  title={confirming === preset.id ? 'Click again to delete' : 'Delete'}
                >
                  <Glyph d={TRASH} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
