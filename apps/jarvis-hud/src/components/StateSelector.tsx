import { stateColors, stateMeta } from '../config/jarvis.config';
import type { CoreState } from '../types';
import './StateSelector.css';

const STATES: CoreState[] = ['idle', 'listening', 'thinking', 'working', 'success', 'error'];

interface StateSelectorProps {
  active: CoreState;
  onSelect: (state: CoreState) => void;
  /** True while a simulated command owns the state machine. */
  locked: boolean;
}

/** Manual override for previewing every core state. */
export function StateSelector({ active, onSelect, locked }: StateSelectorProps) {
  return (
    <div className="jv-states" role="group" aria-label="Core state">
      {STATES.map((s) => (
        <button
          key={s}
          type="button"
          className="jv-state-btn"
          style={{ '--jv-tone': stateColors[s] } as React.CSSProperties}
          aria-pressed={active === s}
          disabled={locked}
          onClick={() => onSelect(s)}
          title={stateMeta[s].hint}
        >
          {stateMeta[s].label}
        </button>
      ))}
    </div>
  );
}
