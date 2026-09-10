import { afterEach, describe, expect, it, vi } from 'vitest';
import { createThemeTransfer } from '../adapters/local/themeTransfer';

afterEach(() => vi.unstubAllGlobals());

describe('theme transfer — the clipboard / download / file chokepoint', () => {
  it('copies to the clipboard when the browser allows it', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const transfer = createThemeTransfer();
    expect(transfer.canCopy).toBe(true);
    expect(await transfer.copy('{"a":1}')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('{"a":1}');
  });

  it('reports a refused clipboard instead of throwing, so the studio can fall back', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async () => {
          throw new DOMException('Write permission denied.', 'NotAllowedError');
        },
      },
    });

    expect(await createThemeTransfer().copy('x')).toBe(false);
  });

  it('knows when there is no clipboard at all', () => {
    vi.stubGlobal('navigator', {});
    expect(createThemeTransfer().canCopy).toBe(false);
  });

  it('downloads via an object URL and always releases it', () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const link = { href: '', download: '', style: {}, click, remove } as unknown as HTMLAnchorElement;

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('Blob', class { constructor(public parts: unknown[], public opts: unknown) {} });
    vi.stubGlobal('document', {
      createElement: () => link,
      body: { appendChild: vi.fn() },
    });

    expect(createThemeTransfer().download('theme.json', '{"a":1}')).toBe(true);
    expect(link.download).toBe('theme.json');
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('releases the object URL even when the click throws', () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL });
    vi.stubGlobal('Blob', class {});
    vi.stubGlobal('document', {
      createElement: () => ({
        style: {},
        click: () => {
          throw new Error('blocked');
        },
        remove: vi.fn(),
      }),
      body: { appendChild: vi.fn() },
    });

    expect(createThemeTransfer().download('theme.json', '{}')).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('reports a blocked download rather than throwing', () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => {
        throw new Error('blocked by policy');
      },
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('Blob', class {});

    expect(createThemeTransfer().download('theme.json', '{}')).toBe(false);
  });

  it('reads a picked file', async () => {
    const file = { text: async () => '{"ok":true}' } as File;
    expect(await createThemeTransfer().readFile(file)).toEqual({
      ok: true,
      text: '{"ok":true}',
      error: '',
    });
  });

  it('reports an unreadable file rather than throwing', async () => {
    const file = {
      text: async () => {
        throw new DOMException('NotReadableError');
      },
    } as unknown as File;

    const result = await createThemeTransfer().readFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not be read/);
  });
});
