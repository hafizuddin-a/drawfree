/* Character and item renderers. A character is plain data; its SVG is rebuilt from it on every change.
   Draw order (back to front): hair back, legs, neck, pelvis or skirt, top, neckwear, left arm,
   head (Open Peeps: head and hair, face, facial hair, glasses), right arm. */
import type { Character, Item, PropArgs } from '../types';
import { INK, f1, pl, shp } from '../parts/draw';
import { BOTTOMS, FACE, FACIAL, GLASSES, HAIR, PROPS, SHOES, TOPS, lookup } from '../parts';
import { peepSVG } from '../parts/peeps/art';
import { slice } from './geometry';
import { hand, tube } from './limbs';
import { T_IDLE, poseFrom, rig } from './poses';

const hairOf = lookup(HAIR), faceOf = lookup(FACE), glassesOf = lookup(GLASSES), facialOf = lookup(FACIAL);
const topOf = lookup(TOPS), bottomOf = lookup(BOTTOMS), shoeOf = lookup(SHOES), propOf = lookup(PROPS);

/** a new character with the default look. Pass overrides to change any field. */
export function newCharacter(o: Partial<Character> = {}): Character {
  return {
    id: 'char', kind: 'char', x: 480, y: 300, s: 0.8, r: 0, flip: false,
    skin: '#ffffff', hair: 'short-1', hairC: '#e0b95a', face: 'smile',
    top: 'tee', topC: '#ffffff', bottom: 'jeans', botC: '#cfe8ff', shoes: 'sneaker', shoeC: '#ffffff',
    glasses: 'none', facial: 'none', hatC: '#4aa8ff',
    pose: poseFrom(T_IDLE),
    ...o
  };
}

/** the character in local rig space, facing +x */
export function charSVG(c: Character): string {
  const top = topOf(c.top), bot = bottomOf(c.bottom), shoe = shoeOf(c.shoes);
  const r = rig(c);
  const arm = (k: 'aL' | 'aR') => {
    const pts = r[k];
    let s = tube(pts, 18, c.skin);
    if (top.sleeve > 0) s += tube(slice(pts, 0, top.sleeve), top.sw + 3, c.topC);
    return s + hand(pts, c.skin);
  };
  const leg = (k: 'lL' | 'lR') => {
    const pts = r[k];
    let s = tube(pts, 26, c.skin);
    if (bot.leg > 0) s += tube(slice(pts, 0, bot.leg), bot.lw + 3, c.botC);
    if (bot.leg > 100 && bot.stitch) s += `<polyline points="${pl(slice(pts, 8, bot.leg - 6))}" fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="3 4" stroke-linecap="round"/>`;
    if (shoe.boot > 0) s += tube(slice(pts, 176 - shoe.boot, 176), Math.max(bot.lw + 3, 29) + 2, c.shoeC);
    const a = pts[2], rot = Math.max(-45, Math.min(45, -(c.pose[k][0] + c.pose[k][1]) * 0.5));
    return s + `<g transform="translate(${f1(a[0])} ${f1(a[1])}) rotate(${f1(rot)})">${shoe.draw(c.shoeC, c.skin)}</g>`;
  };
  const pc = { skin: c.skin, hair: c.hairC, hat: c.hatC };
  const head = peepSVG(hairOf(c.hair).art, pc) + peepSVG(faceOf(c.face).art, pc) + peepSVG(facialOf(c.facial).art, pc) + peepSVG(glassesOf(c.glasses).art, pc);
  // the neck's top runs up under the jaw, which the head covers
  return leg('lL') + leg('lR') +
    shp('M-9,-196 V-160 H9 V-196 Z', c.skin) + bot.pelvis(c.botC) + top.draw(c.topC, c.skin) +
    arm('aL') + head + arm('aR');
}

export const propDef = (id: string) => propOf(id);
export const propSVG = (p: { prop: string } & PropArgs): string => propOf(p.prop).draw(p);

/** items that cannot face the other way (speech bubbles) */
export const canFlip = (it: Item): boolean => it.kind === 'char' || !propOf(it.prop).noFlip;

/** the ground shadow shows only while the character stands upright */
function shadowSVG(c: Character): string {
  if (Math.abs(c.r || 0) >= 8) return '';
  const r = rig(c), ay = Math.max(r.lL[2][1], r.lR[2][1]) + 15, ax = (r.lL[2][0] + r.lR[2][0]) / 2 + 6;
  return `<ellipse cx="${f1(ax)}" cy="${f1(ay)}" rx="64" ry="7" fill="#000" fill-opacity=".1"/>`;
}
/** the ground shadow under a character, or nothing */
export const itemShadow = (it: Item): string => (it.kind === 'char' ? shadowSVG(it) : '');
/** the item itself, without its shadow. The selection box is measured from this. */
export const itemFigure = (it: Item): string => (it.kind === 'char' ? charSVG(it) : propSVG(it));
/** the item's art in local space (shadow included for characters) */
export const itemArt = (it: Item): string => itemShadow(it) + itemFigure(it);
export const itemTransform = (it: Item): string =>
  `translate(${f1(it.x)} ${f1(it.y)}) rotate(${f1(it.r || 0)}) scale(${f1(it.s * 100) / 100})`;
export const bodyTransform = (it: Item): string => `scale(${it.flip && canFlip(it) ? -1 : 1} 1)`;

/** A static item for export and thumbnails: no hit area, no handles, no editor attributes. */
export const itemSVG = (it: Item): string =>
  `<g transform="${itemTransform(it)}"><g transform="${bodyTransform(it)}">${itemArt(it)}</g></g>`;

