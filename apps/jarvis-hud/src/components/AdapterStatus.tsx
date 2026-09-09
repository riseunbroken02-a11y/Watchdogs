import { memo } from 'react';
import { palette } from '../config/jarvis.config';
import type { BindingState } from '../contracts';
import { useJarvis } from '../state/useJarvis';
import './AdapterStatus.css';

const TONE: Record<BindingState, string> = {
  live: palette.success,
  mock: palette.warning,
  failed: palette.danger,
};

const LABEL: Record<BindingState, string> = {
  live: 'LIVE',
  mock: 'MOCK',
  failed: 'FAILED',
};

/**
 * ADAPTERS — what each subsystem actually resolved to, and why.
 *
 * This replaces the phase-3 "MOCK DATA" banner. A blanket claim that
 * everything is simulated stops being true the moment one integration goes
 * live, so the HUD states it per subsystem instead.
 */
export const AdapterStatus = memo(function AdapterStatus() {
  const { bindings } = useJarvis();
  const live = bindings.filter((b) => b.state === 'live').length;
  const allMock = live === 0 && !bindings.some((b) => b.state === 'failed');

  return (
    <div className={`jv-adapters ${allMock ? 'jv-adapters--all-mock' : ''}`}>
      <div className="jv-adapters__head">
        <span className="jv-adapters__title">ADAPTERS</span>
        <span className="jv-adapters__summary">
          {live}/{bindings.length} LIVE
        </span>
      </div>

      {bindings.map((binding) => (
        <div
          key={binding.id}
          className={`jv-adapter jv-adapter--${binding.state}`}
          style={{ '--jv-tone': TONE[binding.state] } as React.CSSProperties}
          title={
            binding.state === 'live'
              ? `${binding.label}: live via ${binding.adapter} at ${binding.endpoint} (${binding.latencyMs ?? '?'} ms)`
              : `${binding.label}: ${binding.reason}. Serving the mock adapter.`
          }
        >
          <span className="jv-adapter__dot" />
          <span className="jv-adapters__row">
            <span className="jv-adapter__label">{binding.label.toUpperCase()}</span>
            <span className="jv-adapter__reason">
              {binding.state === 'live' ? binding.adapter : binding.reason}
            </span>
          </span>
          <span className="jv-adapter__state">{LABEL[binding.state]}</span>
        </div>
      ))}

      {allMock ? (
        <p className="jv-adapters__foot">
          Every value is simulated. Nothing is monitored, opened or executed.
        </p>
      ) : null}
    </div>
  );
});
