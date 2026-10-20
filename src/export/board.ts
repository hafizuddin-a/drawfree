/* Whole-board export: the PNG strip (a grid of frames with their notes on one canvas) and the PDF. */
import type { Frame } from '../types';
import { type PdfOptions, type StripOptions, stripLayout, wrapLines } from './layout';
import { readBytes } from './download';
import { buildPdf, type PdfResult } from './pdf';
import { canvasToPng, makeCanvas, svgToImage, svgToPng } from './png';
import { FRAME_H, FRAME_W, frameToSVG } from './svg';

export interface BoardOptions { fmt: 'png' | 'pdf'; strip: StripOptions; pdf: PdfOptions }
export type Progress = (done: number, total: number) => void;

const FONT = "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif";

export class Cancelled extends Error {
  constructor() { super('Export cancelled.'); }
}
const check = (signal?: AbortSignal) => { if (signal?.aborted) throw new Cancelled(); };

/** Waits for the page's web font, so canvas text matches the interface. Falls back silently. */
async function fontsReady(): Promise<void> {
  try { await Promise.all([document.fonts.load(`600 16px Figtree`), document.fonts.load(`700 16px Figtree`)]); } catch { /* fall back to the system font */ }
}

/** One frame as PNG bytes at 2x, for the PDF. */
export async function renderFrameBytes(f: Frame): Promise<Uint8Array> {
  const blob = await svgToPng(frameToSVG(f, { scale: 2 }), FRAME_W * 2, FRAME_H * 2);
  return readBytes(blob);
}

export interface StripResult { blob: Blob; shrunk: boolean }

export async function renderStrip(frames: readonly Frame[], o: StripOptions, onProgress?: Progress, signal?: AbortSignal): Promise<StripResult> {
  const lay = stripLayout(frames.length, o);
  await fontsReady();
  const { canvas, g } = makeCanvas(lay.width, lay.height);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, lay.width, lay.height);
  g.textBaseline = 'top';
  for (const [i, f] of frames.entries()) {
    check(signal);
    const r = lay.frames[i], c = lay.captions[i];
    g.drawImage(await svgToImage(frameToSVG(f, { scale: 2 })), r.x, r.y, r.w, r.h);
    g.strokeStyle = '#d5dbe1'; g.lineWidth = 1; g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    // caption: the frame number in bold, the note beside and under it
    g.fillStyle = '#141414'; g.font = `700 ${lay.fontPx}px ${FONT}`;
    const label = o.notes ? `${i + 1}` : `Frame ${i + 1}`, indent = g.measureText(label).width + 6;
    g.fillText(label, c.x, c.y);
    if (o.notes) {
      g.font = `500 ${lay.fontPx}px ${FONT}`;
      const lines = wrapLines(f.note, c.w - indent, s => g.measureText(s).width, lay.maxLines);
      for (const [k, l] of lines.entries()) g.fillText(l, c.x + indent, c.y + k * lay.lineH);
    }
    onProgress?.(i + 1, frames.length);
    await new Promise<void>(res => setTimeout(res));               // let the page breathe between frames
  }
  check(signal);
  return { blob: await canvasToPng(canvas), shrunk: lay.shrunk };
}

export async function renderPdf(frames: readonly Frame[], name: string, o: PdfOptions, onProgress?: Progress, signal?: AbortSignal): Promise<PdfResult> {
  return buildPdf(frames, name, o, async f => { check(signal); return renderFrameBytes(f); }, onProgress);
}
