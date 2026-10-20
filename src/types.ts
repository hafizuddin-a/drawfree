/* Drawfree data model. Everything the user makes is plain JSON built from these types; SVG is never stored. */

export type Vec = [number, number];
export type LimbId = 'aL' | 'aR' | 'lL' | 'lR';
/** +1 folds an arm forward, -1 folds a leg's knee forward; kept while dragging. */
export type Bend = 1 | -1;
/** [upperAngle, lowerAngle, bendSign] in degrees: 0 is straight down, positive swings toward +x. */
export type LimbPose = [number, number, Bend];
export type Pose = Record<LimbId, LimbPose>;

export type PartSlot = 'hair' | 'face' | 'top' | 'bottom' | 'shoes' | 'glasses' | 'facial' | 'hat' | 'neck';
export type ColorSlot = 'skin' | 'hairC' | 'topC' | 'botC' | 'shoeC' | 'hatC' | 'neckC';

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
  version: 1;
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
/** Hair has two layers: back sits behind the head, front on top. `c` is the hair colour. */
export interface HairPart extends PartInfo { back: (c: string) => string; front: (c: string) => string }
export interface FacePart extends PartInfo { draw: () => string }
export interface GlassesPart extends PartInfo { draw: () => string }
/** Facial hair: `pre` is drawn before the face, `post` after it. */
export interface FacialPart extends PartInfo { pre: (c: string) => string; post: (c: string) => string }
export interface HatPart extends PartInfo { draw: (c: string) => string }
export interface NeckPart extends PartInfo { draw: (c: string) => string }
/** `sleeve` is the sleeve length along the arm (0 = sleeveless), `sw` the sleeve width. */
export interface TopPart extends PartInfo { sleeve: number; sw: number; draw: (c: string, skin: string) => string }
/** `leg` is how far down the leg the trousers reach (0 = skirt), `lw` their width. */
export interface BottomPart extends PartInfo { leg: number; lw: number; stitch?: boolean; pelvis: (c: string) => string }
/** `boot` is how much of the lower leg a boot covers. */
export interface ShoePart extends PartInfo { boot: number; draw: (c: string, skin: string) => string }

export type PoseTargets = Record<LimbId, [Vec, Bend]>;
export interface PosePreset extends PartInfo { t: PoseTargets }

export interface PropArgs { text?: string }
export interface PropPart extends PartInfo {
  noFlip?: boolean;
  /** default text for a speech bubble */
  text?: string;
  draw: (p: PropArgs) => string;
}
export interface Scene extends PartInfo { draw: () => string }
