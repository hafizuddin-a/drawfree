/* Standalone SVG for one frame. No editor chrome (no hit areas, no pose handles). Layers are named:
   background, scene, character-N / <prop>-N, where N is the item's position in the frame. */
import type { Frame } from '../types';
import { esc } from '../parts/draw';
import { itemSVG } from '../rig/renderCharacter';
import { sceneSVG } from '../scenes/scenes';

export const FRAME_W = 960, FRAME_H = 540;

export interface SvgOptions { transparent?: boolean; scale?: number }

export function frameToSVG(f: Frame, o: SvgOptions = {}): string {
  const k = o.scale || 2, sc = sceneSVG(f);
  const items = f.items.map((it, n) => `<g id="${it.kind === 'char' ? 'character' : it.prop}-${n + 1}">${itemSVG(it)}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME_W} ${FRAME_H}" width="${FRAME_W * k}" height="${FRAME_H * k}" role="img"><title>${esc(f.note || 'Storyboard frame')}</title>` +
    (o.transparent ? '' : `<rect id="background" width="${FRAME_W}" height="${FRAME_H}" fill="${f.bg}"/>`) +
    `${sc ? sc.replace('<g ', '<g id="scene" ') : ''}${items}</svg>`;
}
