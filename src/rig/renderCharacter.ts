/* Character and item renderers. A character is plain data; its SVG is rebuilt from it on every change.
   A character's body is the posable figure, a cutout puppet of Open Peeps art (puppet.ts), or an Open Peeps body
   drawn whole with the head on top. The head is Open Peeps either way: head and hair, face, facial hair, glasses. */
import type { BodyPart, Character, Item, PropArgs } from '../types';
import { f1 } from '../parts/draw';
import { BODIES, FACE, FACIAL, GLASSES, HAIR, PROPS, lookup } from '../parts';
import { bodyArt } from '../parts/bodies';
import { peepSVG, type PeepColors } from '../parts/peeps/art';
import { GROUND, limbsOf } from './geometry';
import { restPose, rig } from './poses';
import { puppetSVG } from './puppet';

export { GROUND };
const hairOf = lookup(HAIR), faceOf = lookup(FACE), glassesOf = lookup(GLASSES), facialOf = lookup(FACIAL);
const bodyOf = lookup(BODIES), propOf = lookup(PROPS);

/** a new character with the default look. Pass overrides to change any field. */
export function newCharacter(o: Partial<Character> = {}): Character {
  const look = { top: o.top ?? 'shirt', bottom: o.bottom ?? 'trousers' };
  return {
    id: 'char', kind: 'char', x: 480, y: 300, s: 0.8, r: 0, flip: false, body: 'rig',
    skin: '#ffffff', hair: 'short-1', hairC: '#141414', face: 'smile',
    ...look, topC: '#ffffff', botC: '#cfe8ff', shoes: 'slip-ons', shoeC: '#ffffff',
    glasses: 'none', facial: 'none', hatC: '#4aa8ff',
    pose: restPose(look),
    ...o
  };
}

/** The area a character can occupy in local space [x0, y0, x1, y1], for its click and focus target. */
export function charBounds(c: Pick<Character, 'body'>): readonly [number, number, number, number] {
  const b = bodyOf(c.body);
  if (!b.box) return [-130, -290, 130, 200];
  const dy = GROUND - b.box[3];
  return [Math.min(b.box[0], -45) - 10, -270 + dy, Math.max(b.box[2], 45) + 10, GROUND + 10];
}

/** whether the character has the posable figure (pose handles, preset poses) */
export const isPosable = (c: Pick<Character, 'body'>): boolean => bodyOf(c.body).kind === 'rig';

const colorsOf = (c: Character): PeepColors => ({ skin: c.skin, hair: c.hairC, hat: c.hatC, top: c.topC, bottom: c.botC, shoe: c.shoeC });
const headSVG = (c: Character): string => {
  const pc = colorsOf(c);
  return peepSVG(hairOf(c.hair).art, pc) + peepSVG(faceOf(c.face).art, pc) + peepSVG(facialOf(c.facial).art, pc) + peepSVG(glassesOf(c.glasses).art, pc);
};

/** An Open Peeps body with the head on top, both shifted onto the ground line. Until the body art has loaded only
    the head shows (the art is a separate chunk; exports wait for it). */
function peepBodySVG(c: Character, b: BodyPart & { box: readonly number[] }): string {
  const art = bodyArt(b.id);
  const body = art ? peepSVG(art, colorsOf(c)) : '';
  return `<g transform="translate(0 ${GROUND - b.box[3]})">${body}${headSVG(c)}</g>`;
}

/** the character in local rig space, facing +x */
export function charSVG(c: Character): string {
  const b = bodyOf(c.body);
  if (b.kind !== 'rig' && b.box) return peepBodySVG(c, { ...b, box: b.box });
  return puppetSVG(c, headSVG(c), colorsOf(c));
}

export const propDef = (id: string) => propOf(id);
export const propSVG = (p: { prop: string } & PropArgs): string => propOf(p.prop).draw(p);

/** items that cannot face the other way (speech bubbles) */
export const canFlip = (it: Item): boolean => it.kind === 'char' || !propOf(it.prop).noFlip;

/** the ground shadow shows only while the character stands upright. Waist-up bodies have no floor, so no shadow. */
function shadowSVG(c: Character): string {
  if (Math.abs(c.r || 0) >= 8) return '';
  const b = bodyOf(c.body);
  if (b.kind === 'bust') return '';
  if (b.box) return `<ellipse cx="${f1((b.box[0] + b.box[2]) / 2)}" cy="${GROUND}" rx="${f1(Math.min(64, (b.box[2] - b.box[0]) / 2))}" ry="7" fill="#000" fill-opacity=".1"/>`;
  // the soles sit as far below each ankle as they do in the art, where they stand on the ground line
  const r = rig(c), L = limbsOf(c), sole = (l: 'lL' | 'lR') => r[l][2][1] + GROUND - (L[l].fam.j[L[l].j[2]][1] + L[l].dy);
  const ay = Math.max(sole('lL'), sole('lR')), ax = (r.lL[2][0] + r.lR[2][0]) / 2 + 6;
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

