import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppearanceStore } from '../kernel/appearanceStore';
import { createMemoryAppearanceStorage } from '../adapters/local/memoryAppearanceStorage';
import { maxPresets } from '../config/orb.config';
import type { AppearanceStore, SavedPreset } from '../contracts';

let store: AppearanceStore;
beforeEach(() => {
  store = createAppearanceStore(createMemoryAppearanceStorage());
});

describe('preset library — save', () => {
  it('starts empty', () => {
    expect(store.getPresets()).toEqual([]);
  });

  it('snapshots the current theme under a name', () => {
    store.applyPreset('crimson');
    store.patch({ size: 1.2 });

    const preset = store.savePreset('My crimson');

    expect(preset.label).toBe('My crimson');
    expect(preset.theme.shape).toBe('ring');
    expect(preset.theme.size).toBeCloseTo(1.2);
    expect(store.getPresets()).toHaveLength(1);
  });

  it('snapshots by value — later edits do not rewrite a saved preset', () => {
    store.patchState('idle', { color: '#111111' });
    const preset = store.savePreset('Before');

    store.patchState('idle', { color: '#222222' });

    expect(preset.theme.states.idle.color).toBe('#111111');
    expect(store.getPresets()[0].theme.states.idle.color).toBe('#111111');
    expect(store.getTheme().states.idle.color).toBe('#222222');
  });

  it('puts the newest first', () => {
    store.savePreset('First');
    store.savePreset('Second');
    expect(store.getPresets().map((p) => p.label)).toEqual(['Second', 'First']);
  });

  it('gives every preset a unique id', () => {
    const ids = Array.from({ length: 12 }, (_, i) => store.savePreset(`P${i}`).id);
    expect(new Set(ids).size).toBe(12);
  });

  it('names a blank preset rather than leaving an unclickable row', () => {
    expect(store.savePreset('   ').label).toBe('Untitled');
  });

  it('trims a very long name', () => {
    expect(store.savePreset('x'.repeat(200)).label).toHaveLength(40);
  });

  it('caps the library so storage cannot grow unbounded', () => {
    for (let i = 0; i < maxPresets + 8; i += 1) store.savePreset(`P${i}`);
    expect(store.getPresets()).toHaveLength(maxPresets);
    // The cap drops the oldest, keeping what was saved most recently.
    expect(store.getPresets()[0].label).toBe(`P${maxPresets + 7}`);
  });

  it('notifies subscribers, so the list can re-render', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    store.savePreset('One');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns a new array reference, so useSyncExternalStore sees the change', () => {
    const before = store.getPresets();
    store.savePreset('One');
    expect(store.getPresets()).not.toBe(before);
  });
});

describe('preset library — load', () => {
  it('applies a saved preset over the current theme', () => {
    store.applyPreset('void');
    store.savePreset('Void copy');
    store.applyPreset('mono');
    expect(store.getTheme().shape).toBe('minimal');

    const loaded = store.loadPreset(store.getPresets()[0].id);

    expect(loaded).toBe(true);
    expect(store.getTheme().shape).toBe('hologram');
    expect(store.getTheme().states.idle.color).toBe('#8b5cf6');
  });

  it('returns false for an unknown id and changes nothing', () => {
    const before = store.getTheme();
    expect(store.loadPreset('nope')).toBe(false);
    expect(store.getTheme()).toEqual(before);
  });

  it('repairs a preset that was tampered with in storage', () => {
    const broken = [
      {
        id: 'p1',
        label: 'Broken',
        createdAt: 1,
        updatedAt: 1,
        theme: { version: 2, shape: 'not-a-shape', glow: 999 },
      },
    ] as unknown as SavedPreset[];
    const tampered = createAppearanceStore(createMemoryAppearanceStorage(null, broken));

    tampered.loadPreset('p1');

    expect(tampered.getTheme().shape).toBe('reactor');
    expect(tampered.getTheme().glow).toBe(2);
  });
});

describe('preset library — duplicate', () => {
  it('copies a preset under a new name and id', () => {
    const original = store.savePreset('Original');
    const copy = store.duplicatePreset(original.id);

    expect(copy?.label).toBe('Original COPY');
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.theme).toEqual(original.theme);
    expect(store.getPresets()).toHaveLength(2);
  });

  it('places the copy next to its source, not at the top', () => {
    const first = store.savePreset('First');
    store.savePreset('Second');
    // Library is [Second, First]; duplicating First must land right after it.
    store.duplicatePreset(first.id);

    expect(store.getPresets().map((p) => p.label)).toEqual(['Second', 'First', 'First COPY']);
  });

  it('copies by value, so editing one does not change the other', () => {
    const original = store.savePreset('Original');
    const copy = store.duplicatePreset(original.id)!;
    copy.theme.states.idle.color = '#000000';

    expect(store.getPresets().find((p) => p.id === original.id)!.theme.states.idle.color).toBe(
      original.theme.states.idle.color,
    );
  });

  it('returns null for an unknown id', () => {
    expect(store.duplicatePreset('nope')).toBeNull();
    expect(store.getPresets()).toEqual([]);
  });
});

describe('preset library — delete', () => {
  it('removes one preset and leaves the rest', () => {
    store.savePreset('Keep me');
    const doomed = store.savePreset('Delete me');

    expect(store.deletePreset(doomed.id)).toBe(true);
    expect(store.getPresets().map((p) => p.label)).toEqual(['Keep me']);
  });

  it('returns false for an unknown id', () => {
    expect(store.deletePreset('nope')).toBe(false);
  });

  it('does not touch the live theme', () => {
    const preset = store.savePreset('One');
    const before = store.getTheme();
    store.deletePreset(preset.id);
    expect(store.getTheme()).toEqual(before);
  });
});

describe('preset library — persistence', () => {
  it('writes through on every change', () => {
    const storage = createMemoryAppearanceStorage();
    const savePresets = vi.spyOn(storage, 'savePresets');
    const s = createAppearanceStore(storage);

    const one = s.savePreset('One');
    s.duplicatePreset(one.id);
    s.deletePreset(one.id);

    expect(savePresets).toHaveBeenCalledTimes(3);
    expect(savePresets.mock.calls[2][0]).toHaveLength(1);
  });

  it('loads a library that was stored earlier', () => {
    const stored: SavedPreset[] = [
      {
        id: 'p1',
        label: 'Stored',
        createdAt: 1,
        updatedAt: 1,
        theme: { ...createAppearanceStore(createMemoryAppearanceStorage()).getTheme(), shape: 'wave' },
      },
    ];
    const s = createAppearanceStore(createMemoryAppearanceStorage(null, stored));

    expect(s.getPresets()).toHaveLength(1);
    s.loadPreset('p1');
    expect(s.getTheme().shape).toBe('wave');
  });

  it('drops unusable entries rather than rendering them', () => {
    const junk = [
      null,
      'a string',
      { label: 'no id' },
      { id: 'ok', label: 'Fine', theme: {} },
      { id: 'ok', label: 'Duplicate id', theme: {} },
    ] as unknown as SavedPreset[];

    const s = createAppearanceStore(createMemoryAppearanceStorage(null, junk));

    expect(s.getPresets()).toHaveLength(1);
    expect(s.getPresets()[0].label).toBe('Fine');
  });

  it('survives a library that is not an array at all', () => {
    const s = createAppearanceStore(
      createMemoryAppearanceStorage(null, { nope: true } as unknown as SavedPreset[]),
    );
    expect(s.getPresets()).toEqual([]);
  });
});
