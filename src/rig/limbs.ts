/* Limb drawing: a thick black polyline under a coloured one gives the clean outline. */
import type { Vec } from '../types';
import { INK, f1, ln, pl, shp } from '../parts/draw';
import { RAD } from './geometry';

export function tube(pts: readonly Vec[], w: number, fill: string): string {
  const p = pl(pts);
  return `<polyline points="${p}" fill="none" stroke="${INK}" stroke-width="${w + 6}" stroke-linecap="round" stroke-linejoin="round"/>` +
         `<polyline points="${p}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** hand at the wrist (pts[2]), turned along the forearm */
export function hand(pts: readonly Vec[], skin: string): string {
  const e = pts[1], w = pts[2], ang = Math.atan2(w[0] - e[0], w[1] - e[1]) / RAD;
  return `<g transform="translate(${f1(w[0])} ${f1(w[1])}) rotate(${f1(-ang)})">` +
    shp('M-8.5,-3 C-10,4 -9,13 -5,17 C-2,20 4,19 6,15 C8.5,10 8.5,3 8.5,-3 Z', skin, 2.8) +
    shp('M7,2 C12,3 14,9 10.5,12.5 C9,10 8,6 7,2 Z', skin, 2.4) + ln('M-2,10 L-2,16', 1.8) + ln('M2.5,9 L2.5,16', 1.8) + '</g>';
}
