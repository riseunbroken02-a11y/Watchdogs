import './StatusPanels.css';

/**
 * Always-visible reminder that every reading in the HUD is simulated.
 * Remove (or hide via config) once a real backend is connected.
 */
export function DemoDataNotice() {
  return (
    <div className="jv-demo">
      <span className="jv-demo__tag">MOCK DATA</span>
      <p className="jv-demo__text">
        Every value in this HUD is simulated. No system is monitored, no command
        is executed, no connector is opened and the microphone is never
        requested.
      </p>
    </div>
  );
}
