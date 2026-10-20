import type { Frame } from '../types';
import { frameFileName } from './project';
import { FRAME_H, FRAME_W, frameToSVG } from './svg';
import { svgToPng } from './png';

export type ExportFormat = 'png' | 'svg';
export interface ExportOptions { fmt: ExportFormat; scale: 1 | 2 | 3; transparent: boolean }

/** Builds the download for one frame. `n` is the frame's 1-based position. */
export async function buildFrameExport(f: Frame, n: number, projectName: string, o: ExportOptions): Promise<{ blob: Blob; name: string }> {
  if (o.fmt === 'svg') return { blob: new Blob([frameToSVG(f, { transparent: o.transparent })], { type: 'image/svg+xml' }), name: frameFileName(projectName, n, 'svg') };
  const svg = frameToSVG(f, { transparent: o.transparent, scale: o.scale });
  return { blob: await svgToPng(svg, FRAME_W * o.scale, FRAME_H * o.scale), name: frameFileName(projectName, n, 'png') };
}
