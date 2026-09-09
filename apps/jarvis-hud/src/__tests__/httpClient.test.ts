import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient, redactUrl } from '../adapters/live/httpClient';

/** Replaces global fetch for one test. */
function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

const client = (baseUrl: string, credentials?: { getToken: () => Promise<string | undefined> }) =>
  createHttpClient({ baseUrl, timeoutMs: 500, integrationId: 'memory', credentials });

describe('http client — the one network chokepoint', () => {
  it('is inert without an endpoint and issues no request', async () => {
    const spy = stubFetch(() => json({}));
    const http = client('');

    expect(http.configured).toBe(false);
    const result = await http.get('/anything');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('No endpoint configured');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns parsed JSON on success', async () => {
    stubFetch(() => json({ records: [{ id: 'a' }] }));
    const result = await client('http://127.0.0.1:9/').get<{ records: unknown[] }>('/memory/search');

    expect(result.ok).toBe(true);
    expect(result.data?.records).toHaveLength(1);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('appends query params without losing the base path', async () => {
    const spy = stubFetch(() => json({}));
    await client('http://127.0.0.1:9').get('/memory/search', { q: 'phase 4', limit: '5' });

    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/memory/search');
    expect(url.searchParams.get('q')).toBe('phase 4');
    expect(url.searchParams.get('limit')).toBe('5');
  });

  it('never sends ambient cookies', async () => {
    const spy = stubFetch(() => json({}));
    await client('http://127.0.0.1:9').get('/x');
    expect((spy.mock.calls[0][1] as RequestInit).credentials).toBe('omit');
  });

  it('sends no authorization header when no provider is injected', async () => {
    const spy = stubFetch(() => json({}));
    await client('http://127.0.0.1:9').get('/x');

    const headers = (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('sends a bearer token only when the provider supplies one', async () => {
    const spy = stubFetch(() => json({}));
    await client('http://127.0.0.1:9', { getToken: async () => 'tok_abc' }).get('/x');

    const headers = (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok_abc');
  });

  it('survives a provider that throws, rather than failing the request', async () => {
    const spy = stubFetch(() => json({ ok: true }));
    const result = await client('http://127.0.0.1:9', {
      getToken: async () => {
        throw new Error('vault unreachable');
      },
    }).get('/x');

    expect(result.ok).toBe(true);
    const headers = (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('reports HTTP errors without throwing', async () => {
    stubFetch(() => json({ error: 'nope' }, 503));
    const result = await client('http://127.0.0.1:9').get('/x');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.error).toContain('503');
  });

  it('reports a network failure as unreachable, without echoing the URL', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch http://user:secret@host/x');
    });
    const result = await client('http://127.0.0.1:9').get('/x');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Endpoint unreachable');
    expect(result.error).not.toContain('secret');
  });

  it('times out instead of hanging', async () => {
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const result = await createHttpClient({
      baseUrl: 'http://127.0.0.1:9',
      timeoutMs: 30,
      integrationId: 'memory',
    }).get('/slow');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Timed out');
  });

  it('reports malformed JSON rather than crashing', async () => {
    stubFetch(() => new Response('not json', { status: 200 }));
    const result = await client('http://127.0.0.1:9').get('/x');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not valid JSON/);
  });

  it('probe() reduces the health call to ok / latency / reason', async () => {
    stubFetch(() => json({ status: 'ok' }));
    const good = await client('http://127.0.0.1:9').probe('/health', 100);
    expect(good.ok).toBe(true);

    stubFetch(() => json({}, 500));
    const bad = await client('http://127.0.0.1:9').probe('/health', 100);
    expect(bad.ok).toBe(false);
    expect(bad.reason).toContain('500');
  });

  it('redacts credentials and query strings from any URL it exposes', () => {
    expect(redactUrl('http://user:hunter2@127.0.0.1:8787/api?token=abc')).not.toContain('hunter2');
    expect(redactUrl('http://user:hunter2@127.0.0.1:8787/api?token=abc')).not.toContain('abc');
    expect(client('http://user:hunter2@127.0.0.1:9').baseUrl).not.toContain('hunter2');
  });
});
