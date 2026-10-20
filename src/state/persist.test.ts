import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../boot';
import { KEY, OLD_KEY, loadSaved, startAutosave } from './persist';
import { currentFrame, resetEditorStore, useEditor } from './store';
import { newCharacter } from '../rig/renderCharacter';

beforeEach(() => { resetEditorStore(); localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;

describe('autosave', () => {
  it('writes once, 500 ms after the last change', () => {
    const a = startAutosave(useEditor);
    useEditor.getState().setNote('a'); vi.advanceTimersByTime(300);
    useEditor.getState().setNote('ab'); vi.advanceTimersByTime(300);
    expect(stored()).toBeNull();                                  // still waiting
    vi.advanceTimersByTime(250);
    expect(stored()).toMatchObject({ version: 1, name: 'Untitled storyboard', fi: 0 });
    expect(JSON.stringify(stored())).toContain('"note":"ab"');
    a.stop();
  });
  it('ignores state that is not saved (selection, tab, search)', () => {
    const a = startAutosave(useEditor);
    useEditor.getState().select('x'); useEditor.getState().setTab('pose'); useEditor.getState().setQuery('q');
    vi.advanceTimersByTime(1000);
    expect(stored()).toBeNull();
    a.stop();
  });
  it('flushes pending changes when the page is hidden', () => {
    const a = startAutosave(useEditor);
    useEditor.getState().setNote('late');
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.stringify(stored())).toContain('late');
    a.stop();
  });
  it('stops listening after stop()', () => {
    const a = startAutosave(useEditor); a.stop();
    useEditor.getState().setNote('x'); vi.advanceTimersByTime(1000);
    expect(stored()).toBeNull();
  });
  it('never throws when storage is blocked, and warns once', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    const a = startAutosave(useEditor);
    expect(() => { useEditor.getState().setNote('a'); vi.advanceTimersByTime(600); }).not.toThrow();
    const first = useEditor.getState().toast;
    expect(first?.msg).toMatch(/Autosave is unavailable/);
    useEditor.getState().setNote('b'); vi.advanceTimersByTime(600);
    expect(useEditor.getState().toast?.id).toBe(first?.id);       // not repeated
    a.stop();
  });
});

describe('loading', () => {
  it('round trips what autosave wrote', () => {
    const a = startAutosave(useEditor);
    useEditor.getState().setName('Saved'); useEditor.getState().addFrame(); vi.advanceTimersByTime(600);
    a.stop();
    const s = loadSaved();
    expect(s).toMatchObject({ name: 'Saved', fi: 1 }); expect(s?.frames).toHaveLength(2);
  });
  it('reads the prototype format (type/kind items) and its old key', () => {
    const legacy = { frames: [{ id: 'f', bg: '#e7f3fd', scene: 'park', note: 'old', items: [{ ...newCharacter({ id: 'c' }), kind: undefined, type: 'char' }] }], fi: 0 };
    localStorage.setItem(OLD_KEY, JSON.stringify(legacy));
    const s = loadSaved();
    expect(s?.frames[0].items[0]).toMatchObject({ kind: 'char', id: 'c' });
    expect(s?.frames[0].scene).toBe('park');
  });
  it('validates stored data: unknown parts fall back, junk is ignored', () => {
    const p = { version: 1, name: 'x', aspect: '16:9', fi: 99, frames: [{ id: 'f', items: [{ ...newCharacter({ id: 'c' }), hair: 'ghost' }] }] };
    localStorage.setItem(KEY, JSON.stringify(p));
    const s = loadSaved();
    expect(s?.frames[0].items[0]).toMatchObject({ hair: 'none' }); expect(s?.fi).toBe(0);
    for (const junk of ['nope', '[]', '{"version":1,"frames":[]}', '{"version":9,"frames":[{}]}', '{"frames":"x"}', 'null']) {
      localStorage.setItem(KEY, junk); expect(loadSaved(), junk).toBeNull();
    }
  });
  it('returns null when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(loadSaved()).toBeNull();
  });
});

describe('boot', () => {
  it('restores the saved session into the store', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, name: 'Back', aspect: '16:9', fi: 0, frames: [{ id: 'f', bg: '#ffffff', scene: 'none', note: 'n', items: [] }] }));
    const c = boot(useEditor);
    expect(useEditor.getState().name).toBe('Back'); expect(currentFrame(useEditor.getState()).note).toBe('n');
    c.stop();
  });
  it('starts with the seed when nothing is saved, or storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    const c = boot(useEditor);
    expect(currentFrame(useEditor.getState()).items).toHaveLength(4);
    c.stop();
  });
});
