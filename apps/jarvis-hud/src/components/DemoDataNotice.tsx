import './StatusPanels.css';

/**
 * Always-visible reminder that phase 1 shows simulated values only.
 * Remove (or hide via config) once a real telemetry source is connected.
 */
export function DemoDataNotice() {
  return (
    <div className="jv-demo">
      <span className="jv-demo__tag">DEMO DATA</span>
      <p className="jv-demo__text">
        All readings are simulated. No system is monitored and no command is
        executed in phase 1.
      </p>
    </div>
  );
}
