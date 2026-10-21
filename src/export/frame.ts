import type { Frame } from '../types';
import { type BoardOptions, type Progress, renderPdf, renderStrip } from './board';
import { frameFileName, slug } from './project';
import { FRAME_H, FRAME_W, frameToSVG } from './svg';
import { svgToPng } from './png';
import { loadBodyArt } from '../parts/bodies';

export type ExportFormat = 'png' | 'svg';
export interface ExportOptions { fmt: ExportFormat; scale: 1 | 2 | 3; transparent: boolean }

/** Builds the download for one frame. `n` is the frame's 1-based position. */
export async function buildFrameExport(f: Frame, n: number, projectName: string, o: ExportOptions): Promise<{ blob: Blob; name: string }> {
  await loadBodyArt();   // an export must never go out without the Open Peeps bodies
  if (o.fmt === 'svg') return { blob: new Blob([frameToSVG(f, { transparent: o.transparent })], { type: 'image/svg+xml' }), name: frameFileName(projectName, n, 'svg') };
  const svg = frameToSVG(f, { transparent: o.transparent, scale: o.scale });
  return { blob: await svgToPng(svg, FRAME_W * o.scale, FRAME_H * o.scale), name: frameFileName(projectName, n, 'png') };
}

export interface BoardExport {
  blob: Blob;
  name: string;
  /** something the person should know about the result, for a toast */
  notice?: string;
}

/** Builds the download for the whole board: a PNG strip or a PDF. */
export async function buildBoardExport(frames: readonly Frame[], projectName: string, o: BoardOptions, onProgress?: Progress, signal?: AbortSignal): Promise<BoardExport> {
  await loadBodyArt();
  if (o.fmt === 'png') {
    const r = await renderStrip(frames, o.strip, onProgress, signal);
    return { blob: r.blob, name: `${slug(projectName)}-board.png`, notice: r.shrunk ? 'Frames were made smaller to fit the browser\'s image size limit.' : undefined };
  }
  const r = await renderPdf(frames, projectName, o.pdf, onProgress, signal);
  return {
    blob: new Blob([r.bytes as BlobPart], { type: 'application/pdf' }), name: `${slug(projectName)}.pdf`,
    notice: r.replacedChars ? `${r.replacedChars} character${r.replacedChars === 1 ? '' : 's'} in the notes can't be shown in a PDF and became "?".` : undefined
  };
}
