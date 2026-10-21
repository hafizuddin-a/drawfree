/* The posable figure is a cutout puppet: a real Open Peeps standing body sliced at the shoulders, elbows, hips, knees
   and ankles, each piece turning about its joint. A family is a group of Open Peeps bodies drawn on the same
   geometry (stand-shirt-3 and stand-shirt-4 differ only in which garments are dark); its clip shapes are traced once
   by tools/cutout.ts into peeps/cutout.gen.ts, which loads with the body art. Joints, caps and underlays are here
   because the rig needs them before the art arrives. Coordinates are the art's own rig space (before the art is
   moved down onto the ground line). */
import type { Vec } from '../types';

export type PieceId = 'torso' | 'pelvis' | 'aL1' | 'aL2' | 'aR1' | 'aR2' | 'lL1' | 'lL2' | 'fL' | 'lR1' | 'lR2' | 'fR';
export const PIECES: readonly PieceId[] = ['torso', 'pelvis', 'aL1', 'aL2', 'aR1', 'aR2', 'lL1', 'lL2', 'fL', 'lR1', 'lR2', 'fR'];
export type JointId = 'shL' | 'elL' | 'wrL' | 'shR' | 'elR' | 'wrR' | 'hpL' | 'knL' | 'anL' | 'hpR' | 'knR' | 'anR';

/** A filled shape `d` in an Open Peeps colour kind ('t' top, 'b' bottom, 's' skin...), with the ink line `e` (an
    open path) along the edges that should show when the limb in front of it moves away. */
export interface Patch { kind: string; d: string; e: string }

/** Back to front: pieces, joint caps (`@` and the joint) and underlays (`_` and the piece they lie under). The far
    upper arm sits behind the torso as the art draws it; the far forearm comes in front of everything, so crossed
    arms and hands on hips read. */
export const ORDER = [
  '@hpR', '@knR', 'lR2', 'fR', 'lR1', '@hpL', '@knL', 'lL2', 'fL', 'lL1', '_pelvis', 'pelvis',
  '@shR', '@elR', '_aR1', 'aR1', '@shL', '_torso', 'torso', '@elL', 'aL1', 'aL2', 'head', 'aR2'
] as const;
/** the ink weight of joint rings and underlay edges, matched to the Open Peeps outlines on the standing bodies */
export const CUT_W = 2.5;
/** the joints that get a cap (tools/cutout.ts sizes each to hide under the pieces drawn after it) */
export const CAPPED: readonly JointId[] = ['shL', 'elL', 'shR', 'elR', 'hpL', 'knL', 'hpR', 'knR'];

export interface Family {
  id: string;
  /** the body the clip shapes were traced from */
  base: string;
  /** joint centres: shoulder, elbow, wrist (the hand handle), hip, knee, ankle */
  j: Readonly<Record<JointId, Vec>>;
  /** Underlays, drawn just under a piece (their edge `e` sits a little inside the line it continues, so it hides
      under that line at rest) and moving with it: the torso or pelvis as it would look without the limb in
      front of it, so a limb that moves away never leaves a hole; or the part of a limb the torso hides, so it is
      whole when it swings out. At rest they are hidden. (Joint caps are computed: see parts/peeps/cutout.gen.ts.) */
  under: Readonly<Partial<Record<PieceId, readonly Patch[]>>>;
  /** Seams: ink lines drawn over a piece along a cut where the art has no line (a sleeve that runs straight into the
      shoulder). They fade in as the piece's joint turns from rest, so the art is untouched as drawn. */
  seams?: Readonly<Partial<Record<PieceId, string>>>;
}
/** how far (degrees) a joint turns before a seam is fully drawn */
export const SEAM_FADE = 12;

export const FAMILIES: readonly Family[] = [
  {
    id: 'shirt', base: 'stand-shirt-3',
    // measured across each limb by `npx tsx tools/cutout.ts measure`
    j: {
      shL: [-38.4, -160], elL: [-42.9, -97], wrL: [-38.7, -44],
      shR: [40, -152], elR: [53.2, -97], wrR: [60, -46],
      hpL: [-13.4, -4], knL: [-33.8, 62], anL: [-45, 128],
      hpR: [28.4, -4], knR: [15.8, 62], anR: [20, 126]
    },
    under: {
      // the torso's side where the near arm's shoulder merges into it
      torso: [{ kind: 't', d: 'M-20,-172L-31,-162L-29,-140L-27.3,-121L-20,-121Z', e: 'M-31,-162L-29,-140L-27.3,-121' }],
      // the trousers' edge under the near hand
      pelvis: [{ kind: 'b', d: 'M-15,-62L-24.5,-58L-25.4,-54L-26.7,-50L-28.1,-44L-32.5,-12L-33.5,-5L-10,-5Z', e: 'M-27.2,-45L-31.8,-12L-32.3,-8.5' }],
      // the far upper arm is mostly hidden behind the torso: a band of sleeve there widens it when it swings out
      aR1: [{ kind: 't', d: 'M34,-152L44.5,-152L48.5,-97L46,-97Z', e: 'M34,-152L46,-97' }]
    },
    // the near arm's inner side above the armpit, where sleeve and shirt are one fill
    seams: { aL1: 'M-27.5,-160L-24,-140L-24.3,-135L-26,-129' }
  }
];
