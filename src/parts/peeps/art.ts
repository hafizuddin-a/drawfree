/* Open Peeps art as data. tools/import-peeps.ts writes the *.gen.ts files next to this one. */

import type { PeepArt } from '../../types';

export type { PeepArt };
/* A layer's kind: 's' skin, 'h' hair colour, 'a' hat colour, 'w' white, 'i' ink, or a fixed '#rrggbb'. */
export interface PeepColors { skin: string; hair: string; hat: string }

export const PEEP_INK = '#141414';

const fillOf = (k: string, c: PeepColors): string =>
  k === 'i' ? PEEP_INK : k === 's' ? c.skin : k === 'h' ? c.hair : k === 'a' ? c.hat : k === 'w' ? '#ffffff' : k;

/** The layers as SVG paths. Open Peeps shapes are filled outlines drawn with the even-odd rule. */
export function peepSVG(a: PeepArt, c: PeepColors): string {
  let s = '';
  for (const [k, d] of a.l) s += `<path d="${d}" fill="${fillOf(k, c)}" fill-rule="evenodd"/>`;
  return s;
}
