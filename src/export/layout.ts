/* Board layout math for the PNG strip and the PDF. Pure functions: no DOM, no canvas, so they are tested in Node. */

export const FRAME_RATIO = 9 / 16;

/** Splits text into lines no wider than maxWidth (greedy by word; over-long words are broken). If it needs more than
 *  maxLines, the last line ends with an ellipsis. `measure` returns the width of a string in the target font. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  const push = (s: string) => { lines.push(s); };
  for (const word of words) {
    let w = word;
    // a single word wider than the line: break it by characters
    while (measure(w) > maxWidth && w.length > 1) {
      let cut = w.length - 1;
      while (cut > 1 && measure(w.slice(0, cut)) > maxWidth) cut--;
      if (cur) { push(cur); cur = ''; }
      push(w.slice(0, cut)); w = w.slice(cut);
    }
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next) > maxWidth) { push(cur); cur = w; } else cur = next;
  }
  if (cur) push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 0 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

/* ---------- PNG strip ---------- */
export interface StripOptions {
  /** frames per row */
  cols: 1 | 2 | 3 | 4;
  /** width of each frame in pixels */
  frameW: 480 | 720 | 960;
  notes: boolean;
}
export interface Rect { x: number; y: number; w: number; h: number }
export interface StripLayout {
  width: number;
  height: number;
  /** the frame width actually used: smaller than requested when the image would exceed browser canvas limits */
  frameW: number;
  shrunk: boolean;
  fontPx: number;
  lineH: number;
  maxLines: number;
  frames: Rect[];
  /** where each frame's caption goes (the number, and the note when notes are on) */
  captions: Rect[];
}

/** Safari caps a canvas at 16.7 million pixels, other browsers at about 268 million. Stay under the smaller one. */
export const MAX_CANVAS_PIXELS = 16_000_000;
export const MAX_CANVAS_SIDE = 16_384;
const MIN_FRAME_W = 120;

function stripAt(count: number, cols: number, frameW: number, notes: boolean): Omit<StripLayout, 'shrunk'> {
  const gap = Math.max(12, Math.round(frameW * 0.04)), fontPx = Math.max(13, Math.round(frameW * 0.03)), lineH = Math.round(fontPx * 1.35);
  const maxLines = notes ? 3 : 1, frameH = Math.round(frameW * FRAME_RATIO), capH = maxLines * lineH + 4;
  const rowH = frameH + 6 + capH, c = Math.min(cols, Math.max(1, count)), rows = Math.max(1, Math.ceil(count / c));
  const frames: Rect[] = [], captions: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const x = gap + (i % c) * (frameW + gap), y = gap + Math.floor(i / c) * (rowH + gap);
    frames.push({ x, y, w: frameW, h: frameH });
    captions.push({ x, y: y + frameH + 6, w: frameW, h: capH });
  }
  return { width: gap + c * (frameW + gap) - gap + gap, height: gap + rows * (rowH + gap), frameW, fontPx, lineH, maxLines, frames, captions };
}

/** Lays out `count` frames in a grid. Shrinks the frames when the image would be too big for a canvas; throws if it cannot fit. */
export function stripLayout(count: number, o: StripOptions): StripLayout {
  if (count < 1) throw new Error('There are no frames to export.');
  let frameW: number = o.frameW, lay = stripAt(count, o.cols, frameW, o.notes);
  const tooBig = (l: { width: number; height: number }) => l.width * l.height > MAX_CANVAS_PIXELS || Math.max(l.width, l.height) > MAX_CANVAS_SIDE;
  let shrunk = false;
  while (tooBig(lay)) {
    const k = Math.min(Math.sqrt(MAX_CANVAS_PIXELS / (lay.width * lay.height)), MAX_CANVAS_SIDE / Math.max(lay.width, lay.height));
    frameW = Math.floor(frameW * Math.min(k, 0.97));
    if (frameW < MIN_FRAME_W) throw new Error('That many frames will not fit in one image. Use more columns, or export a PDF.');
    lay = stripAt(count, o.cols, frameW, o.notes); shrunk = true;
  }
  return { ...lay, shrunk };
}

/* ---------- PDF ---------- */
export type PageSize = 'a4' | 'letter';
export type Orientation = 'landscape' | 'portrait';
/** 'one': a frame per page, as large as fits. 'two' and 'three': a contact sheet with that many frames per row. */
export type PdfLayout = 'one' | 'two' | 'three';
export interface PdfOptions { size: PageSize; orientation: Orientation; layout: PdfLayout; notes: boolean }

/** page sizes in points (1/72 inch) */
const PAGES: Record<PageSize, readonly [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };
export const PDF_MARGIN = 36, PDF_HEADER = 22;

export interface PdfCell { index: number; frame: Rect; caption: Rect }
export interface PdfPlan {
  pageW: number;
  pageH: number;
  fontSize: number;
  lineH: number;
  maxLines: number;
  /** cells per page, in PDF coordinates (origin bottom-left) */
  pages: PdfCell[][];
}

export function pdfPlan(count: number, o: PdfOptions): PdfPlan {
  if (count < 1) throw new Error('There are no frames to export.');
  const [a, b] = PAGES[o.size], [pageW, pageH] = o.orientation === 'landscape' ? [b, a] : [a, b];
  const contentW = pageW - 2 * PDF_MARGIN, contentH = pageH - 2 * PDF_MARGIN - PDF_HEADER, top = pageH - PDF_MARGIN - PDF_HEADER;
  const gap = 14, cols = o.layout === 'one' ? 1 : o.layout === 'two' ? 2 : 3;
  const fontSize = o.layout === 'one' ? 12 : o.layout === 'two' ? 9.5 : 8, lineH = fontSize * 1.32;
  let cellW: number, maxLines: number, rows: number;
  if (o.layout === 'one') {
    // the largest frame that leaves room for a few lines of note under it
    const noteMin = (o.notes ? 4 : 1) * lineH + 4;                       // the caption's 4pt padding is part of its height
    cellW = Math.min(contentW, (contentH - noteMin - 6) * (16 / 9));
    const frameH = cellW * FRAME_RATIO;
    maxLines = o.notes ? Math.max(1, Math.min(12, Math.floor((contentH - frameH - 6 - 4) / lineH))) : 1;
    rows = 1;
  } else {
    cellW = (contentW - (cols - 1) * gap) / cols;
    maxLines = o.notes ? 4 : 1;
    const rowH = cellW * FRAME_RATIO + 6 + maxLines * lineH + 4;
    rows = Math.max(1, Math.floor((contentH + gap) / (rowH + gap)));
  }
  const frameH = cellW * FRAME_RATIO, capH = maxLines * lineH + 4, rowH = frameH + 6 + capH, perPage = cols * rows;
  const left = o.layout === 'one' ? PDF_MARGIN + (contentW - cellW) / 2 : PDF_MARGIN;
  const pages: PdfCell[][] = [];
  for (let i = 0; i < count; i++) {
    const p = Math.floor(i / perPage), pos = i % perPage, r = Math.floor(pos / cols), c = pos % cols;
    const x = left + c * (cellW + gap), yTop = top - r * (rowH + gap);
    if (!pages[p]) pages[p] = [];
    pages[p].push({
      index: i,
      frame: { x, y: yTop - frameH, w: cellW, h: frameH },
      caption: { x, y: yTop - frameH - 6 - capH, w: cellW, h: capH }
    });
  }
  return { pageW, pageH, fontSize, lineH, maxLines, pages };
}
