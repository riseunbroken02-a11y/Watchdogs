/**
 * The ONE place in this application that touches the network.
 *
 * Everything else — every adapter, every registry, every panel — goes through
 * here, which is what makes the safety scan in `src/__tests__/safety.test.ts`
 * meaningful: `fetch` is permitted in this file and forbidden everywhere else.
 *
 * Properties this client guarantees:
 *   - never throws; every failure comes back as a typed result
 *   - always times out, so a hung endpoint cannot freeze the HUD
 *   - sends a credential only when a provider supplies one
 *   - never logs or returns a credential
 *   - only ever issues the methods an adapter explicitly asks for
 */

import type { CredentialProvider, ProbeResult } from '../../contracts';

export interface HttpResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Populated when ok is false. Never contains a credential. */
  error: string;
  latencyMs: number;
}

export interface HttpClientOptions {
  /** Base URL. Empty disables the client entirely. */
  baseUrl: string;
  timeoutMs: number;
  /** Integration id, used to look a token up. */
  integrationId: string;
  credentials?: CredentialProvider;
}

/** Strips any userinfo or query string before a URL is shown or logged. */
export function redactUrl(raw: string): string {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.username = '';
    url.password = '';
    url.search = '';
    return url.toString();
  } catch {
    return raw.split('?')[0];
  }
}

export interface HttpClient {
  readonly configured: boolean;
  readonly baseUrl: string;
  get<T>(path: string, params?: Record<string, string>): Promise<HttpResult<T>>;
  post<T>(path: string, body: unknown): Promise<HttpResult<T>>;
  /** GET on the health path, reduced to ok/latency/reason. */
  probe(healthPath: string, timeoutMs: number): Promise<ProbeResult>;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const base = options.baseUrl.replace(/\/+$/, '');
  const configured = base.length > 0;

  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    init: { params?: Record<string, string>; body?: unknown; timeoutMs?: number } = {},
  ): Promise<HttpResult<T>> {
    const startedAt = Date.now();
    if (!configured) {
      return { ok: false, status: 0, data: null, error: 'No endpoint configured', latencyMs: 0 };
    }

    let url: string;
    try {
      const built = new URL(base + path);
      Object.entries(init.params ?? {}).forEach(([k, v]) => built.searchParams.set(k, v));
      url = built.toString();
    } catch {
      return { ok: false, status: 0, data: null, error: 'Invalid endpoint URL', latencyMs: 0 };
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    if (init.body !== undefined) headers['content-type'] = 'application/json';

    // A token is attached only when a provider hands one over. There is no
    // fallback to config, source or environment.
    const token = await options.credentials?.getToken(options.integrationId).catch(() => undefined);
    if (token) headers.authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? options.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        // Never attach ambient cookies: an adapter authenticates explicitly or
        // not at all.
        credentials: 'omit',
        mode: 'cors',
      });

      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data: null,
          error: `HTTP ${response.status} ${response.statusText}`.trim(),
          latencyMs,
        };
      }

      const text = await response.text();
      if (!text) return { ok: true, status: response.status, data: null, error: '', latencyMs };

      try {
        return {
          ok: true,
          status: response.status,
          data: JSON.parse(text) as T,
          error: '',
          latencyMs,
        };
      } catch {
        return {
          ok: false,
          status: response.status,
          data: null,
          error: 'Response was not valid JSON',
          latencyMs,
        };
      }
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      return {
        ok: false,
        status: 0,
        data: null,
        // The message is deliberately generic: a thrown network error can echo
        // the request URL, which may carry userinfo.
        error: aborted ? 'Timed out' : 'Endpoint unreachable',
        latencyMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    configured,
    baseUrl: redactUrl(base),
    get: (path, params) => request('GET', path, { params }),
    post: (path, body) => request('POST', path, { body }),
    async probe(healthPath, timeoutMs) {
      if (!configured) {
        return { ok: false, latencyMs: null, reason: 'No endpoint configured' };
      }
      const result = await request('GET', healthPath, { timeoutMs });
      return result.ok
        ? { ok: true, latencyMs: result.latencyMs, reason: '' }
        : { ok: false, latencyMs: result.latencyMs, reason: result.error };
    },
  };
}
