/**
 * Credential provider.
 *
 * The shipped provider returns nothing, on purpose.
 *
 * This bundle runs in a browser: anything baked into it is readable by anyone
 * who opens the page, and anything committed here is readable by anyone with
 * the repository. So there is no key, no token and no environment read in this
 * file — and a test enforces that.
 *
 * To use authenticated live adapters, a host injects its own provider:
 *
 *   createLiveRuntime({
 *     credentials: {
 *       // Fetches a short-lived token from YOUR backend, which holds the
 *       // real secret. The browser never sees the long-lived credential.
 *       async getToken(id) {
 *         const res = await myBackend.mintToken(id);
 *         return res.token;
 *       },
 *     },
 *   });
 *
 * Until then the live adapters only work against an endpoint that needs no
 * authentication — a local AIVM-BRAIN or OpenClaw on the loopback interface.
 */

import type { CredentialProvider } from '../../contracts';

/** Supplies no credentials. The default. */
export const nullCredentials: CredentialProvider = {
  async getToken() {
    return undefined;
  },
};
