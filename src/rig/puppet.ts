/* The posable figure: a cutout puppet of real Open Peeps art (see parts/cutout.ts for the families and pieces).
   Each garment's art is defined once and shown through one clip shape (a mask) per piece; a piece turns about its joint.
   Under the pieces: joint caps (a disk of the garment's colour with an ink ring, which closes the outline on the
   outside of a bent elbow, knee, shoulder or hip) and underlays (the torso and pelvis as they would look without the
   limb in front, so a moved limb never leaves a hole). Over them: seams, ink along cuts the art drew no line on,
   fading in as the joint turns.

   Back to front: the far leg, the near leg (each: caps, shin, foot, thigh), the pelvis, the far upper arm (behind
   the torso, as the art draws it), the torso, the near arm, the head, then the far forearm, which comes in front so
   crossed arms and hands on hips read. Pieces, caps and underlays are .cut: the browser measures a clipped element by
   all of its unclipped art, so the figure also carries a .bounds outline (each piece's convex hull) to measure. */
import type { Character, LimbId, Vec } from '../types';
import { CUT_W, ORDER, SEAM_FADE, type Family, type JointId, type PieceId } from '../parts/cutout';
import { BOTTOMS, SHOES, TOPS, lookup } from '../parts';
import { bodyArt, cutoutClips } from '../parts/bodies';
import { PEEP_INK, fillOf, peepSVG, type PeepArt, type PeepColors } from '../parts/peeps/art';
import type { CutoutClips } from '../parts/peeps/cutout.gen';
import { f1 } from '../parts/draw';
import { RAD, dropOf, familyOf, limbsOf } from './geometry';
import { limit } from './poses';
import { fk } from './ik';

/** how much of a shin's turn a foot follows: a little, so feet stay near flat on the floor */
const FOOT_FOLLOW = 0.3, FOOT_MAX = 40;

type M = [number, number, number, number, number, number];
const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const move = (x: number, y: number): M => [1, 0, 0, 1, x, y];
/** turns by `deg` in the rig's sense (positive swings a downward bone toward +x) */
const turn = (deg: number): M => { const r = -deg * RAD; return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]; };
/** the matrix that takes the art's joint `from` to `to` and turns the piece by `deg` about it */
const pivot = (from: Vec, to: Vec, deg: number): M => mul(mul(move(to[0], to[1]), turn(deg)), move(-from[0], -from[1]));
const apply = (m: M, x: number, y: number): Vec => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const mstr = (m: M): string => `matrix(${m.map(v => Math.round(v * 10000) / 10000).join(' ')})`;

const topOf = lookup(TOPS), bottomOf = lookup(BOTTOMS), shoeOf = lookup(SHOES);

/** `turn`: how far the piece has turned from rest against the piece it hangs from, in degrees */
interface Placed { piece: PieceId; fam: Family; art: string; m: M; turn: number }

/** where each piece goes for the character's pose */
function place(c: Character): Placed[] {
  const L = limbsOf(c), top = topOf(c.top), bot = bottomOf(c.bottom), shoe = shoeOf(c.shoes);
  const tf = familyOf(top.fam), bf = familyOf(bot.fam), sf = familyOf(shoe.fam);
  const out: Placed[] = [
    { piece: 'torso', fam: tf, art: top.art, m: move(0, dropOf(tf)), turn: 0 },
    { piece: 'pelvis', fam: bf, art: bot.art, m: move(0, dropOf(bf)), turn: 0 }
  ];
  const limb = (l: LimbId, upper: PieceId, lower: PieceId, foot: PieceId | null, art: string) => {
    const g = L[l], p = limit(l, c.pose[l]), [o, e, end] = fk(g.o, g.l1, g.l2, p[0], p[1]);
    const [jo, je] = [g.fam.j[g.j[0]], g.fam.j[g.j[1]]];
    const t1 = p[0] - g.rest[0], t2 = p[0] + p[1] - g.rest[1];
    out.push({ piece: upper, fam: g.fam, art, m: pivot(jo, o, t1), turn: t1 });
    out.push({ piece: lower, fam: g.fam, art, m: pivot(je, e, t2), turn: t2 - t1 });
    if (foot) {
      const spin = Math.max(-FOOT_MAX, Math.min(FOOT_MAX, t2 * FOOT_FOLLOW));
      out.push({ piece: foot, fam: sf, art: shoe.art, m: pivot(sf.j[g.j[2]], end, spin), turn: spin - t2 });
    }
  };
  limb('aL', 'aL1', 'aL2', null, top.art); limb('aR', 'aR1', 'aR2', null, top.art);
  limb('lL', 'lL1', 'lL2', 'fL', bot.art); limb('lR', 'lR1', 'lR2', 'fR', bot.art);
  return out;
}

const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');
/** Each cap rides on the piece above its joint: the torso or pelvis for a shoulder or hip, the upper limb for an elbow
    or knee. Its clip is in that piece's rest space. */
const CAP_ON: Readonly<Record<string, PieceId>> = { shL: 'torso', shR: 'torso', hpL: 'pelvis', hpR: 'pelvis', elL: 'aL1', elR: 'aR1', knL: 'lL1', knR: 'lR1' };

/** The puppet in local space, with `head` (the Open Peeps head, in the art's space) on the torso. Until the body art
    has loaded only the head shows. */
export function puppetSVG(c: Character, head: string, colors: PeepColors): string {
  const placed = place(c), torso = placed[0];
  // wrapped, so the figure's measure (editor/measure.ts, getBBox of each part) sees the head's drop: getBBox leaves
  // out an element's own transform
  const headSVG = `<g><g transform="${mstr(torso.m)}">${head}</g></g>`;
  const arts = [...new Set(placed.map(p => p.art))];
  if (arts.some(a => !bodyArt(a)) || placed.some(p => !cutoutClips(p.fam.id))) return headSVG;
  const u = 'pp-' + safeId(c.id), artId = (a: string) => `${u}-${arts.indexOf(a)}`;
  const clipId = (p: Placed) => `${u}-${p.fam.id}-${p.piece}`;
  const clipsOf = (p: Placed) => cutoutClips(p.fam.id) as CutoutClips;
  let defs = arts.map(a => `<g id="${artId(a)}">${peepSVG(bodyArt(a) as PeepArt, colors)}</g>`).join('');
  // Masks, not clip paths: Chrome clips each path of the art as it draws it, so along a cut a dark garment (colour
  // laid over solid ink) showed its ink as a hairline. A mask applies to the finished piece.
  for (const p of placed) defs += `<mask id="${clipId(p)}" maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800"><path d="${clipsOf(p).pieces[p.piece].c}" fill="#fff" fill-rule="evenodd"/></mask>`;

  const at = new Map(placed.map(p => [p.piece, p]));
  const ink = `stroke="${PEEP_INK}" stroke-width="${CUT_W}" stroke-linejoin="round" stroke-linecap="round"`;
  let body = '', bounds = '';
  for (const k of ORDER) {
    if (k === 'head') { body += headSVG; continue; }
    if (k[0] === '@') {
      const id = k.slice(1) as JointId, on = at.get(CAP_ON[id]) as Placed, cap = clipsOf(on).caps[id];
      if (!cap) continue;
      const ctr = on.fam.j[id], cid = `${u}-${on.fam.id}-${id}`;
      defs += `<clipPath id="${cid}"><path d="${cap[2]}"/></clipPath>`;
      body += `<circle class="cut" transform="${mstr(on.m)}" clip-path="url(#${cid})" cx="${ctr[0]}" cy="${ctr[1]}" r="${cap[0]}" fill="${fillOf(cap[1], colors)}" ${ink}/>`;
      continue;
    }
    if (k[0] === '_') {
      const p = at.get(k.slice(1) as PieceId) as Placed;
      for (const s of p.fam.under[p.piece] ?? []) {
        body += `<g class="cut" transform="${mstr(p.m)}"><path d="${s.d}" fill="${fillOf(s.kind, colors)}"/><path d="${s.e}" fill="none" ${ink}/></g>`;
      }
      continue;
    }
    const p = at.get(k as PieceId) as Placed;
    body += `<use class="cut" href="#${artId(p.art)}" transform="${mstr(p.m)}" mask="url(#${clipId(p)})"/>`;
    const seam = p.fam.seams?.[p.piece], fade = Math.min(1, Math.abs(p.turn) / SEAM_FADE);
    if (seam && fade > 0.05) body += `<path class="cut" transform="${mstr(p.m)}" d="${seam}" fill="none" ${ink} stroke-opacity="${f1(fade)}"/>`;
    const h = clipsOf(p).pieces[p.piece].h;
    let d = '';
    for (let i = 0; i < h.length; i += 2) { const q = apply(p.m, h[i], h[i + 1]); d += (i ? 'L' : 'M') + f1(q[0]) + ',' + f1(q[1]); }
    if (d) bounds += d + 'Z';
  }
  return `<defs>${defs}</defs>${body}<path class="bounds" d="${bounds}" fill="none"/>`;
}
