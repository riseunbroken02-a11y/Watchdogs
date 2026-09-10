import { useState } from 'react';
import { AdapterStatus } from './components/AdapterStatus';
import { AgentsPanel } from './components/AgentsPanel';
import { ApprovalDialog } from './components/ApprovalDialog';
import { CommandCenter } from './components/CommandCenter';
import { ConnectorsPanel } from './components/ConnectorsPanel';
import { CoreControlBar } from './components/CoreControlBar';
import { EventStreamPanel } from './components/EventStreamPanel';
import { MemoryPanel } from './components/MemoryPanel';
import { OrbStudio } from './components/OrbStudio';
import { StatusBadge } from './components/StatusBadge';
import { SystemPanel } from './components/SystemPanel';
import { identity } from './config/jarvis.config';
import { CoreStage } from './core/CoreStage';
import { useClock } from './hooks/useClock';
import { useThemeVars } from './hooks/useThemeVars';
import { AppearanceProvider } from './state/AppearanceProvider';
import { JarvisProvider } from './state/JarvisProvider';
import { useRuntime } from './state/jarvisContext';
import { useAppearance, useAppearanceStore } from './state/useAppearance';
import { useJarvis } from './state/useJarvis';
import './App.css';

/**
 * HUD shell.
 *
 * Left  — system status cards and the agent registry.
 * Centre— the core, its control bar, and the activity log.
 * Right — memory and connectors.
 * Bottom— voice + command center, full width.
 *
 * The shell holds one piece of local state (which shape is drawn). Everything
 * else is read from the kernel through useJarvis().
 */
function Hud() {
  const runtime = useRuntime();
  const appearance = useAppearanceStore();
  const theme = useAppearance();
  const { coreState, busy } = useJarvis();
  const clock = useClock();
  const [studioOpen, setStudioOpen] = useState(false);

  // The theme owns the shape now, so the choice survives a reload.
  useThemeVars(coreState, theme);

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
          <SystemPanel />
          <AgentsPanel />
        </div>

        <div className="jv-center">
          <CoreStage shape={theme.shape} state={coreState} />
          <CoreControlBar
            shape={theme.shape}
            onShape={(shape) => appearance.patch({ shape })}
            state={coreState}
            onState={runtime.forceCoreState}
            locked={busy}
            studioOpen={studioOpen}
            onToggleStudio={() => setStudioOpen((open) => !open)}
          />
          <EventStreamPanel />
        </div>

        <div className="jv-col jv-col--right">
          <MemoryPanel />
          <ConnectorsPanel />
          <AdapterStatus />
        </div>
      </main>

      <footer className="jv-footer">
        <CommandCenter />
      </footer>

      <ApprovalDialog />

      <OrbStudio
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        coreState={coreState}
        onPreviewState={runtime.forceCoreState}
        canPreview={!busy}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppearanceProvider>
      <JarvisProvider>
        <Hud />
      </JarvisProvider>
    </AppearanceProvider>
  );
}
