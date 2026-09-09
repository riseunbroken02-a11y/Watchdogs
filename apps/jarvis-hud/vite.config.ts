import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local-only dev server for the JARVIS HUD.
// Nothing here talks to AIVM-BRAIN / OpenClaw yet — phase 1 is visual only.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
