/* The posable figure, drawn for posing, in proportions taken from the Open Peeps bodies so it suits their heads.
   Every limb is one smooth tube through its joints (bonePath), so a bend reads as a soft elbow or knee; sleeves and
   trouser legs are tubes along the same line and bend with it. The upper arms sit behind the torso (its shoulders
   cover their tops); a forearm that crosses the body is drawn again in front, sides only, so crossed arms and hands
   on hips read with no seam. Facing +x, three-quarter view: the near arm and leg are on the -x side.

   Local space: ground line at y = 189, pelvis near (0, 0), Open Peeps heads drawn 16 lower than their own space. */
import { type P, LW, bonePath, curve, fillOnly, line, part, shape, sides, tube } from './pen';

export type LimbId = 'aL' | 'aR' | 'lL' | 'lR';
export type LimbPose = readonly [number, number, number];
export type Pose = Readonly<Record<LimbId, LimbPose>>;

export const SKELETON = {
  sh: { L: [-40, -139] as P, R: [40, -137] as P },
  hip: { L: [-15, 6] as P, R: [21, 6] as P },
  arm: [62, 54] as const,
  leg: [72, 66] as const
};
const RAD = Math.PI / 180;
const fk = (o: P, l1: number, l2: number, a1: number, a2: number): [P, P, P] => {
  const e: P = [o[0] + l1 * Math.sin(a1 * RAD), o[1] + l1 * Math.cos(a1 * RAD)];
  const b = (a1 + a2) * RAD;
  return [o, e, [e[0] + l2 * Math.sin(b), e[1] + l2 * Math.cos(b)]];
};
export function joints(p: Pose): Record<LimbId, [P, P, P]> {
  const S = SKELETON;
  return {
    aL: fk(S.sh.L, S.arm[0], S.arm[1], p.aL[0], p.aL[1]), aR: fk(S.sh.R, S.arm[0], S.arm[1], p.aR[0], p.aR[1]),
    lL: fk(S.hip.L, S.leg[0], S.leg[1], p.lL[0], p.lL[1]), lR: fk(S.hip.R, S.leg[0], S.leg[1], p.lR[0], p.lR[1])
  };
}

export interface Look { skin: string; top: string; bottom: string; shoe: string; topKind: TopKind; bottomKind: BottomKind; shoeKind: ShoeKind }
export type TopKind = 'tee' | 'longsleeve' | 'shirt' | 'hoodie' | 'tank';
export type BottomKind = 'trousers' | 'shorts' | 'skirt';
export type ShoeKind = 'sneaker' | 'boot';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** a width profile through three stations: start, the joint (at fraction `at`), the end */
const profile = (w0: number, w1: number, w2: number, at: number) => (t: number) => (t < at ? lerp(w0, w1, t / at) : lerp(w1, w2, (t - at) / (1 - at)));
const f1 = (n: number) => n.toFixed(1);

/** a hand at the wrist, fingers along `dir`, thumb toward the figure's front */
function hand(wrist: P, dir: P, skin: string, mirror: boolean): string {
  const a = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI - 90, s = mirror ? -1 : 1;
  const palm = curve([[-7, -2], [-8.6, 8], [-7.4, 18], [-3.5, 25], [2.5, 25.5], [6.8, 20.5], [7.8, 12], [7.4, 3], [5, -2]]);
  const thumb = curve([[7.2, 3], [12, 7.5], [13.5, 12.5], [10.5, 14.5], [7.4, 12.5]]);
  return `<g transform="translate(${f1(wrist[0])} ${f1(wrist[1])}) rotate(${f1(a)}) scale(${s} 1)">` +
    shape(thumb + 'Z', skin) + shape(`${palm}Z`, skin) + line('M-2,17 Q-1.5,21.5 -2,24', LW * 0.6) + line('M2.6,16.5 Q3,20.5 2.8,23.5', LW * 0.6) + '</g>';
}

/** a shoe at the ankle, toe toward +x, near level with the ground (it follows the shin a little) */
function shoe(ankle: P, kind: ShoeKind, color: string, tilt: number): string {
  const upper = kind === 'boot'
    ? curve([[-11, -22], [-13, -2], [-13, 14], [26, 14], [31, 11], [28, 4], [15, 0], [11, -22]], true)
    : curve([[-10, -8], [-13, 2], [-13, 14], [26, 14], [32, 11], [30, 5], [16, 0], [7, -8]], true);
  // a thin white sole under the shoe, as wide as it
  const sole = curve([[-13.5, 12], [-14, 17], [-11, 19.5], [28, 19.5], [33, 16.5], [32.5, 12]], true);
  const lace = kind === 'sneaker' ? line('M6,-4 L12,1', LW * 0.7) + line('M11,-1.5 L17,3', LW * 0.7) : line('M-12,-14 L10,-14', LW * 0.7);
  return `<g transform="translate(${f1(ankle[0])} ${f1(ankle[1])}) rotate(${f1(tilt)})">${shape(sole, '#ffffff')}${shape(upper, color)}${lace}</g>`;
}

const SLEEVE: Record<TopKind, number> = { tee: 0.32, longsleeve: 0.95, shirt: 0.95, hoodie: 0.97, tank: 0 };
const ELBOW = 0.53, KNEE = 0.52;

interface ArmParts { back: string; front: string }
/** One arm, as what goes behind the torso and what is drawn again in front of it. */
function arm(j: [P, P, P], look: Look, mirror: boolean, forearmInFront: boolean): ArmParts {
  const path = bonePath(j[0], j[1], j[2]);
  const skinW = profile(17, 14.5, 12.5, ELBOW), cover = SLEEVE[look.topKind], wide = profile(25, 20.5, 18.5, ELBOW);
  // the whole arm: bare skin, then the sleeve over it
  const layer = (from: number): string => {
    let s = '';
    if (cover < 0.9) s += tubeFrom(path, skinW, Math.max(from, 0), 1, look.skin);
    if (cover > from) s += tubeFrom(path, wide, from, cover, look.top, cover > 0.9);
    return s;
  };
  const e = j[2], back = path[Math.max(0, path.length - 5)], d: P = [e[0] - back[0], e[1] - back[1]];
  const h = hand(e, d, look.skin, mirror);
  return forearmInFront ? { back: layer(0), front: layer(ELBOW) + h } : { back: layer(0) + h, front: '' };
}

/** A tube along part of a centre line, `t0` to `t1`. From the start of the line it is a closed shape with a round
    top; from part-way along it is drawn as a fill with only its sides and end outlined, so it lies seamlessly over the
    same tube drawn behind. `cuffed` marks a sleeve end. */
function tubeFrom(path: readonly P[], w: (t: number) => number, t0: number, t1: number, fill: string, cuffed = false): string {
  const seg = part(path, t0, t1), wt = (t: number) => w(t0 + t * (t1 - t0));
  const outline = curve(tube(seg, wt, t1 >= 0.999 || !cuffed), true);
  let s = t0 === 0 ? shape(outline, fill) : fillOnly(outline, fill) + sidesOnly(seg, wt);
  if (cuffed) s += cuffLine(seg, wt(1));
  return s;
}
/** the two sides and the rounded end of a tube, without the cut across its start */
function sidesOnly(seg: readonly P[], w: (t: number) => number): string {
  const [l, r] = sides(seg, w);
  return line(curve(l)) + line(curve(r));
}
/** the line across a sleeve, just above its end */
function cuffLine(seg: readonly P[], w: number): string {
  const n = seg.length, end = seg[n - 1], prev = seg[Math.max(0, n - 3)], d = [end[0] - prev[0], end[1] - prev[1]], l = Math.hypot(d[0], d[1]) || 1;
  const u = [d[0] / l, d[1] / l], nn = [-u[1], u[0]], h = w / 2 - 0.4, c = [end[0] - u[0] * 5, end[1] - u[1] * 5];
  return line(`M${f1(c[0] + nn[0] * h)},${f1(c[1] + nn[1] * h)} Q${f1(c[0] + u[0] * 1.5)},${f1(c[1] + u[1] * 1.5)} ${f1(c[0] - nn[0] * h)},${f1(c[1] - nn[1] * h)}`, LW * 0.8);
}

/** One leg: skin (under shorts and skirts), the trouser leg, the shoe. */
function leg(j: [P, P, P], look: Look): string {
  const path = bonePath(j[0], j[1], j[2]);
  let s = '';
  if (look.bottomKind !== 'trousers') s += shape(curve(tube(path, profile(25, 19, 15, KNEE)), true), look.skin);
  if (look.bottomKind !== 'skirt') {
    const cover = look.bottomKind === 'trousers' ? 0.94 : 0.4, wide = profile(40, 31, 28, KNEE), sl = part(path, 0, cover);
    s += shape(curve(tube(sl, t => wide(t * cover), false), true), look.bottom);
  }
  const shin = Math.atan2(j[2][0] - j[1][0], j[2][1] - j[1][1]) / RAD;
  return s + shoe(j[2], look.shoeKind, look.shoe, Math.max(-35, Math.min(35, -shin * 0.35)));
}

const NECK = curve([[-6, -182], [-8, -146], [12, -146], [12, -184]], true);
/** the torso for a top: shoulders round over the arms' tops, down to the hem */
function torso(look: Look): string {
  const k = look.topKind, hem = -18;
  let s = shape(NECK, look.skin);
  if (k === 'tank') {
    s += shape(curve([[-16, -160], [-32, -150], [-36, -120], [-33, -70], [-33, hem], [3, hem + 5], [40, hem + 2], [41, -70], [44, -120], [42, -148], [28, -160], [16, -144], [2, -140], [-8, -146]], true), look.top);
    return s;
  }
  s += shape(curve([
    [-8, -163], [-30, -157], [-45, -148], [-50, -134], [-41, -116], [-35, -88], [-34, -55], [-35, -30], [-34, hem],
    [-14, hem + 4], [12, hem + 5], [41, hem + 1], [42, -30], [40, -55], [42, -88], [46, -112], [54, -130], [50, -148], [32, -160], [12, -165]
  ], true), look.top);
  if (k === 'tee' || k === 'longsleeve') s += line(curve([[-8, -162], [2, -152], [12, -164]]));
  if (k === 'shirt') {
    s += shape(curve([[-9, -164], [-2, -146], [4, -154]], true), look.top) + shape(curve([[13, -166], [9, -146], [4, -154]], true), look.top);
    s += line(curve([[4, -154], [6, -90], [7, hem + 4]]), LW * 0.8);
  }
  if (k === 'hoodie') {
    s += shape(curve([[-14, -164], [-22, -172], [-8, -178], [16, -178], [26, -168], [16, -154], [2, -151], [-9, -156]], true), look.top);
    s += line('M-1,-152 Q-2,-140 -1,-128', LW * 0.8) + line('M9,-152 Q10,-140 10,-128', LW * 0.8);
    s += line(curve([[-22, -66], [28, -64], [32, -32], [-25, -34]], true), LW * 0.8);
  }
  return s;
}

/** the seat: trousers or shorts between the legs' tops, under the torso's hem, or a skirt */
function pelvis(look: Look): string {
  if (look.bottomKind === 'skirt') return shape(curve([[-33, -26], [-42, 20], [-46, 52], [2, 60], [50, 52], [46, 20], [41, -26]], true), look.bottom);
  // a fill over the legs' tops, outlined down the outer sides only, so the legs join it with no seam
  return fillOnly(curve([[-28, -22], [-33, 6], [-30, 22], [-10, 24], [3, 14], [14, 24], [36, 22], [39, 6], [35, -22]], true), look.bottom) +
    line(curve([[-31.5, -13], [-33.5, 4], [-31, 16]])) + line(curve([[38, -13], [39.5, 4], [37, 16]])) + line(curve([[3, -6], [3, 12]]), LW * 0.8);
}

/** The torso's near shoulder, laid over the near arm so its sleeve comes out from under the shoulder: filled in the
    top's colour, outlined only along the shoulder. (A sleeve is the same colour, so the fill's other edges vanish.) */
function shoulderCover(look: Look): string {
  if (look.topKind === 'tank') return '';
  return fillOnly(curve([[-8, -163], [-30, -157], [-45, -148], [-50, -134], [-41, -116], [-28, -122], [-20, -140], [-8, -150]], true), look.top) +
    line(curve([[-8, -163], [-30, -157], [-45, -148], [-50, -134], [-46, -125]]));
}

/** whether a hand at `w` is over the torso, so its forearm should be drawn in front of it */
const overBody = (w: P): boolean => w[0] > -28 && w[0] < 36 && w[1] > -160 && w[1] < 10;

/** The figure in local space, without the head. */
export function figureSVG(p: Pose, look: Look): string {
  const j = joints(p);
  const near = arm(j.aL, look, false, false), far = arm(j.aR, look, true, overBody(j.aR[2]));
  return leg(j.lR, look) + leg(j.lL, look) + pelvis(look) + far.back + torso(look) + near.back + shoulderCover(look) + far.front;
}
