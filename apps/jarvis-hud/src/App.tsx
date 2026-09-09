import { useState } from 'react';
import { AgentsPanel } from './components/AgentsPanel';
import { CommandCenter } from './components/CommandCenter';
import { ConnectorsPanel } from './components/ConnectorsPanel';
import { CoreControlBar } from './components/CoreControlBar';
import { DemoDataNotice } from './components/DemoDataNotice';
import { EventStreamPanel } from './components/EventStreamPanel';
import { MemoryPanel } from './components/MemoryPanel';
import { StatusBadge } from './components/StatusBadge';
import { SystemStatusPanel } from './components/SystemStatusPanel';
import { defaultShape, identity } from './config/jarvis.config';
import { CoreStage } from './core/CoreStage';
import { useClock } from './hooks/useClock';
import { useThemeVars } from './hooks/useThemeVars';
import { JarvisProvider } from './state/JarvisProvider';
import { useJarvis } from './state/jarvisContext';
import type { CoreShapeId } from './types';
import './App.css';

/**
 * HUD shell.
 *
 * Left  — system status (machine + services) and the agent roster.
 * Centre— the core, its control bar, and the activity stream.
 * Right — memory and connectors.
 * Bottom— voice + command center, full width.
 */
function Hud() {
  const [shape, setShape] = useState<CoreShapeId>(defaultShape);
  const { core, busy } = useJarvis();
  const clock = useClock();

  useThemeVars(core.state);

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
        <div className="jv-col jv-col--left">
          <SystemStatusPanel />
          <AgentsPanel />
        </div>

        <div className="jv-center">
          <CoreStage shape={shape} state={core.state} />
          <CoreControlBar
            shape={shape}
            onShape={setShape}
            state={core.state}
            onState={core.requestState}
            locked={busy}
          />
          <EventStreamPanel />
        </div>

        <div className="jv-col jv-col--right">
          <MemoryPanel />
          <ConnectorsPanel />
          <DemoDataNotice />
        </div>
      </main>

      <footer className="jv-footer">
        <CommandCenter />
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <JarvisProvider>
      <Hud />
    </JarvisProvider>
  );
}
