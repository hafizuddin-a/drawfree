/* Drawfree data model. Everything the user makes is plain JSON built from these types; SVG is never stored. */

import type { Sketch } from './parts/sketch';

export type Vec = [number, number];

export type PartSlot = 'body' | 'hair' | 'face' | 'glasses' | 'facial';
export type ColorSlot = 'skin' | 'hairC' | 'topC' | 'botC' | 'shoeC' | 'hatC';

export interface Placement {
  x: number;
  y: number;
  /** scale */
  s: number;
  /** rotation in degrees */
  r: number;
  flip: boolean;
}

/** An Open Peeps character: a body (which comes dressed and posed), a head, and the colours that recolour both. */
export type Character = { id: string; kind: 'char' } & Placement & Record<PartSlot, string> & Record<ColorSlot, string>;

export interface Prop extends Placement {
  id: string;
  kind: 'prop';
  /** 'bubble' | 'plant' | 'chair' | 'table' | ... (an id from PROPS) */
  prop: string;
  text?: string;
  color?: string;
}

/** Array order is z-order; the last item is in front. */
export type Item = Character | Prop;

export interface Frame {
  id: string;
  items: Item[];
  /** scene id; 'none' is allowed */
  scene: string;
  /** background colour, #rrggbb */
  bg: string;
  note: string;
}

export type Aspect = '16:9' | '4:3' | '1:1' | '9:16';

export interface Project {
  version: 4;
  name: string;
  frames: Frame[];
  aspect: Aspect;
  /** ISO timestamp */
  updatedAt: string;
}

/* ---------- parts ---------- */
export interface PartInfo {
  id: string;
  name: string;
  tags: string[];
}
/** Open Peeps art (tools/import-peeps.ts): filled layers whose kind picks the colour. See parts/peeps/art.ts. */
export interface PeepArt { id: string; name: string; l: ReadonlyArray<readonly [kind: string, d: string]> }
/** Hairstyles (which include the head), expressions, facial hair and glasses are all Open Peeps parts. */
export interface PeepPart extends PartInfo { art: PeepArt }
/** An Open Peeps body standing, sitting or waist up. `box` is the art's bounds in rig space [x0, y0, x1, y1]; the
    art itself loads on demand (parts/bodies.ts). */
export interface BodyPart extends PartInfo { kind: 'stand' | 'sit' | 'bust'; box: readonly [number, number, number, number] }
export interface PropArgs { text?: string }
export interface PropPart extends PartInfo {
  noFlip?: boolean;
  /** default text for a speech bubble */
  text?: string;
  draw: (p: PropArgs) => string;
}
/** a scene draws itself with a sketch (parts/sketch.ts): fills and ink are collected apart, and the ink is drawn soft */
export interface Scene extends PartInfo { draw: (k: Sketch) => void }
