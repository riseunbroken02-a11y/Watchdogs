import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalAppearanceStorage,
  storageAvailable,
} from '../adapters/local/localAppearanceStorage';
import {
  createAppearanceStorage,
  createMemoryAppearanceStorage,
} from '../adapters/local/memoryAppearanceStorage';
import { cloneDefaultTheme, storageKey } from '../config/orb.config';

/** Minimal in-process stand-in for the browser API. */
function fakeStorage(overrides: Partial<Storage> = {}) {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
    ...overrides,
  } as Storage;
}

afterEach(() => vi.unstubAllGlobals());

describe('local appearance storage — the one storage chokepoint', () => {
  it('round-trips a theme', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const storage = createLocalAppearanceStorage();
    const theme = { ...cloneDefaultTheme(), shape: 'wave' as const };

    expect(storage.save(theme)).toBe(true);
    expect(storage.load()?.shape).toBe('wave');
  });

  it('returns null when nothing is stored', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(createLocalAppearanceStorage().load()).toBeNull();
  });

  it('returns null for corrupt JSON rather than throwing', () => {
    const fake = fakeStorage();
    fake.setItem(storageKey, '{ this is not json');
    vi.stubGlobal('localStorage', fake);

    expect(createLocalAppearanceStorage().load()).toBeNull();
  });

  it('reports a failed save instead of throwing — a full quota must not break the HUD', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        setItem: () => {
          throw new DOMException('QuotaExceededError');
        },
      }),
    );

    expect(createLocalAppearanceStorage().save(cloneDefaultTheme())).toBe(false);
  });

  it('survives storage being blocked entirely', () => {
    vi.stubGlobal('localStorage', {
      get getItem(): never {
        throw new Error('storage disabled by policy');
      },
    } as unknown as Storage);

    const storage = createLocalAppearanceStorage();
    expect(storage.load()).toBeNull();
    expect(() => storage.clear()).not.toThrow();
  });

  it('storageAvailable() probes without leaving anything behind', () => {
    const fake = fakeStorage();
    vi.stubGlobal('localStorage', fake);

    expect(storageAvailable()).toBe(true);
    expect(fake.length).toBe(0);
  });

  it('storageAvailable() is false when writes throw', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        setItem: () => {
          throw new Error('nope');
        },
      }),
    );
    expect(storageAvailable()).toBe(false);
  });

  it('only ever touches its own key', () => {
    const fake = fakeStorage();
    fake.setItem('someone.elses.key', 'keep me');
    vi.stubGlobal('localStorage', fake);

    const storage = createLocalAppearanceStorage();
    storage.save(cloneDefaultTheme());
    storage.clear();

    expect(fake.getItem('someone.elses.key')).toBe('keep me');
    expect(fake.getItem(storageKey)).toBeNull();
  });

  it('stores appearance only — no ids, no history, no credentials', () => {
    const fake = fakeStorage();
    vi.stubGlobal('localStorage', fake);
    createLocalAppearanceStorage().save(cloneDefaultTheme());

    const written = JSON.parse(fake.getItem(storageKey)!);
    expect(Object.keys(written).sort()).toEqual([
      'gradient',
      'gradientDepth',
      'gradientEnabled',
      'glow',
      'motion',
      'opacity',
      'shape',
      'size',
      'speed',
      'states',
      'version',
    ].sort());
  });
});

describe('memory fallback', () => {
  it('keeps a theme for the session but reports itself as not durable', () => {
    const storage = createMemoryAppearanceStorage();
    expect(storage.persistent).toBe(false);
    expect(storage.save(cloneDefaultTheme())).toBe(false);
    expect(storage.load()).not.toBeNull();
  });

  it('createAppearanceStorage picks memory when the browser refuses', () => {
    expect(createAppearanceStorage(false, createLocalAppearanceStorage).id).toBe('memory');
    vi.stubGlobal('localStorage', fakeStorage());
    expect(createAppearanceStorage(true, createLocalAppearanceStorage).id).toBe('local');
  });
});
