/* Character and item renderers. A character is plain data; its SVG is rebuilt from it on every change.
   A character is an Open Peeps body, which comes dressed and posed, with an Open Peeps head on top: head and hair,
   face, facial hair, glasses. */
import type { Character, Item, PropArgs } from '../types';
import { f1 } from '../parts/draw';
import { BODIES, FACE, FACIAL, GLASSES, HAIR, PROPS, lookup } from '../parts';
import { bodyArt } from '../parts/bodies';
import { peepSVG, type PeepColors } from '../parts/peeps/art';
import { GROUND } from './geometry';

export { GROUND };
const hairOf = lookup(HAIR), faceOf = lookup(FACE), glassesOf = lookup(GLASSES), facialOf = lookup(FACIAL);
const bodyOf = lookup(BODIES), propOf = lookup(PROPS);

/** the body new characters get and the seed's first character wears */
export const DEFAULT_BODY = 'stand-shirt-3';

/** a new character with the default look. Pass overrides to change any field. */
export function newCharacter(o: Partial<Character> = {}): Character {
  return {
    id: 'char', kind: 'char', x: 480, y: 300, s: 0.8, r: 0, flip: false, body: DEFAULT_BODY,
    skin: '#ffffff', hair: 'short-1', hairC: '#141414', face: 'smile',
    topC: '#ffffff', botC: '#cfe8ff', shoeC: '#ffffff',
    glasses: 'none', facial: 'none', hatC: '#4aa8ff',
    ...o
  };
}

/** The area a character can occupy in local space [x0, y0, x1, y1], for its click and focus target. */
export function charBounds(c: Pick<Character, 'body'>): readonly [number, number, number, number] {
  const b = bodyOf(c.body).box, dy = GROUND - b[3];
  return [Math.min(b[0], -45) - 10, -270 + dy, Math.max(b[2], 45) + 10, GROUND + 10];
}

const colorsOf = (c: Character): PeepColors => ({ skin: c.skin, hair: c.hairC, hat: c.hatC, top: c.topC, bottom: c.botC, shoe: c.shoeC });
const headSVG = (c: Character): string => {
  const pc = colorsOf(c);
  return peepSVG(hairOf(c.hair).art, pc) + peepSVG(faceOf(c.face).art, pc) + peepSVG(facialOf(c.facial).art, pc) + peepSVG(glassesOf(c.glasses).art, pc);
};

/** The character in local rig space, facing +x: its Open Peeps body with the head on top, both moved down onto the
    ground line. Until the body art has loaded only the head shows (the art is a separate chunk; exports wait for it). */
export function charSVG(c: Character): string {
  const b = bodyOf(c.body), art = bodyArt(b.id);
  return `<g transform="translate(0 ${GROUND - b.box[3]})">${art ? peepSVG(art, colorsOf(c)) : ''}${headSVG(c)}</g>`;
}

export const propDef = (id: string) => propOf(id);
export const propSVG = (p: { prop: string } & PropArgs): string => propOf(p.prop).draw(p);

/** items that cannot face the other way (speech bubbles) */
export const canFlip = (it: Item): boolean => it.kind === 'char' || !propOf(it.prop).noFlip;

/** the ground shadow shows only while the character stands upright. Waist-up bodies have no floor, so no shadow. */
function shadowSVG(c: Character): string {
  const b = bodyOf(c.body);
  if (Math.abs(c.r || 0) >= 8 || b.kind === 'bust') return '';
  return `<ellipse cx="${f1((b.box[0] + b.box[2]) / 2)}" cy="${GROUND}" rx="${f1(Math.min(64, (b.box[2] - b.box[0]) / 2))}" ry="7" fill="#000" fill-opacity=".1"/>`;
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

