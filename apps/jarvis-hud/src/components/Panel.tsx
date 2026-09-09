import type { ReactNode } from 'react';
import './Panel.css';

interface PanelProps {
  title: string;
  /** Small monospace note on the right of the header. */
  aside?: ReactNode;
  /** Interactive controls rendered in the header, left of the aside. */
  actions?: ReactNode;
  /** Rendered between the header and the scrolling body (search fields etc). */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Removes body padding for edge-to-edge lists. */
  flush?: boolean;
}

/** Glass HUD panel with a clipped corner. Used for every module in the HUD. */
export function Panel({ title, aside, actions, toolbar, children, className, flush }: PanelProps) {
  return (
    <section className={`jv-panel ${className ?? ''}`}>
      <header className="jv-panel__head">
        <h2 className="jv-panel__title">{title}</h2>
        <div className="jv-panel__head-right">
          {actions}
          {aside ? <span className="jv-panel__aside">{aside}</span> : null}
        </div>
      </header>
      {toolbar ? <div className="jv-panel__toolbar">{toolbar}</div> : null}
      <div className={`jv-panel__body ${flush ? 'jv-panel__body--flush' : ''}`}>{children}</div>
    </section>
  );
}
