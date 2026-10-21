/* Drawfree data model. Everything the user makes is plain JSON built from these types; SVG is never stored. */

export type Vec = [number, number];
export type LimbId = 'aL' | 'aR' | 'lL' | 'lR';
/** +1 folds an arm forward, -1 folds a leg's knee forward; kept while dragging. */
export type Bend = 1 | -1;
/** [upperAngle, lowerAngle, bendSign] in degrees: 0 is straight down, positive swings toward +x. */
export type LimbPose = [number, number, Bend];
export type Pose = Record<LimbId, LimbPose>;

export type PartSlot = 'body' | 'hair' | 'face' | 'top' | 'bottom' | 'shoes' | 'glasses' | 'facial';
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

export type Character = { id: string; kind: 'char'; pose: Pose } & Placement & Record<PartSlot, string> & Record<ColorSlot, string>;

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
  version: 3;
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
/** A body: the posable figure ('rig') or an Open Peeps body standing, sitting or waist up. `box` is the Open Peeps
    art's bounds in rig space [x0, y0, x1, y1]; the art itself loads on demand (parts/bodies.ts). */
export interface BodyPart extends PartInfo { kind: 'rig' | 'stand' | 'sit' | 'bust'; box?: readonly [number, number, number, number] }
/** A garment for the posable figure: the clothes of an Open Peeps body (`art`) in a cutout family (parts/cutout.ts).
    A top dresses the torso and arms, a bottom the pelvis and legs, shoes the feet, each cut from its own art. */
export interface GarmentPart extends PartInfo { fam: string; art: string }
export type TopPart = GarmentPart;
export type BottomPart = GarmentPart;
export type ShoePart = GarmentPart;

export type PoseTargets = Record<LimbId, [Vec, Bend]>;
/** `t` holds targets for the limbs the preset moves; the others stay as the art was drawn */
export interface PosePreset extends PartInfo { t: Partial<PoseTargets> }

export interface PropArgs { text?: string }
export interface PropPart extends PartInfo {
  noFlip?: boolean;
  /** default text for a speech bubble */
  text?: string;
  draw: (p: PropArgs) => string;
}
export interface Scene extends PartInfo { draw: () => string }
