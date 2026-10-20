// @vitest-environment node
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { seedFrames } from '../state/seed';
import type { Frame } from '../types';
import { pdfPlan } from './layout';
import { buildPdf } from './pdf';

/** a valid 1x1 PNG, standing in for a rendered frame */
const PIXEL = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const render = vi.fn(async () => PIXEL);

const board = (n: number, note = (i: number) => `Note ${i + 1}`): Frame[] =>
  Array.from({ length: n }, (_, i) => ({ ...seedFrames()[0], id: `f${i}`, note: note(i) }));
const ascii = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

describe('buildPdf', () => {
  it('writes a real PDF with the right page count and size', async () => {
    const { bytes } = await buildPdf(board(5), 'My Film', { size: 'a4', orientation: 'landscape', layout: 'one', notes: true }, render);
    expect(ascii(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(5);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([842, 595]);
    expect(doc.getTitle()).toBe('My Film');
  });
  it('the page count follows the plan for contact sheets, in both sizes', async () => {
    for (const layout of ['two', 'three'] as const) for (const size of ['a4', 'letter'] as const) {
      const o = { size, orientation: 'portrait', layout, notes: true } as const;
      const { bytes } = await buildPdf(board(17), 'Board', o, render);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(pdfPlan(17, o).pages.length);
    }
  });
  it('renders each frame once and reports progress', async () => {
    render.mockClear();
    const seen: Array<[number, number]> = [];
    await buildPdf(board(4), 'x', { size: 'letter', orientation: 'portrait', layout: 'two', notes: false }, render, (d, t) => seen.push([d, t]));
    expect(render).toHaveBeenCalledTimes(4);
    expect(seen).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
  });
  it('draws notes as text, and leaves them out when notes are off', async () => {
    const opts = { size: 'a4', orientation: 'landscape', layout: 'one' } as const;
    const withNotes = (await buildPdf(board(1, () => 'Hello unique-marker'), 'x', { ...opts, notes: true }, render)).bytes;
    const without = (await buildPdf(board(1, () => 'Hello unique-marker'), 'x', { ...opts, notes: false }, render)).bytes;
    // pdf-lib writes text as hex strings in the content stream; they are compressed, so compare what a reader would find after inflating
    const { inflateSync } = await import('node:zlib');
    const text = (b: Uint8Array) => {
      const s = ascii(b), out: string[] = [];
      for (const m of s.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) { try { out.push(inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')); } catch { /* not a flate stream */ } }
      return out.join('\n');
    };
    const hex = (str: string) => Buffer.from(str, 'latin1').toString('hex').toUpperCase();
    expect(text(withNotes)).toContain(hex('unique-marker')); expect(text(without)).not.toContain(hex('unique-marker'));
    expect(text(without)).toContain(hex('Frame 1'));
  });
  it('counts characters the PDF font cannot draw, and still produces a file', async () => {
    const r = await buildPdf(board(2, () => 'Café 😀 日本'), 'Film 映画', { size: 'a4', orientation: 'landscape', layout: 'two', notes: true }, render);
    expect(r.replacedChars).toBe((1 + 2) * 2 + 2);                  // emoji + 2 CJK per note, plus 2 in the title on each page
    expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(1);
  });
  it('handles empty notes, very long notes and awkward whitespace', async () => {
    const notes = ['', '   ', 'x'.repeat(2000), 'word '.repeat(300), 'a\n\tb'];
    const r = await buildPdf(board(5, i => notes[i]), 'T', { size: 'a4', orientation: 'portrait', layout: 'three', notes: true }, render);
    expect(r.bytes.length).toBeGreaterThan(500);
  });
  it('fails clearly when a frame cannot be rendered, and when the board is empty', async () => {
    const bad = vi.fn(async () => { throw new Error('render failed'); });
    await expect(buildPdf(board(2), 'x', { size: 'a4', orientation: 'landscape', layout: 'one', notes: true }, bad)).rejects.toThrow('render failed');
    await expect(buildPdf([], 'x', { size: 'a4', orientation: 'landscape', layout: 'one', notes: true }, render)).rejects.toThrow(/no frames/);
  });
});
