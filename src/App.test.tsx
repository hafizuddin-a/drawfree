/* UI smoke test: the port of tools/smoke.js, plus export, save and open. It drives the real React tree in jsdom.
   jsdom has no canvas, so PNG encoding is checked in a real browser, not here. */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { resetEditorStore, currentFrame, selectedItem, useEditor } from './state/store';
import type { Character, Item } from './types';

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
    expect(screen.getAllByRole('button', { pressed: false }).filter(b => b.getAttribute('data-sec') === 'hair')).toHaveLength(7);
    expect(screen.getByText('Click a character on the board to dress it.')).toBeTruthy();
  });

  it('selects a character, picks a part, flips, undoes and redoes', async () => {
    render(<App />);
    selectFirstChar();
    expect(st().sel).toBe(items()[0].id);
    const toolbar = screen.getByRole('toolbar', { name: 'Selected item' });
    expect(within(toolbar).getAllByRole('button')).toHaveLength(5);
    click('Curls');
    expect((selectedItem(st()) as Character).hair).toBe('curly');
    expect(screen.getByRole('button', { name: 'Curls' }).getAttribute('aria-pressed')).toBe('true');
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
    click('Curls');
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
    fireEvent.keyDown(document.body, { key: 'ArrowRight' }); expect(items()[0].x).toBe(x + 4);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', shiftKey: true }); expect(items()[0].x).toBe(x - 16);
    fireEvent.keyDown(document.body, { key: 'f' }); expect(items()[0].flip).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' }); expect(st().sel).toBeNull();
    st().select(id); fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(items().some(i => i.id === id)).toBe(false);
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
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search parts' }), { target: { value: 'beard' } });
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
    const dialog = screen.getByRole('dialog', { name: /Export Frame 1/ });
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
    expect(file).toMatchObject({ version: 1, name: 'My Film: Act 1' });
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
