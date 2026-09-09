import './StatusPanels.css';

/** The ● JARVIS ONLINE pill in the header. */
export function StatusBadge({ label }: { label: string }) {
  return (
    <div className="jv-online">
      <span className="jv-online__pip" />
      <span className="jv-online__text">{label}</span>
    </div>
  );
}
