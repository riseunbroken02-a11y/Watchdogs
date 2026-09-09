import { useCallback, useRef, useState } from 'react';
import { CoreStage } from './core/CoreStage';
import { AiStatusPanel } from './components/AiStatusPanel';
import { ActivityLog, CommandCenter } from './components/CommandCenter';
import { DemoDataNotice } from './components/DemoDataNotice';
import { Panel } from './components/Panel';
import { ShapeSelector } from './components/ShapeSelector';
import { StateSelector } from './components/StateSelector';
import { StatusBadge } from './components/StatusBadge';
import { SystemStatusPanel } from './components/SystemStatusPanel';
import { defaultShape, identity } from './config/jarvis.config';
import { useClock } from './hooks/useClock';
import { useCoreState } from './hooks/useCoreState';
import { useTelemetry } from './hooks/useTelemetry';
import { useThemeVars } from './hooks/useThemeVars';
import { runCommand } from './services/commands';
import type { CoreShapeId, LogEntry } from './types';
import './App.css';

const MAX_LOG = 40;

export default function App() {
  const [shape, setShape] = useState<CoreShapeId>(defaultShape);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const logId = useRef(0);

  const core = useCoreState('idle');
  const telemetry = useTelemetry();
  const clock = useClock();

  useThemeVars(core.state);

  const pushLog = useCallback((entry: Omit<LogEntry, 'id' | 'time'>) => {
    logId.current += 1;
    const next: LogEntry = {
      ...entry,
      id: `log-${logId.current}`,
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    };
    setLog((prev) => [next, ...prev].slice(0, MAX_LOG));
  }, []);

  /** Phase 1: this only animates the core. Nothing is executed. */
  const handleCommand = useCallback(
    async (value: string) => {
      setBusy(true);
      core.setBusy(true);
      try {
        await runCommand(value, {
          onState: (next) => {
            core.setState(next);
          },
          onLog: pushLog,
        });
      } finally {
        core.setBusy(false);
        setBusy(false);
      }
    },
    [core, pushLog],
  );

  return (
    <div className="jv-app">
      <header className="jv-header">
        <div className="jv-header__brand">
          <span className="jv-header__name">{identity.name}</span>
          <span className="jv-header__subtitle">{identity.subtitle}</span>
        </div>

        <StatusBadge label={`${identity.name} ONLINE`} />

        <div className="jv-header__right">
          <div className="jv-header__meta">
            <span className="jv-header__build">{identity.build}</span>
            <span>{clock.date}</span>
          </div>
          <span className="jv-header__clock">{clock.time}</span>
        </div>
      </header>

      <main className="jv-main">
        {/* ---------------------------------------------------- left column */}
        <div className="jv-col jv-col--left">
          <Panel title="Core Shape" aside={shape.toUpperCase()}>
            <ShapeSelector active={shape} onSelect={setShape} />
          </Panel>

          <Panel title="Core State" aside={busy ? 'LOCKED' : 'MANUAL'}>
            <StateSelector
              active={core.state}
              onSelect={(next) => core.requestState(next)}
              locked={busy}
            />
          </Panel>
        </div>

        {/* -------------------------------------------------- center: core */}
        <div className="jv-center">
          <CoreStage shape={shape} state={core.state} intensity={core.intensity} />
        </div>

        {/* --------------------------------------------------- right column */}
        <div className="jv-col jv-col--right">
          <SystemStatusPanel metrics={telemetry.system} isMock={telemetry.isMock} />
          <AiStatusPanel modules={telemetry.modules} isMock={telemetry.isMock} />
          <DemoDataNotice />
        </div>
      </main>

      {/* -------------------------------------------------------- footer */}
      <footer className="jv-footer">
        <div className="jv-footer__log">
          <div className="jv-footer__log-head">
            <span className="jv-label">Activity Log</span>
            <span className="jv-label">{log.length ? `${log.length} entries` : 'standby'}</span>
          </div>
          <ActivityLog entries={log} />
        </div>
        <CommandCenter onSubmit={handleCommand} busy={busy} state={core.state} />
      </footer>
    </div>
  );
}
