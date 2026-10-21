/* UI smoke test: the port of tools/smoke.js, plus export, save and open. It drives the real React tree in jsdom.
   jsdom has no canvas, so PNG encoding is checked in a real browser, not here. */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import * as frameModule from './export/frame';
import { resetEditorStore, currentFrame, selectedIds, selectedItem, useEditor } from './state/store';
import type { Character, Item } from './types';
import { HAIR } from './parts';
import { PROJECT_VERSION } from './export/project';

const st = () => useEditor.getState();
const errors: string[] = [];
const downloads: Array<{ name: string; blob: Blob | undefined }> = [];
const blobs = new Map<string, Blob>();

beforeEach(() => {
  resetEditorStore(); errors.length = 0; downloads.length = 0; blobs.clear();
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errors.push(a.map(String).join(' ')); });
  URL.createObjectURL = (b: Blob | MediaSource) => { const u = 'blob:test/' + blobs.size; blobs.set(u, b as Blob); return u; };
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push({ name: this.download, blob: blobs.get(this.href) }); });
});
afterEach(() => { expect(errors, 'console errors').toEqual([]); });

const readBlob = (b: Blob): Promise<string> => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsText(b); });
const pointer = (target: Element | Window, type: string, x = 300, y = 300, extra: MouseEventInit = {}) =>
  act(() => { target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra })); });
const click = (name: string | RegExp, role: 'button' | 'tab' = 'button') => fireEvent.click(screen.getByRole(role, { name }));
const items = (): Item[] => currentFrame(st()).items;
const hits = () => [...document.querySelectorAll('#stage .item .hit')];
const selectFirstChar = () => { pointer(hits()[0], 'pointerdown'); pointer(window, 'pointerup'); };
const itemEl = (id: string) => document.querySelector(`#stage .item[data-id="${id}"]`) as SVGGElement;

describe('the editor', () => {
  it('shows the seed scene and the picker', () => {
    render(<App />);
    expect(document.querySelectorAll('#stage .item')).toHaveLength(4);
    expect(screen.getAllByRole('button', { pressed: false }).filter(b => b.getAttribute('data-sec') === 'hair')).toHaveLength(HAIR.length);
    expect(screen.getByText('Click a character on the board to dress it.')).toBeTruthy();
  });

  it('selects a character, picks a part, flips, undoes and redoes', async () => {
    render(<App />);
    selectFirstChar();
    expect(st().sel).toBe(items()[0].id);
    const toolbar = screen.getByRole('toolbar', { name: 'Selected item' });
    expect(within(toolbar).getAllByRole('button')).toHaveLength(5);
    click('Long curls');
    expect((selectedItem(st()) as Character).hair).toBe('long-curly');
    expect(screen.getByRole('button', { name: 'Long curls' }).getAttribute('aria-pressed')).toBe('true');
    click('Flip');
    expect(selectedItem(st())?.flip).toBe(true);
    click('Undo'); expect(selectedItem(st())?.flip).toBe(false);
    click('Redo'); expect(selectedItem(st())?.flip).toBe(true);
    // keyboard route: Ctrl+Z
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); expect(selectedItem(st())?.flip).toBe(false);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true }); expect(selectedItem(st())?.flip).toBe(true);
  });

  it('asks for a selection when several characters are on the board', () => {
    render(<App />);
    click('Long curls');
    expect(screen.getByRole('status').textContent).toMatch(/Click a character/);
  });

  it('pose mode shows four hand and foot handles, and a preset pose changes the arms', () => {
    render(<App />);
    selectFirstChar();
    click('Pose');
    expect(document.querySelectorAll('#stage .jh')).toHaveLength(4);
    expect(document.querySelectorAll('#stage .bh')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Pose' }).getAttribute('aria-selected')).toBe('true');
    expect(document.querySelectorAll('[data-c]')).toHaveLength(0);          // corners wait while posing
    click('Cheering');
    expect(Math.round((selectedItem(st()) as Character).pose.aL[0])).toBe(-148);
  });

  it('dragging a hand handle moves the hand with one undo step, and a click makes none', () => {
    render(<App />);
    selectFirstChar(); click('Pose');
    const before = (selectedItem(st()) as Character).pose.aR.slice(), steps = st().past.length;
    const hand = document.querySelector('#stage .jh[data-limb="aR"]') as Element;
    pointer(hand, 'pointerdown', 300, 300); pointer(window, 'pointerup', 300, 300);
    expect(st().past).toHaveLength(steps);                                   // a click is not an edit
    pointer(hand, 'pointerdown', 300, 300);
    pointer(window, 'pointermove', 310, 300); pointer(window, 'pointermove', 320, 310); pointer(window, 'pointerup', 320, 310);
    expect(st().past).toHaveLength(steps + 1);
    expect((selectedItem(st()) as Character).pose.aR).not.toEqual(before);
  });

  it('clicking the elbow dot flips the bend', () => {
    render(<App />);
    selectFirstChar(); click('Pose');
    const bend = (selectedItem(st()) as Character).pose.aL[2];
    pointer(document.querySelector('#stage .bh[data-limb="aL"]') as Element, 'pointerdown');
    expect((selectedItem(st()) as Character).pose.aL[2]).toBe(-bend);
  });

  it('moving drags the item and records one undo step only after the pointer moves', () => {
    render(<App />);
    const id = items()[0].id, x0 = items()[0].x;
    pointer(hits()[0], 'pointerdown', 300, 300); pointer(window, 'pointermove', 301, 300);
    expect(st().past).toHaveLength(0); expect(items()[0].x).toBe(x0);        // under 3px: still a click
    pointer(window, 'pointermove', 340, 320); pointer(window, 'pointermove', 360, 330); pointer(window, 'pointerup', 360, 330);
    expect(st().past).toHaveLength(1);
    expect(items()[0]).toMatchObject({ id });
    expect(items()[0].x).not.toBe(x0);
    expect(itemEl(id).getAttribute('transform')).toContain(`translate(${Math.round(items()[0].x * 10) / 10}`);
  });

  it('rotates with the handle, snaps to upright, resets on double click, and rotates with [ and ]', () => {
    render(<App />);
    selectFirstChar();
    const handle = () => document.querySelector('[title^="Rotate"]') as Element;
    pointer(handle(), 'pointerdown', 300, 100);
    pointer(window, 'pointermove', 420, 160); pointer(window, 'pointerup', 420, 160);
    const r = items()[0].r;
    expect(r).not.toBe(0);
    expect(itemEl(items()[0].id).getAttribute('transform')).toContain(`rotate(${r}`);
    fireEvent.doubleClick(handle()); expect(items()[0].r).toBe(0);
    fireEvent.keyDown(window, { code: 'BracketRight', key: ']' }); expect(items()[0].r).toBe(5);
    fireEvent.keyDown(window, { code: 'BracketLeft', key: '[', shiftKey: true }); expect(items()[0].r).toBe(-10);
    pointer(handle(), 'pointerdown', 300, 100);                              // near upright snaps to 0
    pointer(window, 'pointermove', 301, 100); pointer(window, 'pointermove', 302, 99); pointer(window, 'pointerup', 302, 99);
    expect(Math.abs(items()[0].r)).toBeLessThanOrEqual(10);
  });

  it('scales with a corner handle within limits', () => {
    render(<App />);
    selectFirstChar();
    const s0 = items()[0].s, corner = document.querySelector('[data-c="se"]') as Element;
    pointer(corner, 'pointerdown', 400, 400); pointer(window, 'pointermove', 800, 800); pointer(window, 'pointerup', 800, 800);
    expect(items()[0].s).toBeGreaterThan(s0); expect(items()[0].s).toBeLessThanOrEqual(3);
  });

  it('keyboard: arrows nudge, F flips, Delete removes, Esc deselects', () => {
    render(<App />);
    selectFirstChar();
    const x = items()[0].x, id = items()[0].id;
    fireEvent.keyDown(document.body, { key: 'ArrowRight' }); expect(items()[0].x).toBe(x + 1);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', shiftKey: true }); expect(items()[0].x).toBe(x - 9);
    fireEvent.keyDown(document.body, { key: 'ArrowDown' }); expect(items()[0].y).toBe(300 + 1);
    fireEvent.keyDown(document.body, { key: 'f' }); expect(items()[0].flip).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' }); expect(st().sel).toBeNull();
    st().select(id); fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(items().some(i => i.id === id)).toBe(false);
  });

  it('keyboard: + and - scale, Ctrl+D duplicates, Alt+] brings to front, within limits', () => {
    render(<App />);
    selectFirstChar();
    const id = items()[0].id, s0 = items()[0].s;
    fireEvent.keyDown(document.body, { key: '+' }); expect(items()[0].s).toBeCloseTo(s0 * 1.05, 5);
    fireEvent.keyDown(document.body, { key: '=' }); expect(items()[0].s).toBeCloseTo(s0 * 1.05 * 1.05, 5);
    fireEvent.keyDown(document.body, { key: '-' }); fireEvent.keyDown(document.body, { key: '-' }); expect(items()[0].s).toBeCloseTo(s0, 5);
    for (let i = 0; i < 80; i++) fireEvent.keyDown(document.body, { key: '+' });
    expect(items()[0].s).toBe(3);                                            // the same ceiling as dragging a corner
    const steps = st().past.length; fireEvent.keyDown(document.body, { key: '+' }); expect(st().past).toHaveLength(steps);   // no undo step when nothing changes
    for (let i = 0; i < 120; i++) fireEvent.keyDown(document.body, { key: '-' });
    expect(items()[0].s).toBe(0.3);
    const dup = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(dup); });
    expect(dup.defaultPrevented).toBe(true); expect(items()).toHaveLength(5); expect(st().sel).toBe(items()[4].id);
    st().select(id);
    fireEvent.keyDown(document.body, { code: 'BracketRight', key: ']', altKey: true });
    expect(items().at(-1)?.id).toBe(id); expect(items()[0].r).toBe(0);      // brought forward, and not rotated
  });

  it('typing in a field never triggers shortcuts', () => {
    render(<App />);
    selectFirstChar();
    const note = screen.getByLabelText('Scene note'), f = items()[0].flip;
    fireEvent.keyDown(note, { key: 'f' }); fireEvent.keyDown(note, { key: 'Backspace' });
    expect(items()[0].flip).toBe(f); expect(items()).toHaveLength(4);
  });

  it('Esc closes dialogs before it deselects', () => {
    render(<App />);
    selectFirstChar(); click('Export');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(st().sel).not.toBeNull();
  });
});

describe('the picker', () => {
  it('adds props, and edits speech bubble text', () => {
    render(<App />);
    click('Props', 'tab'); click('Chair');
    expect(items()).toHaveLength(5);
    click('Speech bubble');
    const text = screen.getByRole('textbox', { name: 'Bubble text' });
    fireEvent.focus(text); fireEvent.change(text, { target: { value: 'Action!' } });
    expect(selectedItem(st())).toMatchObject({ prop: 'bubble', text: 'Action!' });
    expect(document.querySelector('#stage')?.innerHTML).toContain('Action!');
  });

  it('searches across every section', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search parts' }), { target: { value: 'eyepatch' } });
    expect(document.querySelectorAll('button[data-sec]')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search parts' }), { target: { value: 'zzzz' } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search parts' }), { target: { value: 'sit' } });
    expect(screen.getAllByRole('button').some(b => b.getAttribute('data-sec') === 'pose')).toBe(true);
  });

  it('applies colours, scenes and backgrounds', () => {
    render(<App />);
    selectFirstChar(); click('Tops', 'tab');
    fireEvent.click(screen.getAllByRole('button', { name: 'Colour #ff9a4d' })[0]);
    expect((selectedItem(st()) as Character).topC).toBe('#ff9a4d');
    click('Scene', 'tab');
    expect(document.querySelectorAll('button[data-sec="scene"]')).toHaveLength(9);
    click('Park'); expect(currentFrame(st()).scene).toBe('park');
    fireEvent.click(screen.getAllByRole('button', { name: 'Colour #ffe6e2' })[0]);
    expect(currentFrame(st()).bg).toBe('#ffe6e2');
  });

  it('roving tabindex: one tab stop per grid, arrow keys move between thumbnails', () => {
    render(<App />);
    const thumbs = [...document.querySelectorAll<HTMLButtonElement>('button[data-sec="hair"]')];
    expect(thumbs.filter(t => t.tabIndex === 0)).toHaveLength(1);
    thumbs[0].focus();
    fireEvent.keyDown(thumbs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(thumbs[1]);
    fireEvent.keyDown(thumbs[1], { key: 'End' }); expect(document.activeElement).toBe(thumbs.at(-1));
    fireEvent.keyDown(thumbs.at(-1) as Element, { key: 'Home' }); expect(document.activeElement).toBe(thumbs[0]);
  });

  it('"/" focuses the search box', () => {
    render(<App />);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });
});

describe('frames', () => {
  it('adds, switches, edits the note, duplicates and deletes', () => {
    render(<App />);
    click('Add frame');
    expect(st().frames).toHaveLength(2); expect(st().fi).toBe(1);
    expect(document.querySelectorAll('#stage .item')).toHaveLength(0);
    click('Frame 1'); expect(document.querySelectorAll('#stage .item')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Frame 1' }).getAttribute('aria-current')).toBe('true');
    fireEvent.change(screen.getByLabelText('Scene note'), { target: { value: 'New note' } });
    expect(currentFrame(st()).note).toBe('New note');
    click('Duplicate'); expect(st().frames).toHaveLength(3);
    click('Delete'); expect(st().frames).toHaveLength(2);
  });
  it('the last frame cannot be deleted', () => {
    render(<App />);
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('export', () => {
  it('opens the dialog focused on the primary action, and Esc closes it', () => {
    render(<App />);
    screen.getByRole('button', { name: 'Export' }).focus();                  // a real click or Enter focuses the opener
    click('Export');
    const dialog = screen.getByRole('dialog', { name: 'Export' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: /Download PNG/ }));
    expect((within(dialog).getByRole('group', { name: 'PNG size' }) as HTMLFieldSetElement).disabled).toBe(false);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Export' }));   // focus returns to the opener
  });

  it('downloads a clean SVG with named layers, and a transparent one without a background', async () => {
    render(<App />);
    click('Export');
    fireEvent.click(screen.getByRole('radio', { name: 'SVG' }));
    expect((screen.getByRole('group', { name: 'PNG size' }) as HTMLFieldSetElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Download SVG' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('untitled-storyboard-frame-1.svg');
    const svg = await readBlob(downloads[0].blob as Blob);
    expect(svg).toMatch(/<svg [^>]*width="1920"/);
    expect(svg).not.toMatch(/class="(hit|jh|bh|item|body)"|data-id|var\(--/);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    for (const id of ['background', 'scene', 'character-1', 'character-2', 'bubble-3', 'plant-4']) expect(doc.getElementById(id), id).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();                         // closes after downloading

    click('Export');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Transparent background' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download SVG' }));
    await waitFor(() => expect(downloads).toHaveLength(2));
    const t = await readBlob(downloads[1].blob as Blob);
    expect(t).not.toContain('id="background"'); expect(t).toContain('id="character-1"');
  });

  it('remembers the chosen format and size', () => {
    render(<App />);
    click('Export');
    fireEvent.click(screen.getByRole('radio', { name: /3x/ })); fireEvent.click(screen.getByRole('radio', { name: 'SVG' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    click('Export');
    expect((screen.getByRole('radio', { name: 'SVG' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: /3x/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('shows the SVG source when the clipboard is blocked', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
    render(<App />);
    click('Export'); fireEvent.click(screen.getByRole('radio', { name: 'SVG' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy SVG' }));
    const area = await screen.findByRole('textbox', { name: 'SVG source' }) as HTMLTextAreaElement;
    expect(area.value.startsWith('<svg')).toBe(true);
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
});

describe('projects: save and open', () => {
  it('names the project, saves a versioned file, and opens it back exactly', async () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), { target: { value: 'My Film: Act 1' } });
    click('Save');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('my-film-act-1.drawfree.json');
    const text = await readBlob(downloads[0].blob as Blob), file = JSON.parse(text) as { version: number; name: string; frames: Array<{ items: Array<Record<string, unknown>> }> };
    expect(file).toMatchObject({ version: PROJECT_VERSION, name: 'My Film: Act 1' });
    expect(file.frames[0].items[0].kind).toBe('char'); expect(text).not.toContain('"type"');

    const before = JSON.stringify(st().frames);
    click('Add frame'); click('Add frame');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File([text], 'x.drawfree.json')] } }); });
    await waitFor(() => expect(st().frames).toHaveLength(1));
    expect(JSON.stringify(st().frames)).toBe(before);
    expect(st().name).toBe('My Film: Act 1');
    expect((screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement).value).toBe('My Film: Act 1');
    click('Undo'); expect(st().frames).toHaveLength(3);                       // opening was one undo step
  });

  it('refuses files that are not projects and keeps the current work', async () => {
    render(<App />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['{"hello":1}'], 'bad.json')] } }); });
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/not a Drawfree project/));
    expect(items()).toHaveLength(4);
  });

  it('opens a file dropped on the page, with a hint while dragging', async () => {
    render(<App />);
    const file = JSON.stringify({ version: 1, name: 'Dropped', frames: [{ id: 'a', bg: '#ffffff', scene: 'none', note: '', items: [] }] });
    const dt = { types: ['Files'], files: [new File([file], 'd.drawfree.json')] };
    const enter = new Event('dragenter', { bubbles: true }); Object.assign(enter, { dataTransfer: dt });
    act(() => { window.dispatchEvent(enter); });
    expect(screen.getByText(/Drop a .drawfree.json/)).toBeTruthy();
    const drop = new Event('drop', { bubbles: true, cancelable: true }); Object.assign(drop, { dataTransfer: dt });
    await act(async () => { window.dispatchEvent(drop); });
    await waitFor(() => expect(st().name).toBe('Dropped'));
    expect(drop.defaultPrevented).toBe(true); expect(screen.queryByText(/Drop a .drawfree.json/)).toBeNull();
  });

  it('Ctrl+S saves and Ctrl+O opens the file picker, even while typing in a field', async () => {
    render(<App />);
    fireEvent.keyDown(screen.getByLabelText('Scene note'), { key: 's', ctrlKey: true });
    await waitFor(() => expect(downloads.some(d => d.name.endsWith('.drawfree.json'))).toBe(true));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement, open = vi.spyOn(input, 'click');
    fireEvent.keyDown(window, { key: 'o', metaKey: true });
    expect(open).toHaveBeenCalled();
  });

  it('clearing the name field shows an empty box while typing and the default name after', () => {
    render(<App />);
    const name = screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Abc' } }); expect(name.value).toBe('Abc');
    fireEvent.change(name, { target: { value: '' } });
    expect(name.value).toBe(''); expect(st().name).toBe('Untitled storyboard');
    fireEvent.blur(name); expect(name.value).toBe('Untitled storyboard');
  });
});

describe('reordering frames', () => {
  const notes = () => st().frames.map(f => f.note);
  const three = () => { st().setNote('A'); st().addFrame(); st().setNote('B'); st().addFrame(); st().setNote('C'); st().selectFrame(0); };
  const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('[data-frame-id]')];

  it('the move buttons reorder the current frame and stop at the ends', () => {
    three(); render(<App />);
    const earlier = screen.getByRole('button', { name: 'Move frame earlier' }) as HTMLButtonElement, later = screen.getByRole('button', { name: 'Move frame later' }) as HTMLButtonElement;
    expect(earlier.disabled).toBe(true);
    fireEvent.click(later); expect(notes()).toEqual(['B', 'A', 'C']); expect(st().fi).toBe(1);
    fireEvent.click(later); expect(notes()).toEqual(['B', 'C', 'A']); expect(later.disabled).toBe(true);
    fireEvent.click(earlier); expect(notes()).toEqual(['B', 'A', 'C']);
    click('Undo'); expect(notes()).toEqual(['B', 'C', 'A']);
    expect(screen.getByRole('status').textContent).toMatch(/Frame moved/);
  });

  it('Alt and an arrow key move the focused frame, and focus stays on it', async () => {
    three(); render(<App />);
    const first = buttons()[0];
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight', altKey: true });
    expect(notes()).toEqual(['B', 'A', 'C']);
    await waitFor(() => expect((document.activeElement as HTMLElement).dataset.frameId).toBe(st().frames[1].id));
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft', altKey: true });
    expect(notes()).toEqual(['A', 'B', 'C']);
    fireEvent.keyDown(buttons()[0], { key: 'ArrowLeft', altKey: true });          // already first: nothing happens
    expect(notes()).toEqual(['A', 'B', 'C']);
    fireEvent.keyDown(buttons()[0], { key: 'ArrowRight' });                       // without Alt, arrows keep their normal meaning
    expect(notes()).toEqual(['A', 'B', 'C']);
  });

  describe('dragging', () => {
    // lay the three thumbnails out side by side, 140px apart
    const layout = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const i = buttons().indexOf(this as HTMLButtonElement), x = i < 0 ? 0 : i * 140;
      return { x, y: 0, left: x, top: 0, width: 128, height: 72, right: x + 128, bottom: 72, toJSON: () => ({}) };
    });
    const drag = (from: number, toX: number, type = 'mouse') => {
      const el = buttons()[from];
      act(() => { const d = new MouseEvent('pointerdown', { bubbles: true, clientX: from * 140 + 60, clientY: 30 }); Object.defineProperty(d, 'pointerType', { value: type }); el.dispatchEvent(d); });
      pointer(window, 'pointermove', from * 140 + 70); pointer(window, 'pointermove', toX); pointer(window, 'pointerup', toX);
    };

    it('drags a frame to a new place, with one undo step, and the click after the drag does not select', async () => {
      three(); layout(); render(<App />);
      const steps = st().past.length;
      drag(0, 2 * 140 + 100);                                                   // past the middle of frame 3
      expect(notes()).toEqual(['B', 'C', 'A']); expect(st().past).toHaveLength(steps + 1);
      expect(st().fi).toBe(2);                                                  // the moved frame was current, and stays current
      fireEvent.click(buttons()[1]);                                            // the click that follows the drag: ignored
      expect(st().fi).toBe(2);
      await new Promise(r => setTimeout(r, 5));
      fireEvent.click(buttons()[1]); expect(st().fi).toBe(1);                   // a later click selects as usual
      click('Undo'); expect(notes()).toEqual(['A', 'B', 'C']);                  // the whole drag was one step
    });
    it('dragging to the same place, or only a few pixels, changes nothing', () => {
      three(); layout(); render(<App />);
      drag(1, 1 * 140 + 60);
      drag(2, 2 * 140 + 64);
      expect(notes()).toEqual(['A', 'B', 'C']);
    });
    it('touch drags are left to the strip to scroll', () => {
      three(); layout(); render(<App />);
      drag(0, 2 * 140 + 100, 'touch');
      expect(notes()).toEqual(['A', 'B', 'C']);
    });
    it('can drag backwards', () => {
      three(); layout(); render(<App />);
      drag(2, 10);
      expect(notes()).toEqual(['C', 'A', 'B']);
    });
    it('shows where the frame will land while dragging', () => {
      three(); layout(); render(<App />);
      const el = buttons()[0];
      act(() => { const d = new MouseEvent('pointerdown', { bubbles: true, clientX: 60, clientY: 30 }); Object.defineProperty(d, 'pointerType', { value: 'mouse' }); el.dispatchEvent(d); });
      pointer(window, 'pointermove', 80); pointer(window, 'pointermove', 2 * 140 + 100);
      expect(buttons()[0].className).toMatch(/dragging/); expect(buttons()[2].className).toMatch(/after/);
      pointer(window, 'pointerup', 2 * 140 + 100);
      expect(buttons().some(b => /dragging|after|before/.test(b.className))).toBe(false);
    });
  });
});

describe('export: whole board', () => {
  const calls: unknown[][] = [];
  const mockBuild = (impl?: (...a: unknown[]) => Promise<unknown>) => vi.spyOn(frameModule, 'buildBoardExport').mockImplementation(async (...a: unknown[]) => {
    calls.push(a);
    if (impl) return impl(...a) as never;
    return { blob: new Blob(['x'], { type: 'application/pdf' }), name: 'untitled-storyboard.pdf' };
  });
  beforeEach(() => { calls.length = 0; });
  const openBoard = () => { click('Export'); fireEvent.click(screen.getByRole('radio', { name: /Whole board/ })); };

  it('the scope picker shows the frame number and the frame count', () => {
    st().addFrame(); st().selectFrame(1);
    render(<App />); click('Export');
    expect(screen.getByRole('radio', { name: /This frame\s+Frame 2/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Whole board\s+2 frames/ })).toBeTruthy();
  });

  it('downloads the board as a PDF with the chosen page options', async () => {
    mockBuild(); render(<App />); openBoard();
    expect(screen.getByRole('radio', { name: 'PDF' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Letter' })); fireEvent.click(screen.getByRole('radio', { name: 'Portrait' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Layout' }), { target: { value: 'three' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('untitled-storyboard.pdf');
    expect(calls[0][2]).toMatchObject({ fmt: 'pdf', pdf: { size: 'letter', orientation: 'portrait', layout: 'three', notes: false } });
    expect(calls[0][0]).toBe(st().frames); expect(calls[0][1]).toBe('Untitled storyboard');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('downloads the board as a PNG strip with columns, width and notes', async () => {
    mockBuild(async () => ({ blob: new Blob(['x'], { type: 'image/png' }), name: 'untitled-storyboard-board.png' }));
    render(<App />); openBoard();
    fireEvent.click(screen.getByRole('radio', { name: 'PNG strip' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Frames per row' }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Frame width' }), { target: { value: '960' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG strip' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('untitled-storyboard-board.png');
    expect(calls[0][2]).toMatchObject({ fmt: 'png', strip: { cols: 3, frameW: 960, notes: true } });
  });

  it('shows progress while rendering and a notice afterwards', async () => {
    let report: ((d: number, t: number) => void) | undefined, finish: (() => void) | undefined;
    mockBuild((...a) => new Promise(res => { report = a[3] as typeof report; finish = () => res({ blob: new Blob(['x']), name: 'b.pdf', notice: '3 characters in the notes can\'t be shown in a PDF and became "?".' }); }));
    render(<App />); openBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(report).toBeDefined());
    act(() => { report?.(2, 5); });
    expect(screen.getAllByRole('status').some(s => s.textContent === 'Rendering frame 2 of 5…')).toBe(true);
    expect((screen.getByRole('button', { name: 'Download PDF' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    await act(async () => { finish?.(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getAllByRole('status').some(s => /Downloaded b\.pdf\. 3 characters/.test(s.textContent ?? ''))).toBe(true);
  });

  it('Cancel stops the export and nothing is downloaded', async () => {
    let signal: AbortSignal | undefined;
    mockBuild((...a) => new Promise(() => { signal = a[4] as AbortSignal; }));
    render(<App />); openBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(signal).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal?.aborted).toBe(true); expect(screen.queryByRole('dialog')).toBeNull(); expect(downloads).toHaveLength(0);
  });

  it('shows the reason when the export fails, and lets you try again', async () => {
    mockBuild(async () => { throw new Error('That many frames will not fit in one image.'); });
    render(<App />); openBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(screen.getAllByRole('status').some(s => /will not fit/.test(s.textContent ?? ''))).toBe(true));
    expect((screen.getByRole('button', { name: 'Download PDF' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('dialog')).toBeTruthy(); expect(downloads).toHaveLength(0);
  });

  it('remembers the scope and board options for next time', () => {
    mockBuild(); const { unmount } = render(<App />); openBoard();
    fireEvent.click(screen.getByRole('radio', { name: 'PNG strip' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Frames per row' }), { target: { value: '4' } });
    unmount(); render(<App />); click('Export');
    expect((screen.getByRole('radio', { name: /Whole board/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: 'PNG strip' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('combobox', { name: 'Frames per row' }) as HTMLSelectElement).value).toBe('4');
  });

  it('frame exports still work from the same dialog', async () => {
    render(<App />); click('Export');
    fireEvent.click(screen.getByRole('radio', { name: 'SVG' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download SVG' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('untitled-storyboard-frame-1.svg');
  });
});

describe('zoom and pan', () => {
  const vb = () => document.querySelector('#stage')?.getAttribute('viewBox');
  const wheel = (init: WheelEventInit) => {
    const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 300, clientY: 200, ...init });
    act(() => { document.querySelector('#stage')?.dispatchEvent(e); });
    return e;
  };

  it('starts showing the whole frame; the buttons zoom in, out and reset', () => {
    render(<App />);
    expect(vb()).toBe('0 0 960 540');
    expect((screen.getByRole('button', { name: /Reset zoom/ }) as HTMLButtonElement).disabled).toBe(true);
    click('Zoom in'); expect(vb()).toBe('96 54 768 432');
    expect(screen.getByRole('button', { name: /Reset zoom, now 125 percent/ }).textContent).toBe('125%');
    click('Zoom out'); expect(vb()).toBe('0 0 960 540');
    for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect((screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(true);   // the ceiling
    click(/Reset zoom/); expect(vb()).toBe('0 0 960 540');
  });

  it('Ctrl or Cmd plus the wheel zooms about the pointer and stops the page zooming; the plain wheel leaves the page alone', () => {
    render(<App />);
    expect(wheel({ deltaY: -100 }).defaultPrevented).toBe(false); expect(vb()).toBe('0 0 960 540');
    const e = wheel({ deltaY: -100, ctrlKey: true });
    expect(e.defaultPrevented).toBe(true); expect(st().view.zoom).toBeGreaterThan(1);
    const z = st().view.zoom; wheel({ deltaY: 100, metaKey: true }); expect(st().view.zoom).toBeLessThan(z);
  });

  it('once zoomed in, the plain wheel pans', () => {
    render(<App />);
    st().zoomBy(2);
    const c0 = st().view.cx, e = wheel({ deltaX: 40, deltaY: 0 });
    expect(e.defaultPrevented).toBe(true); expect(st().view.cx).toBe(c0 + 40);
  });

  it('with nothing selected the keys move the view: + and - zoom, arrows pan, 0 resets', () => {
    render(<App />);
    fireEvent.keyDown(document.body, { key: '+' }); expect(st().view.zoom).toBe(1.25);
    fireEvent.keyDown(document.body, { key: '-' }); expect(st().view.zoom).toBe(1);
    st().zoomBy(2);
    const c = st().view.cx;
    fireEvent.keyDown(document.body, { key: 'ArrowRight' }); expect(st().view.cx).toBe(c + 20);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', shiftKey: true }); expect(st().view.cx).toBe(c - 80);
    fireEvent.keyDown(document.body, { key: '0' }); expect(vb()).toBe('0 0 960 540');
  });

  it('with an item selected the same keys edit the item and leave the view alone', () => {
    render(<App />);
    selectFirstChar(); const s0 = items()[0].s;
    fireEvent.keyDown(document.body, { key: '+' });
    expect(items()[0].s).toBeGreaterThan(s0); expect(st().view.zoom).toBe(1);
  });

  it('typing in a field never zooms or pans', () => {
    render(<App />);
    fireEvent.keyDown(screen.getByLabelText('Scene note'), { key: '+' });
    fireEvent.keyDown(screen.getByLabelText('Scene note'), { key: '0' });
    expect(st().view.zoom).toBe(1);
  });

  it('Space and drag pans the view, and does not move the item under the pointer', () => {
    render(<App />);
    st().zoomBy(2);
    const c0 = { x: st().view.cx, y: st().view.cy }, x0 = items()[0].x;
    fireEvent.keyDown(window, { key: ' ' });
    pointer(hits()[0], 'pointerdown', 300, 300); pointer(window, 'pointermove', 250, 280); pointer(window, 'pointerup', 250, 280);
    fireEvent.keyUp(window, { key: ' ' });
    expect(st().view.cx).toBe(c0.x + 50); expect(st().view.cy).toBe(c0.y + 20);
    expect(items()[0].x).toBe(x0); expect(st().past).toHaveLength(0);
    pointer(hits()[0], 'pointerdown', 300, 300); pointer(window, 'pointermove', 340, 300); pointer(window, 'pointermove', 360, 300); pointer(window, 'pointerup', 360, 300);
    expect(items()[0].x).not.toBe(x0);                                         // with Space released it moves the item again
  });

  it('the middle mouse button pans too', () => {
    render(<App />);
    st().zoomBy(2); const c0 = st().view.cx;
    act(() => { hits()[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300, button: 1 })); });
    pointer(window, 'pointermove', 280, 300); pointer(window, 'pointerup', 280, 300);
    expect(st().view.cx).toBe(c0 + 20);
  });

  it('two fingers pinch to zoom, and the first finger does not start a drag', () => {
    render(<App />);
    const touch = (type: string, id: number, x: number, y: number, target: Element | Window) => act(() => {
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      Object.defineProperty(e, 'pointerType', { value: 'touch' }); Object.defineProperty(e, 'pointerId', { value: id });
      target.dispatchEvent(e);
    });
    const x0 = items()[0].x;
    touch('pointerdown', 1, 280, 300, hits()[0]);
    touch('pointerdown', 2, 320, 300, hits()[0]);                              // second finger: pinch begins
    touch('pointermove', 1, 240, 300, window); touch('pointermove', 2, 360, 300, window);   // fingers spread: 40 -> 120 px apart
    expect(st().view.zoom).toBeGreaterThan(2);
    expect(items()[0].x).toBe(x0); expect(st().past).toHaveLength(0);
    const z = st().view.zoom;
    touch('pointermove', 1, 280, 300, window); touch('pointermove', 2, 320, 300, window);   // pinch in
    expect(st().view.zoom).toBeLessThan(z);
    touch('pointerup', 1, 280, 300, window); touch('pointerup', 2, 320, 300, window);
    const z2 = st().view.zoom;
    touch('pointermove', 2, 500, 300, window);                                  // lifted fingers no longer zoom
    expect(st().view.zoom).toBe(z2);
  });

  it('opening a project resets the view, and zoom is not an undo step or saved', () => {
    render(<App />);
    st().zoomBy(3); expect(st().past).toHaveLength(0);
    st().loadProject({ name: 'x', aspect: '16:9', frames: [{ id: 'z', bg: '#ffffff', scene: 'none', note: '', items: [] }] });
    expect(st().view.zoom).toBe(1);
  });
});

describe('multi-select', () => {
  const shiftClick = (i: number) => pointer(hits()[i], 'pointerdown', 300, 300, { shiftKey: true });
  const upAt = (x = 300, y = 300) => pointer(window, 'pointerup', x, y);

  it('Shift-click adds and removes items; the toolbar says how many, and hides Pose', () => {
    render(<App />);
    selectFirstChar(); shiftClick(1); upAt();
    expect(st().sel).toBe(items()[0].id); expect(st().extra).toEqual([items()[1].id]);
    const tb = screen.getByRole('toolbar', { name: '2 items selected' });
    expect(within(tb).queryByRole('button', { name: 'Pose' })).toBeNull(); expect(within(tb).getByRole('button', { name: 'Flip' })).toBeTruthy();
    expect(document.querySelectorAll('[data-c]')).toHaveLength(0); expect(document.querySelector('[title^="Rotate"]')).toBeNull();   // no scale or rotate handles for a group
    expect(screen.getByRole('button', { name: 'Character 1' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Character 2' }).getAttribute('aria-pressed')).toBe('true');
    shiftClick(1); upAt();
    expect(st().extra).toEqual([]); expect(screen.getByRole('toolbar', { name: 'Selected item' })).toBeTruthy();
  });

  it('dragging any selected item moves the whole group together, as one undo step; a drag of an unselected item selects only it', () => {
    render(<App />);
    selectFirstChar(); shiftClick(1); upAt();
    const [a0, b0, p0] = items();
    pointer(hits()[1], 'pointerdown', 300, 300);
    pointer(window, 'pointermove', 330, 310); pointer(window, 'pointermove', 360, 320); upAt(360, 320);
    const [a1, b1, p1] = items();
    expect(a1.x - a0.x).toBe(60); expect(b1.x - b0.x).toBe(60); expect(a1.y - a0.y).toBe(20); expect(b1.y - b0.y).toBe(20);
    expect(p1).toBe(p0); expect(st().past).toHaveLength(1);
    expect(st().extra).toHaveLength(1);                                           // still a group
    pointer(hits()[2], 'pointerdown', 300, 300); pointer(window, 'pointermove', 320, 300); pointer(window, 'pointermove', 340, 300); upAt(340, 300);
    expect(st().extra).toEqual([]); expect(st().sel).toBe(items()[2].id);
  });

  it('a click on empty stage deselects; a drag draws a marquee that selects what it touches', () => {
    render(<App />);
    selectFirstChar();
    const stage = document.querySelector('#stage') as Element;
    pointer(stage, 'pointerdown', 10, 10); upAt(10, 10);
    expect(st().sel).toBeNull();
    pointer(stage, 'pointerdown', 10, 10); pointer(window, 'pointermove', 30, 30); upAt(30, 30);   // touches nothing: selects nothing
    expect(st().sel).toBeNull();
    pointer(stage, 'pointerdown', 50, 50); pointer(window, 'pointermove', 150, 150);
    expect(st().marquee).toEqual({ x0: 50, y0: 50, x1: 150, y1: 150 });
    upAt(150, 150);
    expect(st().marquee).toBeNull();
    expect(selectedIds(st()).length).toBe(4);                                       // the jsdom stub gives every item the same rectangle, so this marquee touches all four
    expect(st().past).toHaveLength(0);                                                // selecting is never an undo step
  });

  it('Shift plus a marquee adds to the selection', () => {
    render(<App />);
    selectFirstChar();
    const stage = document.querySelector('#stage') as Element;
    pointer(stage, 'pointerdown', 50, 50, { shiftKey: true }); pointer(window, 'pointermove', 150, 150, { shiftKey: true }); upAt(150, 150);
    expect(st().sel).toBe(items()[0].id); expect(selectedIds(st())).toHaveLength(4);
  });

  it('Ctrl/Cmd+A selects everything, Delete removes it all, and Ctrl+Z brings it back; typing in a field is left alone', () => {
    render(<App />);
    fireEvent.keyDown(screen.getByLabelText('Scene note'), { key: 'a', ctrlKey: true }); expect(st().sel).toBeNull();
    const e = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true); expect(selectedIds(st())).toHaveLength(4);
    fireEvent.keyDown(document.body, { key: 'Delete' }); expect(items()).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); expect(items()).toHaveLength(4);
  });

  it('the arrow keys, + and [ ] act on the whole group', () => {
    render(<App />);
    st().selectMany([items()[0].id, items()[1].id]);
    const x = [items()[0].x, items()[1].x];
    fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true });
    expect([items()[0].x, items()[1].x]).toEqual([x[0] + 10, x[1] + 10]);
    fireEvent.keyDown(document.body, { code: 'BracketRight', key: ']' });
    expect([items()[0].r, items()[1].r]).toEqual([5, 5]);
  });
});
