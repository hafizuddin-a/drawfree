/* Character and item renderers. A character is plain data; its SVG is rebuilt from it on every change.
   A character's body is the posable figure (draw order, back to front: legs, neck, pelvis or skirt, top, left arm,
   head, right arm) or an Open Peeps body, drawn whole with the head on top. The head is Open Peeps either way:
   head and hair, face, facial hair, glasses. */
import type { BodyPart, Character, Item, PropArgs } from '../types';
import { INK, f1, pl, shp } from '../parts/draw';
import { BODIES, BOTTOMS, FACE, FACIAL, GLASSES, HAIR, PROPS, SHOES, TOPS, lookup } from '../parts';
import { bodyArt } from '../parts/bodies';
import { peepSVG } from '../parts/peeps/art';
import { slice } from './geometry';
import { hand, tube } from './limbs';
import { T_IDLE, poseFrom, rig } from './poses';

const hairOf = lookup(HAIR), faceOf = lookup(FACE), glassesOf = lookup(GLASSES), facialOf = lookup(FACIAL);
const bodyOf = lookup(BODIES), topOf = lookup(TOPS), bottomOf = lookup(BOTTOMS), shoeOf = lookup(SHOES), propOf = lookup(PROPS);

/** a new character with the default look. Pass overrides to change any field. */
export function newCharacter(o: Partial<Character> = {}): Character {
  return {
    id: 'char', kind: 'char', x: 480, y: 300, s: 0.8, r: 0, flip: false, body: 'rig',
    skin: '#ffffff', hair: 'short-1', hairC: '#141414', face: 'smile',
    top: 'tee', topC: '#ffffff', bottom: 'jeans', botC: '#cfe8ff', shoes: 'sneaker', shoeC: '#ffffff',
    glasses: 'none', facial: 'none', hatC: '#4aa8ff',
    pose: poseFrom(T_IDLE),
    ...o
  };
}

/** The ground line in rig space: the posable figure's soles. Open Peeps bodies are moved down to stand on it
    (waist-up bodies rest their bottom edge on it), so swapping a body keeps the character on the same floor. */
export const GROUND = 189;
/** The posable figure is drawn shorter than the coordinates its parts use: the torso (tops, neck) TORSO_DROP lower
    (the shoulder joints in geometry.ts match) and the head HEAD_DROP lower, for the Open Peeps proportions. */
export const TORSO_DROP = 10, HEAD_DROP = 20;

/** The area a character can occupy in local space [x0, y0, x1, y1], for its click and focus target. */
export function charBounds(c: Pick<Character, 'body'>): readonly [number, number, number, number] {
  const b = bodyOf(c.body);
  if (!b.box) return [-130, -290, 130, 200];
  const dy = GROUND - b.box[3];
  return [Math.min(b.box[0], -45) - 10, -270 + dy, Math.max(b.box[2], 45) + 10, GROUND + 10];
}

/** whether the character has the posable figure (pose handles, preset poses) */
export const isPosable = (c: Pick<Character, 'body'>): boolean => bodyOf(c.body).kind === 'rig';

const headSVG = (c: Character): string => {
  const pc = { skin: c.skin, hair: c.hairC, hat: c.hatC };
  return peepSVG(hairOf(c.hair).art, pc) + peepSVG(faceOf(c.face).art, pc) + peepSVG(facialOf(c.facial).art, pc) + peepSVG(glassesOf(c.glasses).art, pc);
};

/** An Open Peeps body with the head on top, both shifted onto the ground line. Until the body art has loaded only
    the head shows (the art is a separate chunk; exports wait for it). */
function peepBodySVG(c: Character, b: BodyPart & { box: readonly number[] }): string {
  const art = bodyArt(b.id);
  const body = art ? peepSVG(art, { skin: c.skin, hair: c.hairC, hat: c.hatC, top: c.topC, bottom: c.botC, shoe: c.shoeC }) : '';
  return `<g transform="translate(0 ${GROUND - b.box[3]})">${body}${headSVG(c)}</g>`;
}

/** the character in local rig space, facing +x */
export function charSVG(c: Character): string {
  const b = bodyOf(c.body);
  if (b.kind !== 'rig' && b.box) return peepBodySVG(c, { ...b, box: b.box });
  const top = topOf(c.top), bot = bottomOf(c.bottom), shoe = shoeOf(c.shoes);
  const r = rig(c);
  const arm = (k: 'aL' | 'aR') => {
    const pts = r[k];
    let s = tube(pts, 20, c.skin);
    if (top.sleeve > 0) s += tube(slice(pts, 0, top.sleeve), top.sw + 3, c.topC);
    return s + hand(pts, c.skin);
  };
  const leg = (k: 'lL' | 'lR') => {
    const pts = r[k];
    let s = tube(pts, 28, c.skin);
    if (bot.leg > 0) s += tube(slice(pts, 0, bot.leg), bot.lw + 3, c.botC);
    if (bot.leg > 100 && bot.stitch) s += `<polyline points="${pl(slice(pts, 8, bot.leg - 6))}" fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="3 4" stroke-linecap="round"/>`;
    if (shoe.boot > 0) s += tube(slice(pts, 176 - shoe.boot, 176), Math.max(bot.lw + 3, 29) + 2, c.shoeC);
    const a = pts[2], rot = Math.max(-45, Math.min(45, -(c.pose[k][0] + c.pose[k][1]) * 0.5));
    return s + `<g transform="translate(${f1(a[0])} ${f1(a[1])}) rotate(${f1(rot)})">${shoe.draw(c.shoeC, c.skin)}</g>`;
  };
  // the head sits a little lower than the rig's head centre, giving the short Open Peeps neck
  const head = `<g transform="translate(0 ${HEAD_DROP})">${headSVG(c)}</g>`;
  // the neck's top runs up under the jaw, which the head covers
  return leg('lL') + leg('lR') +
    bot.pelvis(c.botC) + `<g transform="translate(0 ${TORSO_DROP})">` + shp('M-10,-188 V-160 H10 V-188 Z', c.skin) + top.draw(c.topC, c.skin) + '</g>' +
    arm('aL') + head + arm('aR');
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

