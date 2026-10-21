/* Limb drawing: a thick black polyline under a coloured one gives the clean outline. */
import type { Vec } from '../types';
import { INK, W, f1, ln, pl, shp } from '../parts/draw';
import { RAD } from './geometry';

export function tube(pts: readonly Vec[], w: number, fill: string): string {
  const p = pl(pts);
  return `<polyline points="${p}" fill="none" stroke="${INK}" stroke-width="${w + 2 * W}" stroke-linecap="round" stroke-linejoin="round"/>` +
         `<polyline points="${p}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** hand at the wrist (pts[2]), turned along the forearm: an Open Peeps style hand, a broad palm with a thumb and
    three finger lines */
export function hand(pts: readonly Vec[], skin: string): string {
  const e = pts[1], w = pts[2], ang = Math.atan2(w[0] - e[0], w[1] - e[1]) / RAD;
  return `<g transform="translate(${f1(w[0])} ${f1(w[1])}) rotate(${f1(-ang)})">` +
    shp('M7,2 C13,3 16,10 11.5,14.5 C9.5,11 8.5,7 7,2 Z', skin) +
    shp('M-8.5,-3 C-10.5,5 -10.5,14 -7.5,20 C-5,24.5 4.5,24.5 7.5,20 C10,15 10,6 8.5,-3 Z', skin) +
    ln('M-3.6,13 Q-3.9,18 -3.6,22', 1.6) + ln('M0.4,13.5 Q0.3,19 0.5,23', 1.6) + ln('M4.3,13 Q4.5,17.5 4.4,21.5', 1.6) + '</g>';
}
