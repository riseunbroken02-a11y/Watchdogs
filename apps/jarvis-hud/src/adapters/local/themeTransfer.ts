/**
 * The ONE place in this application that reaches the clipboard, the download
 * folder or a file the operator picked.
 *
 * Same pattern as the network client and browser storage: one chokepoint, so
 * `src/__tests__/safety.test.ts` can assert that nothing else in the app moves
 * data in or out of the page.
 *
 * WHAT MOVES: an orb theme — shape, size, glow, speed, gradient, motion and six
 * colours. Nothing else is ever serialised, and every one of these actions is
 * started by the operator clicking a button.
 *
 * Every call is wrapped. A denied clipboard permission, a blocked download or
 * an unreadable file must cost the operator a copy, never the interface.
 */

import type { ThemeTransfer } from '../../contracts';

export function createThemeTransfer(): ThemeTransfer {
  return {
    get canCopy() {
      // Clipboard writes need a secure context; 127.0.0.1 counts as one, but a
      // plain-http LAN address does not, so this is worth checking.
      try {
        return typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';
      } catch {
        return false;
      }
    },

    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Permission denied, no secure context, or no clipboard at all. The
        // studio falls back to showing the JSON for manual selection.
        return false;
      }
    },

    download(filename, text) {
      let url: string | null = null;
      try {
        const blob = new Blob([text], { type: 'application/json' });
        url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        // Kept out of the document flow: this is a mechanism, not UI.
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return true;
      } catch {
        return false;
      } finally {
        // Always released, including when the click threw, so the blob does not
        // sit in memory for the life of the session.
        if (url) URL.revokeObjectURL(url);
      }
    },

    async readFile(file) {
      try {
        const text = await file.text();
        return { ok: true, text, error: '' };
      } catch {
        return { ok: false, text: '', error: 'That file could not be read.' };
      }
    },
  };
}
