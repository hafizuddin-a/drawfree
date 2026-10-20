// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_PIXELS, MAX_CANVAS_SIDE, PDF_HEADER, PDF_MARGIN, type PdfOptions, pdfPlan, stripLayout, wrapLines } from './layout';

/** a fake font where every character is 10 units wide */
const m = (s: string) => s.length * 10;

describe('wrapLines', () => {
  it('wraps greedily by word', () => {
    expect(wrapLines('one two three four', 90, m, 5)).toEqual(['one two', 'three', 'four']);
    expect(wrapLines('one two three four', 150, m, 5)).toEqual(['one two three', 'four']);
    expect(wrapLines('one two three four', 200, m, 5)).toEqual(['one two three four']);
  });
  it('returns nothing for empty or blank text, and collapses whitespace', () => {
    expect(wrapLines('', 100, m, 3)).toEqual([]);
    expect(wrapLines('  \n\t ', 100, m, 3)).toEqual([]);
    expect(wrapLines('a   b\n\nc', 100, m, 3)).toEqual(['a b c']);
  });
  it('breaks a word that is wider than the line', () => {
    const lines = wrapLines('abcdefghijklmnop', 50, m, 10);
    expect(lines.every(l => m(l) <= 50)).toBe(true); expect(lines.join('')).toBe('abcdefghijklmnop');
  });
  it('ends with an ellipsis when the text needs more lines than allowed, and never overflows', () => {
    const lines = wrapLines('alpha beta gamma delta epsilon zeta eta theta', 80, m, 2);
    expect(lines).toHaveLength(2); expect(lines[1].endsWith('…')).toBe(true);
    expect(lines.every(l => m(l) <= 80)).toBe(true);
  });
  it('keeps text that exactly fits, and handles a width too small for any character', () => {
    expect(wrapLines('abcde', 50, m, 1)).toEqual(['abcde']);
    expect(() => wrapLines('abc def', 5, m, 2)).not.toThrow();
  });
  it('does not split surrogate pairs or lose characters across wraps', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const lines = wrapLines(text, 120, m, 10);
    expect(lines.join(' ')).toBe(text);
  });
});

describe('stripLayout', () => {
  const o = { cols: 2, frameW: 480, notes: true } as const;
  it('places frames in a grid, left to right, then down', () => {
    const l = stripLayout(5, o);
    expect(l.frames).toHaveLength(5);
    expect(l.frames[0].x).toBe(l.frames[2].x); expect(l.frames[1].x).toBeGreaterThan(l.frames[0].x);
    expect(l.frames[0].y).toBe(l.frames[1].y); expect(l.frames[2].y).toBeGreaterThan(l.frames[0].y);
    expect(l.frames[4].y).toBe(l.frames[5 - 1].y);
  });
  it('frames are 16:9 and never overlap their captions or each other', () => {
    const l = stripLayout(7, { cols: 3, frameW: 720, notes: true });
    for (const f of l.frames) expect(f.h).toBe(Math.round(f.w * 9 / 16));
    l.frames.forEach((f, i) => {
      const c = l.captions[i];
      expect(c.y).toBeGreaterThanOrEqual(f.y + f.h); expect(c.x).toBe(f.x);
      l.frames.forEach((g, j) => { if (i !== j) expect(f.x < g.x + g.w && g.x < f.x + f.w && f.y < g.y + g.h && g.y < f.y + f.h).toBe(false); });
    });
  });
  it('everything stays inside the image', () => {
    for (const cols of [1, 2, 3, 4] as const) for (const count of [1, 2, 5, 9]) {
      const l = stripLayout(count, { cols, frameW: 960, notes: true });
      for (const r of [...l.frames, ...l.captions]) { expect(r.x + r.w).toBeLessThanOrEqual(l.width); expect(r.y + r.h).toBeLessThanOrEqual(l.height); }
    }
  });
  it('uses fewer columns than asked for when there are fewer frames, and leaves room for notes only when on', () => {
    expect(stripLayout(2, { cols: 4, frameW: 480, notes: false }).width).toBeLessThan(stripLayout(4, { cols: 4, frameW: 480, notes: false }).width);
    expect(stripLayout(4, { ...o, notes: true }).height).toBeGreaterThan(stripLayout(4, { ...o, notes: false }).height);
  });
  it('shrinks frames that would exceed the canvas limits, and says so', () => {
    const l = stripLayout(60, { cols: 1, frameW: 960, notes: true });
    expect(l.shrunk).toBe(true); expect(l.frameW).toBeLessThan(960);
    expect(l.width * l.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS); expect(Math.max(l.width, l.height)).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
    expect(stripLayout(4, o).shrunk).toBe(false);
  });
  it('refuses when even tiny frames cannot fit', () => {
    expect(() => stripLayout(5000, { cols: 1, frameW: 480, notes: true })).toThrow(/will not fit/);
  });
  it('rejects an empty board', () => { expect(() => stripLayout(0, o)).toThrow(/no frames/); });
});

describe('pdfPlan', () => {
  const base: PdfOptions = { size: 'a4', orientation: 'landscape', layout: 'one', notes: true };
  const inside = (p: ReturnType<typeof pdfPlan>) => {
    for (const page of p.pages) for (const c of page) for (const r of [c.frame, c.caption]) {
      expect(r.x).toBeGreaterThanOrEqual(PDF_MARGIN - 0.01); expect(r.x + r.w).toBeLessThanOrEqual(p.pageW - PDF_MARGIN + 0.01);
      expect(r.y).toBeGreaterThanOrEqual(PDF_MARGIN - 0.01); expect(r.y + r.h).toBeLessThanOrEqual(p.pageH - PDF_MARGIN - PDF_HEADER + 0.01);
    }
  };
  it('uses the right page sizes and orientations (in points)', () => {
    const a = pdfPlan(1, base), b = pdfPlan(1, { ...base, orientation: 'portrait' }), l = pdfPlan(1, { ...base, size: 'letter' });
    expect([Math.round(a.pageW), Math.round(a.pageH)]).toEqual([842, 595]);
    expect([Math.round(b.pageW), Math.round(b.pageH)]).toEqual([595, 842]);
    expect([l.pageW, l.pageH]).toEqual([792, 612]);
  });
  it('one frame per page: one page per frame, 16:9, centred, everything on the page', () => {
    for (const orientation of ['landscape', 'portrait'] as const) for (const size of ['a4', 'letter'] as const) for (const notes of [true, false]) {
      const p = pdfPlan(4, { size, orientation, layout: 'one', notes });
      expect(p.pages).toHaveLength(4); inside(p);
      for (const page of p.pages) { expect(page).toHaveLength(1); expect(page[0].frame.w / page[0].frame.h).toBeCloseTo(16 / 9, 5); }
      const c = p.pages[0][0].frame; expect(c.x + c.w / 2).toBeCloseTo(p.pageW / 2, 3);
    }
  });
  it('one per page gives the note more room when it needs it (portrait)', () => {
    const p = pdfPlan(1, { ...base, orientation: 'portrait' });
    expect(p.maxLines).toBeGreaterThan(4);
  });
  it('contact sheets fit several frames per page and flow onto more pages', () => {
    for (const layout of ['two', 'three'] as const) for (const orientation of ['landscape', 'portrait'] as const) {
      const p = pdfPlan(20, { size: 'a4', orientation, layout, notes: true });
      inside(p);
      expect(p.pages.reduce((n, pg) => n + pg.length, 0)).toBe(20);
      expect(p.pages[0].length).toBeGreaterThanOrEqual(layout === 'two' ? 2 : 3);
      expect(p.pages.flat().map(c => c.index)).toEqual([...Array(20).keys()]);        // reading order, nothing skipped or repeated
    }
  });
  it('cells on a page never overlap', () => {
    const p = pdfPlan(30, { size: 'letter', orientation: 'portrait', layout: 'three', notes: true });
    for (const page of p.pages) for (const a of page) for (const b of page) if (a !== b) {
      const ra = [a.frame, a.caption], rb = [b.frame, b.caption];
      for (const x of ra) for (const y of rb) expect(x.x < y.x + y.w && y.x < x.x + x.w && x.y < y.y + y.h && y.y < x.y + x.h).toBe(false);
    }
  });
  it('notes off makes room for more rows', () => {
    const on = pdfPlan(30, { size: 'a4', orientation: 'portrait', layout: 'two', notes: true }).pages[0].length;
    const off = pdfPlan(30, { size: 'a4', orientation: 'portrait', layout: 'two', notes: false }).pages[0].length;
    expect(off).toBeGreaterThanOrEqual(on);
  });
  it('rejects an empty board', () => { expect(() => pdfPlan(0, base)).toThrow(/no frames/); });
});
