import type { ReactNode } from 'react';
import './Panel.css';

interface PanelProps {
  title: string;
  /** Small monospace note on the right of the header. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Glass HUD panel with a clipped corner. Used for every side/bottom module. */
export function Panel({ title, aside, children, className }: PanelProps) {
  return (
    <section className={`jv-panel ${className ?? ''}`}>
      <header className="jv-panel__head">
        <h2 className="jv-panel__title">{title}</h2>
        {aside ? <span className="jv-panel__aside">{aside}</span> : null}
      </header>
      <div className="jv-panel__body">{children}</div>
    </section>
  );
}
