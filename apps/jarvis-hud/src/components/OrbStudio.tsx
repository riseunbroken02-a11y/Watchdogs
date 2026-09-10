import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { coreShapes } from '../config/jarvis.config';
import {
  gradientStyles,
  motionStyles,
  presets,
  ranges,
  swatches,
} from '../config/orb.config';
import type {
  ColorSlot,
  CoreState,
  GradientStyle,
  MotionStyle,
  ThemeImportResult,
} from '../contracts';
import { PresetLibrary } from './PresetLibrary';
import { createThemeTransfer } from '../adapters/local/themeTransfer';
import { themeFilename } from '../kernel/themeSerializer';
import { palette } from '../config/jarvis.config';
import { useAppearance, useAppearanceStore, usePresets } from '../state/useAppearance';
import { ShapeGlyph } from './ShapeGlyph';
import { ColorField, Segmented, Slider, Swatches } from './StudioControls';
import './OrbStudio.css';

const STATES: CoreState[] = ['idle', 'listening', 'thinking', 'working', 'success', 'error'];

const times = (v: number) => `${v.toFixed(2)}×`;
const percent = (v: number) => `${Math.round(v * 100)}%`;

interface OrbStudioProps {
  open: boolean;
  onClose: () => void;
  /** The state the core is currently showing. */
  coreState: CoreState;
  /** Asks the HUD to preview a state while editing it. */
  onPreviewState: (state: CoreState) => void;
  /** False while a command owns the core, so previewing is unavailable. */
  canPreview: boolean;
}

/**
 * ORB STUDIO — the appearance configurator.
 *
 * Every control writes straight to the appearance store, which writes CSS
 * custom properties, so a change is on screen before the pointer leaves the
 * slider. The core stays visible to the left of this panel on purpose: these
 * are decisions you make by looking, not by reading numbers.
 */
export const OrbStudio = memo(function OrbStudio({
  open,
  onClose,
  coreState,
  onPreviewState,
  canPreview,
}: OrbStudioProps) {
  const store = useAppearanceStore();
  const theme = useAppearance();
  const library = usePresets();
  const transfer = useMemo(() => createThemeTransfer(), []);
  const [editing, setEditing] = useState<CoreState>(coreState);
  const [lastDriven, setLastDriven] = useState(coreState);

  /** null = closed, 'export' = showing the JSON, 'import' = awaiting a paste. */
  /** Which of the two colours the picker and swatches are editing. */
  const [slot, setSlot] = useState<ColorSlot>('primary');

  /** null = closed, 'export' = showing the JSON, 'import' = awaiting a paste. */
  const [pane, setPane] = useState<'export' | 'import' | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<ThemeImportResult | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // While a command drives the core, follow it: the panel should show what is
  // on screen rather than a state the operator is no longer looking at.
  // Adjusted during render so the editor never lags a frame behind the orb.
  if (!canPreview && coreState !== lastDriven) {
    setLastDriven(coreState);
    setEditing(coreState);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const storage = store.storageStatus();
  const style = theme.states[editing];

  const note = (ok: boolean, message: string, warnings: string[] = []): ThemeImportResult => ({
    ok,
    message,
    warnings,
    theme: null,
    presets: [],
  });

  const slotColor = slot === 'primary' ? style.color : style.color2;
  const setSlotColor = (color: string) =>
    store.patchState(editing, slot === 'primary' ? { color } : { color2: color });

  const handleCopy = async () => {
    const json = store.exportTheme();
    const copied = transfer.canCopy && (await transfer.copy(json));
    if (copied) {
      setStatus(note(true, 'Theme copied to the clipboard.'));
      return;
    }
    // No clipboard, or permission refused: show the JSON so it can still be
    // selected by hand rather than leaving the operator with nothing.
    setDraft(json);
    setPane('export');
    setStatus(note(true, 'Clipboard unavailable — select the JSON below and copy it.'));
    requestAnimationFrame(() => areaRef.current?.select());
  };

  const handleDownload = () => {
    const ok = transfer.download(themeFilename(), store.exportTheme());
    setStatus(
      ok
        ? note(true, `Saved as ${themeFilename()}.`)
        : note(false, 'This browser blocked the download.'),
    );
  };

  const handleImport = (json: string) => {
    const result = store.importTheme(json);
    setStatus(result);
    if (result.ok) {
      setPane(null);
      setDraft('');
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const read = await transfer.readFile(file);
    if (!read.ok) {
      setStatus(note(false, read.error));
      return;
    }
    handleImport(read.text);
  };

  const statusTone = status ? (status.ok ? palette.success : palette.danger) : palette.textDim;

  /** Selecting a state both edits it and shows it on the core. */
  const selectState = (next: CoreState) => {
    setEditing(next);
    if (canPreview) onPreviewState(next);
  };

  return (
    <aside className="jv-studio" aria-label="Orb studio">
      <header className="jv-studio__head">
        <h2 className="jv-studio__title">ORB STUDIO</h2>
        <span
          className={`jv-studio__badge ${storage.persistent && storage.saved ? 'jv-studio__badge--saved' : 'jv-studio__badge--unsaved'}`}
          title={
            storage.persistent && storage.saved
              ? 'Saved to this browser'
              : 'This browser refused durable storage — the theme applies now but will not survive a reload'
          }
        >
          {storage.persistent && storage.saved ? 'SAVED' : 'SESSION ONLY'}
        </span>
        <button type="button" className="jv-studio__close" onClick={onClose} aria-label="Close studio">
          ×
        </button>
      </header>

      <div className="jv-studio__presets">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="jv-preset"
            style={
              { '--jv-preset': preset.theme.states?.idle?.color ?? '#22d3ee' } as React.CSSProperties
            }
            onClick={() => store.applyPreset(preset.id)}
            title={`Apply the ${preset.label} preset`}
          >
            <span className="jv-preset__dot" />
            {preset.label}
          </button>
        ))}
      </div>

      <div className="jv-studio__body">
        {/* ---------------------------------------------------------- form */}
        <section className="jv-studio__section">
          <p className="jv-studio__legend">
            <span className="jv-studio__legend-text">FORM</span>
          </p>
          <div className="jv-studio__shapes" role="group" aria-label="Core shape">
            {coreShapes
              .filter((s) => s.enabled)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="jv-studio__shape"
                  aria-pressed={theme.shape === s.id}
                  aria-label={`${s.label} — ${s.description}`}
                  title={`${s.label} — ${s.description}`}
                  onClick={() => store.patch({ shape: s.id })}
                >
                  <ShapeGlyph id={s.id} />
                </button>
              ))}
          </div>
          <Slider
            label={ranges.size.label}
            value={theme.size}
            min={ranges.size.min}
            max={ranges.size.max}
            step={ranges.size.step}
            format={percent}
            onChange={(size) => store.patch({ size })}
          />
        </section>

        {/* -------------------------------------------------------- colour */}
        <section className="jv-studio__section">
          <p className="jv-studio__legend">
            <span className="jv-studio__legend-text">GRADIENT</span>
          </p>
          <button
            type="button"
            className="jv-toggle"
            aria-pressed={theme.gradientEnabled}
            onClick={() => store.patch({ gradientEnabled: !theme.gradientEnabled })}
            title="Off draws the core in the primary colour alone"
          >
            <span className="jv-toggle__track">
              <span className="jv-toggle__knob" />
            </span>
            <span className="jv-toggle__label">
              GRADIENT {theme.gradientEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <div className={theme.gradientEnabled ? '' : 'jv-studio__disabled'}>
            <Segmented<GradientStyle>
              options={gradientStyles}
              value={theme.gradient}
              wrap
              onChange={(gradient) => store.patch({ gradient })}
            />
          </div>
          <div className={theme.gradientEnabled ? '' : 'jv-studio__disabled'}>
            <Slider
              label={ranges.gradientDepth.label}
              value={theme.gradientDepth}
              min={ranges.gradientDepth.min}
              max={ranges.gradientDepth.max}
              step={ranges.gradientDepth.step}
              format={percent}
              onChange={(gradientDepth) => store.patch({ gradientDepth })}
            />
          </div>
          <Slider
            label={ranges.glow.label}
            value={theme.glow}
            min={ranges.glow.min}
            max={ranges.glow.max}
            step={ranges.glow.step}
            format={times}
            onChange={(glow) => store.patch({ glow })}
          />
        </section>

        {/* -------------------------------------------------------- motion */}
        <section className="jv-studio__section">
          <p className="jv-studio__legend">
            <span className="jv-studio__legend-text">MOTION</span>
          </p>
          <Segmented<MotionStyle>
            options={motionStyles}
            value={theme.motion}
            wrap
            onChange={(motion) => store.patch({ motion })}
          />
          <Slider
            label={ranges.speed.label}
            value={theme.speed}
            min={ranges.speed.min}
            max={ranges.speed.max}
            step={ranges.speed.step}
            // A lower duration multiplier is faster, so the readout inverts.
            format={(v) => `${(1 / v).toFixed(2)}×`}
            onChange={(speed) => store.patch({ speed })}
          />
        </section>

        {/* -------------------------------------------------------- states */}
        <section className="jv-studio__section">
          <p className="jv-studio__legend">
            <span className="jv-studio__legend-text">STATES</span>
          </p>
          <div className="jv-studio__states" role="group" aria-label="Core state to edit">
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                className="jv-state-tab"
                style={{ '--jv-tone': theme.states[s].color } as React.CSSProperties}
                aria-pressed={editing === s}
                onClick={() => selectState(s)}
              >
                <span className="jv-state-tab__dot" />
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          <p className="jv-studio__preview-note">
            {canPreview
              ? `Editing ${editing.toUpperCase()} — the core is previewing it.`
              : `Editing ${editing.toUpperCase()} — a command owns the core, so preview is paused.`}
          </p>

          <div className="jv-slotpair" role="group" aria-label="Colour slot">
            {(
              [
                ['primary', 'PRIMARY', style.color],
                ['secondary', 'SECONDARY', style.color2],
              ] as [ColorSlot, string, string][]
            ).map(([id, label, value]) => (
              <button
                key={id}
                type="button"
                className="jv-slot"
                aria-pressed={slot === id}
                onClick={() => setSlot(id)}
                title={
                  id === 'primary'
                    ? 'Drives the whole HUD tint'
                    : 'The gradient’s second stop — unused while the gradient is off'
                }
              >
                <span className="jv-slot__chip" style={{ '--jv-chip': value } as React.CSSProperties} />
                <span className="jv-slot__text">
                  <span className="jv-slot__name">{label}</span>
                  <span className="jv-slot__hex">{value}</span>
                </span>
              </button>
            ))}
          </div>

          <ColorField value={slotColor} onChange={setSlotColor} />
          <Swatches colors={swatches} value={slotColor} onPick={setSlotColor} />

          <div className="jv-studio__grid2">
            <Slider
              label={ranges.tempoScale.label}
              value={style.tempoScale}
              min={ranges.tempoScale.min}
              max={ranges.tempoScale.max}
              step={ranges.tempoScale.step}
              format={(v) => `${(1 / v).toFixed(2)}×`}
              onChange={(tempoScale) => store.patchState(editing, { tempoScale })}
            />
            <Slider
              label={ranges.glowScale.label}
              value={style.glowScale}
              min={ranges.glowScale.min}
              max={ranges.glowScale.max}
              step={ranges.glowScale.step}
              format={times}
              onChange={(glowScale) => store.patchState(editing, { glowScale })}
            />
          </div>

          <button
            type="button"
            className="jv-studio__btn"
            onClick={() => store.resetState(editing)}
          >
            RESET {editing.toUpperCase()}
          </button>
        </section>

        {/* ------------------------------------------------------- library */}
        <section className="jv-studio__section">
          <p className="jv-studio__legend">
            <span className="jv-studio__legend-text">LIBRARY</span>
          </p>
          <PresetLibrary presets={library} />
        </section>

        {/* ------------------------------------------------------ transfer */}
        <section className="jv-studio__section">
          <p className="jv-studio__legend">
            <span className="jv-studio__legend-text">TRANSFER</span>
          </p>

          <div className="jv-transfer">
            <div className="jv-transfer__row">
              <button type="button" className="jv-transfer__btn" onClick={handleCopy}>
                COPY JSON
              </button>
              <button type="button" className="jv-transfer__btn" onClick={handleDownload}>
                DOWNLOAD
              </button>
            </div>

            <div className="jv-transfer__row">
              <button
                type="button"
                className="jv-transfer__btn"
                aria-pressed={pane === 'import'}
                onClick={() => {
                  const next = pane === 'import' ? null : 'import';
                  setPane(next);
                  setDraft('');
                  setStatus(null);
                  if (next) requestAnimationFrame(() => areaRef.current?.focus());
                }}
              >
                PASTE JSON
              </button>
              <button
                type="button"
                className="jv-transfer__btn"
                onClick={() => fileRef.current?.click()}
              >
                LOAD FILE
              </button>
            </div>

            <input
              ref={fileRef}
              className="jv-transfer__file"
              type="file"
              accept="application/json,.json"
              aria-label="Load a theme file"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                // Reset so picking the same file twice fires again.
                e.target.value = '';
              }}
            />

            {pane ? (
              <textarea
                ref={areaRef}
                className="jv-transfer__area"
                value={draft}
                readOnly={pane === 'export'}
                spellCheck={false}
                aria-label={pane === 'export' ? 'Theme JSON' : 'Paste a theme'}
                placeholder={pane === 'import' ? 'Paste an exported theme here…' : undefined}
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : null}

            {pane === 'import' ? (
              <div className="jv-transfer__row">
                <button
                  type="button"
                  className="jv-transfer__btn"
                  disabled={draft.trim().length === 0}
                  onClick={() => handleImport(draft)}
                >
                  APPLY
                </button>
                <button
                  type="button"
                  className="jv-transfer__btn"
                  onClick={() => {
                    setPane(null);
                    setDraft('');
                    setStatus(null);
                  }}
                >
                  CANCEL
                </button>
              </div>
            ) : null}

            {status ? (
              <div
                className="jv-transfer__status"
                style={{ '--jv-tone': statusTone } as React.CSSProperties}
                role="status"
              >
                <span className="jv-transfer__message">{status.message}</span>
                {status.warnings.length ? (
                  <ul className="jv-transfer__warnings">
                    {status.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="jv-studio__foot">
        <span className="jv-studio__note">
          Appearance only. Nothing here touches adapters or data.
        </span>
        <button
          type="button"
          className="jv-studio__btn jv-studio__btn--danger"
          onClick={() => store.reset()}
        >
          RESET ALL
        </button>
      </footer>
    </aside>
  );
});
