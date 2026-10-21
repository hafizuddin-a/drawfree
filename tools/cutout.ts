// Traces the cutout puppet's clip shapes from the Open Peeps body art (src/parts/peeps/bodies.gen.ts, already in rig
// space) and writes src/parts/peeps/cutout.gen.ts. Joints, caps and underlays live in src/parts/cutout.ts; the cut
// lines, which only the tracing needs, are here.
//   npx tsx tools/cutout.ts                  regenerate cutout.gen.ts
//   npx tsx tools/cutout.ts measure          where the art spans across each joint (to place the joints)
//   npx tsx tools/cutout.ts compare docs/cutout   the puppet beside real Open Peeps poses, and joints bent step by step
//   npx tsx tools/cutout.ts review out.png   every family's pieces, tinted, over the art (check this after a change)
//
// How a body becomes pieces: the art is rasterised crisp, so each pixel knows its top layer (ink or a fill kind).
// Fill areas are flood-filled, kept apart by the ink and by CUTS (where a sleeve runs into the shoulder, or one
// trouser fill runs from the waist to the hem). Each area goes to the bone most of it is nearest to, then colour
// kinds settle the rest: shoes go to the foot, trouser fill above the hips to the pelvis, shirt fill to the torso.
// Ink goes to every piece whose fill it borders (within INK units), so a line between two side-by-side pieces
// stays on both when they part; FRONT lists the pairs where one piece lies over the other and keeps the line alone.
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { CAPPED, CUT_W, FAMILIES, ORDER, PIECES, type Family, type JointId, type PieceId } from '../src/parts/cutout';
import { PEEP_STANDING } from '../src/parts/peeps/bodies.gen';
import { PEEP_BODY_BOX } from '../src/parts/peeps/bodies.box.gen';
import { loadBodyArt } from '../src/parts/bodies';
import { POSES, poseFrom } from '../src/rig/poses';
import { charSVG, newCharacter } from '../src/rig/renderCharacter';
import type { PosePreset, PoseTargets } from '../src/types';
import { R, fills, grow, inkDistance, rasterise, toPt, toPx, trace, type Grid, type Pt } from './cutout-raster';

/** how far (units) ink counts as bordering a fill: the pack's strokes are 2 to 3 units wide */
const INK = 3.2;
/** how far (units) the piece behind reaches past a cut, under the piece in front */
const OVERLAP = 1.5;
/** clip outline tolerance, in units */
const TOL = 0.1;

/** `cuts`: lines fills may not cross. `front`: [front, back] pairs whose shared line stays with the front piece only.
    `own`: a point in a fill area and the piece it belongs to, where the nearest bone gets it wrong. */
interface Cuts {
  cuts: Pt[][]; front: Array<[front: PieceId, back: PieceId]>; own?: Array<[Pt, PieceId]>;
  /** a segment across the limb at each joint: `measure` reports the art's span along it, for placing the joint */
  across?: Partial<Record<JointId, [Pt, Pt]>>;
}
const CUTS: Record<string, Cuts> = {
  shirt: {
    cuts: [
      // left shoulder: across the arm at the joint, then down the armpit to the gap between arm and torso
      [[-75, -160], [-27.5, -160], [-24, -140], [-24.3, -135], [-26, -129], [-27.6, -123], [-28.3, -119]],
      // left elbow, from outside the arm to the gap
      [[-75, -97], [-29.3, -97]],
      // right shoulder: down onto the tip of the arm's inner line, and out past the shoulder
      [[44, -139.5], [42.3, -152], [80, -152]],
      // right elbow, from inside the inner line out
      [[47.2, -97], [80, -97]],
      // hips: one line across the trousers, through the front leg's inner line
      [[-60, -4], [80, -4]],
      // knees, each from outside the leg into the gap between the legs
      [[-75, 62], [-6, 62]],
      [[-6, 62], [80, 62]]
    ],
    front: [['aL2', 'pelvis'], ['torso', 'pelvis'], ['fL', 'lL2'], ['fR', 'lR2'], ['torso', 'aR1']],
    // the shirt's front panel right of the buttons lies nearer the far arm than the torso's bone
    own: [[[30, -110], 'torso'], [[38, -138], 'torso']],
    across: {
      shL: [[-75, -160], [-27.5, -160]], elL: [[-75, -97], [-29.3, -97]], shR: [[34, -152], [80, -152]], elR: [[47.2, -97], [80, -97]],
      hpL: [[-60, -4], [7.5, -4]], hpR: [[8.6, -4], [80, -4]], knL: [[-75, 62], [-6, 62]], knR: [[-3, 62], [80, 62]],
      wrL: [[-60, -44], [-29, -44]], wrR: [[50, -46], [80, -46]], anL: [[-70, 128], [-25, 128]], anR: [[0, 126], [40, 126]]
    }
  }
};

const dist2seg = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

/** the bones each fill area is matched against */
function bones(f: Family): Array<[PieceId, Pt, Pt]> {
  const j = f.j, mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const sh = mid(j.shL, j.shR), hp = mid(j.hpL, j.hpR);
  const ext = (a: Pt, b: Pt, by: number): Pt => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [b[0] + (b[0] - a[0]) / l * by, b[1] + (b[1] - a[1]) / l * by]; };
  return [
    ['torso', [sh[0], sh[1] - 40], [hp[0], hp[1] - 40]],
    ['pelvis', [j.hpL[0], j.hpL[1] - 12], [j.hpR[0], j.hpR[1] - 12]],
    ['aL1', j.shL, j.elL], ['aL2', j.elL, ext(j.elL, j.wrL, 28)],
    ['aR1', j.shR, j.elR], ['aR2', j.elR, ext(j.elR, j.wrR, 28)],
    ['lL1', j.hpL, j.knL], ['lL2', j.knL, j.anL], ['fL', j.anL, [j.anL[0] + 10, j.anL[1] + 30]],
    ['lR1', j.hpR, j.knR], ['lR2', j.knR, j.anR], ['fR', j.anR, [j.anR[0] + 10, j.anR[1] + 30]]
  ];
}

/** Which piece a fill area belongs to: its bone by majority, then its colour kind. */
function owner(g: Grid, f: Family, kind: string, px: number[]): PieceId {
  const bs = bones(f), votes = new Map<PieceId, number>();
  const step = Math.max(1, Math.floor(px.length / 400));
  for (let i = 0; i < px.length; i += step) {
    const p = toPt(g, px[i]);
    let best: PieceId = 'torso', bd = Infinity;
    for (const [id, a, b] of bs) { const d = dist2seg(p, a, b); if (d < bd) { bd = d; best = id; } }
    votes.set(best, (votes.get(best) ?? 0) + 1);
  }
  let o: PieceId = 'torso', n = -1;
  for (const [id, v] of votes) if (v > n) { n = v; o = id; }
  const side = o.includes('L') ? 'L' : 'R';
  const leg = o.startsWith('l') || o.startsWith('f');
  if (leg && (kind === 'f' || kind === 'w')) return `f${side}` as PieceId;
  if (o.startsWith('f') && kind !== 'f' && kind !== 'w') return `l${side}2` as PieceId;
  if (o === 'torso' && kind === 'b') return 'pelvis';
  if (o === 'pelvis' && kind !== 'b') return 'torso';
  return o;
}

/** each piece's pixels: its fill areas, the ink they border, and a little room into cut lines and empty space */
function pieces(f: Family): { g: Grid; masks: Map<PieceId, Uint8Array> } {
  const art = PEEP_STANDING.find(a => a.id === f.base);
  const box = PEEP_BODY_BOX[f.base];
  if (!art || !box) throw new Error(`no art for ${f.base}`);
  const spec = CUTS[f.id];
  const g = rasterise(art.l, box, spec.cuts);
  const N = g.w * g.h;
  const masks = new Map<PieceId, Uint8Array>(PIECES.map(p => [p, new Uint8Array(N)]));
  const own = (spec.own ?? []).map(([p, id]) => [toPx(g, p), id] as const);
  for (const a of fills(g)) {
    const set = new Set(a.px), forced = own.find(([i]) => set.has(i));
    const m = masks.get(forced ? forced[1] : owner(g, f, a.kind, a.px)) as Uint8Array;
    for (const i of a.px) m[i] = 1;
  }
  const dist = new Map<PieceId, Float32Array>(PIECES.map(p => [p, inkDistance(g, masks.get(p) as Uint8Array)]));
  const inkOf = new Map<PieceId, Uint8Array>(PIECES.map(p => [p, new Uint8Array(N)]));
  const stray: number[] = [];
  for (let i = 0; i < N; i++) {
    if (g.top[i] !== 0 || g.cut[i]) continue;
    let near = Infinity;
    for (const p of PIECES) near = Math.min(near, (dist.get(p) as Float32Array)[i]);
    if (near === Infinity) { stray.push(i); continue; }
    const got = PIECES.filter(p => { const d = (dist.get(p) as Float32Array)[i]; return d <= INK || d <= near + 0.01; });
    for (const p of got) {
      if (spec.front.some(([fr, bk]) => bk === p && got.includes(fr))) continue;
      (inkOf.get(p) as Uint8Array)[i] = 1;
    }
  }
  // ink no fill reaches (a stroke drawn over the background) goes to the nearest bone
  const bs = bones(f);
  for (const i of stray) {
    const p = toPt(g, i);
    let best: PieceId = 'torso', bd = Infinity;
    for (const [id, a, b] of bs) { const d = dist2seg(p, a, b); if (d < bd) { bd = d; best = id; } }
    (inkOf.get(best) as Uint8Array)[i] = 1;
  }
  // A back piece keeps clear of the line its front piece owns: the traced clip edge wobbles by a fraction of a unit,
  // and a sliver of that line left on the back piece shows as a hairline once the front piece moves. So the back
  // piece stops a pixel short of it, and the front piece (drawn on top) reaches 4 pixels into the back piece's fill,
  // which keeps the two overlapping at rest.
  for (const [fr, bk] of spec.front) {
    const own = inkOf.get(fr) as Uint8Array, theirs = inkOf.get(bk) as Uint8Array, line = own.map((v, i) => (v && !theirs[i] ? 1 : 0));
    const near = grow(g, line, 1, () => true), strip = grow(g, line, 4, () => true);
    const back = masks.get(bk) as Uint8Array, front = masks.get(fr) as Uint8Array;
    for (let i = 0; i < N; i++) {
      if (!back[i] || theirs[i]) continue;
      if (strip[i]) front[i] = 1;
      if (near[i]) back[i] = 0;
    }
  }
  for (const p of PIECES) {
    const m = masks.get(p) as Uint8Array, ink = inkOf.get(p) as Uint8Array;
    for (let i = 0; i < N; i++) if (ink[i]) m[i] = 1;
    // across the cut lines (both neighbours take them), then into empty space, so the clip never shaves a stroke
    let grown = grow(g, m, 3, i => g.cut[i] === 1 && g.top[i] >= 0);
    grown = grow(g, grown, 2, i => g.top[i] < 0);
    masks.set(p, grown);
  }
  // At a cut the piece drawn behind reaches OVERLAP past it, under the piece in front. Two clip edges that merely
  // touch let the background through as a hairline where the browser antialiases each one.
  const near = grow(g, g.cut, OVERLAP * R, () => true), pieceOrder = ORDER.filter((k): k is PieceId => (PIECES as readonly string[]).includes(k));
  const after = new Map(pieceOrder.map((p, k) => {
    const u = new Uint8Array(N);
    for (const q of pieceOrder.slice(k + 1)) { const m = masks.get(q) as Uint8Array; for (let i = 0; i < N; i++) if (m[i]) u[i] = 1; }
    return [p, u] as const;
  }));
  for (const p of pieceOrder) {
    const later = after.get(p) as Uint8Array;
    masks.set(p, grow(g, masks.get(p) as Uint8Array, OVERLAP * R, i => near[i] === 1 && later[i] === 1 && g.top[i] >= 0));
  }
  return { g, masks };
}

/** convex hull (monotone chain) */
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** The cap at a joint: the largest disk (ring included) that the pieces drawn after it hide at rest, and the colour
    kind most of it covers. Also looks a few units around for a centre that allows a bigger cap, to report. */
/** where the art starts and ends along a segment */
function span(g: Grid, [a, b]: [Pt, Pt]): [Pt, Pt] | null {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * R), at = (k: number): Pt => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
  let first = -1, last = -1;
  for (let k = 0; k <= n; k++) if (g.top[toPx(g, at(k))] >= 0) { if (first < 0) first = k; last = k; }
  return first < 0 ? null : [at(first), at(last)];
}

/** A joint cap: a disk as wide as the limb where it is cut (its ring on the outline), clipped to what the pieces drawn
    after it cover at rest, so it never shows in the drawn pose but fills any wedge a bent joint opens there. */
interface Cap { r: number; kind: string; clip: string }
function cap(g: Grid, masks: Map<PieceId, Uint8Array>, f: Family, j: JointId): Cap & { better?: Pt } {
  const later = ORDER.slice(ORDER.indexOf(`@${j}` as (typeof ORDER)[number]) + 1).filter((k): k is PieceId => (PIECES as readonly string[]).includes(k));
  const N = g.w * g.h, cover = new Uint8Array(N);
  for (const p of later) { const m = masks.get(p) as Uint8Array; for (let i = 0; i < N; i++) if (m[i] && g.top[i] >= 0) cover[i] = 1; }
  let worst: Pt = [0, 0];
  const radius = (c: Pt): number => {
    const cx = (c[0] - g.x0) * R, cy = (c[1] - g.y0) * R;
    let best = 40 * R;
    for (let y = Math.max(0, Math.floor(cy - 40 * R)); y < Math.min(g.h, cy + 40 * R); y++) {
      for (let x = Math.max(0, Math.floor(cx - 40 * R)); x < Math.min(g.w, cx + 40 * R); x++) {
        if (cover[y * g.w + x]) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < best) { best = d; if (process.env.DEBUG_CAP === j) worst = [x / R + g.x0, y / R + g.y0]; }
      }
    }
    return best / R - CUT_W / 2;
  };
  const at = f.j[j], r = radius(at);
  if (process.env.DEBUG_CAP === j) console.log('nearest uncovered', worst, 'top', g.top[toPx(g, worst)], 'cut', g.cut[toPx(g, worst)]);
  const kinds = new Map<string, number>();
  for (let y = -r; y <= r; y += 0.5) for (let x = -r; x <= r; x += 0.5) {
    if (x * x + y * y > r * r) continue;
    const t = g.top[toPx(g, [at[0] + x, at[1] + y])];
    if (t > 0) kinds.set(g.kinds[t - 1], (kinds.get(g.kinds[t - 1]) ?? 0) + 1);
  }
  const kind = [...kinds].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 't';
  let better: Pt | undefined, br = r;
  for (let dy = -4; dy <= 4; dy += 0.5) for (let dx = -4; dx <= 4; dx += 0.5) {
    const c: Pt = [at[0] + dx, at[1] + dy], rr = radius(c);
    if (rr > br + 0.4) { br = rr; better = c; }
  }
  if (better) console.log(`  ${f.id} ${j}: r ${r.toFixed(1)} at ${at}; (${better}) would allow ${br.toFixed(1)}`);
  // full size: half the limb's width along its `across` segment, measured to the middle of the outline
  const seg = CUTS[f.id].across?.[j], sp = seg && span(g, seg);
  const full = sp ? Math.hypot(sp[1][0] - sp[0][0], sp[1][1] - sp[0][1]) / 2 - CUT_W / 2 : r;
  const big = Math.max(r, full), reach = (big + CUT_W) * R, cx = (at[0] - g.x0) * R, cy = (at[1] - g.y0) * R;
  const m = new Uint8Array(N);
  for (let y = Math.max(0, Math.floor(cy - reach)); y < Math.min(g.h, cy + reach); y++) {
    for (let x = Math.max(0, Math.floor(cx - reach)); x < Math.min(g.w, cx + reach); x++) {
      const i = y * g.w + x;
      if (cover[i] && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= reach) m[i] = 1;
    }
  }
  return { r: Math.floor(big * 10) / 10, kind, clip: pathOf(trace(g, m, 0.15)), better };
}

const fmt = (n: number): string => String(Math.round(n * 10) / 10);
const pathOf = (loops: Pt[][]): string => loops.map(l => 'M' + l.map(p => fmt(p[0]) + ',' + fmt(p[1])).join('L') + 'Z').join('');

function generate(): void {
  let out = '/* Generated by tools/cutout.ts from the Open Peeps body art. Do not edit. The cutout puppet\'s clip shapes per family\n' +
    '   and piece, in the art\'s rig space (see parts/cutout.ts): `c` the clip path, `h` its convex hull as x, y pairs\n' +
    '   (the piece\'s outline for measuring: the browser measures a clipped element by its whole unclipped art).\n' +
    '   `caps`: each joint cap\'s radius, colour kind and clip: as wide as the limb, clipped to what the pieces drawn after\n' +
    '   it cover at rest. */\n' +
    'import type { JointId, PieceId } from \'../cutout\';\n\n' +
    'export interface CutoutClips {\n  caps: Readonly<Partial<Record<JointId, readonly [r: number, kind: string, clip: string]>>>;\n  pieces: Readonly<Record<PieceId, { c: string; h: readonly number[] }>>;\n}\n' +
    'export const CUTOUT_CLIPS: Readonly<Record<string, CutoutClips>> = {\n';
  for (const f of FAMILIES) {
    const { g, masks } = pieces(f);
    const caps = CAPPED.map(j => [j, cap(g, masks, f, j)] as const).filter(([, c]) => c.r > 1 && c.clip);
    out += `  ${JSON.stringify(f.id)}: {\n`;
    out += `    caps: { ${caps.map(([j, c]) => `${j}: [${fmt(c.r)}, ${JSON.stringify(c.kind)}, ${JSON.stringify(c.clip)}]`).join(', ')} },\n`;
    out += '    pieces: {\n' + PIECES.map(p => {
      const loops = trace(g, masks.get(p) as Uint8Array, TOL);
      return `      ${p}: { c: ${JSON.stringify(pathOf(loops))}, h: [${hull(loops.flat()).flat().map(fmt).join(', ')}] }`;
    }).join(',\n') + '\n    }\n  },\n';
  }
  out = out.replace(/,\n$/, '\n') + '};\n';
  fs.writeFileSync('src/parts/peeps/cutout.gen.ts', out);
  console.log('wrote src/parts/peeps/cutout.gen.ts', (out.length / 1024).toFixed(0), 'KB');
}

const TINT: Record<PieceId, string> = {
  torso: '#4aa8ff', pelvis: '#ffd23f', aL1: '#ff5c5c', aL2: '#ff9f1c', aR1: '#2ec4b6', aR2: '#9b5de5',
  lL1: '#f15bb5', lL2: '#00bbf9', fL: '#8ac926', lR1: '#ff595e', lR2: '#6a4c93', fR: '#1982c4'
};

/** Each piece on its own, tinted, pulled apart from the others so overlaps and slivers show. */
function review(file: string): void {
  let body = '', x = 0;
  for (const f of FAMILIES) {
    const { g, masks } = pieces(f);
    const art = PEEP_STANDING.find(a => a.id === f.base);
    const ink = art?.l.filter(l => l[0] === 'i').map(l => `<path d="${l[1]}" fill="#141414" fill-rule="evenodd"/>`).join('') ?? '';
    const spread: Partial<Record<PieceId, Pt>> = { aL1: [-25, -10], aL2: [-35, 10], aR1: [25, -10], aR2: [35, 10], lL1: [-15, 15], lL2: [-25, 35], fL: [-30, 55], lR1: [15, 15], lR2: [25, 35], fR: [30, 55], pelvis: [0, 8] };
    let side = '', apart = '';
    for (const p of PIECES) {
      const d = pathOf(trace(g, masks.get(p) as Uint8Array, TOL));
      side += `<path d="${d}" fill="${TINT[p]}" fill-opacity=".55" stroke="${TINT[p]}" stroke-width=".3" fill-rule="evenodd"/>`;
      const o = spread[p] ?? [0, 0];
      apart += `<g transform="translate(${o[0]} ${o[1]})"><clipPath id="c${f.id}${p}"><path d="${d}" clip-rule="evenodd"/></clipPath><g clip-path="url(#c${f.id}${p})"><rect x="-200" y="-300" width="400" height="600" fill="${TINT[p]}" fill-opacity=".35"/>${ink}</g></g>`;
    }
    body += `<g transform="translate(${x + 200} 330)">${ink}${side}</g><g transform="translate(${x + 600} 330)">${apart}</g>`;
    x += 800;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="620" viewBox="0 0 ${x} 620"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
  fs.writeFileSync(file, new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 } }).render().asPng());
  console.log('wrote', file, 'at', R, 'px per unit');
}

/** For each joint's `across` segment: where the art starts and ends along it, the middle and half that span. */
function measure(): void {
  for (const f of FAMILIES) {
    const art = PEEP_STANDING.find(a => a.id === f.base), box = PEEP_BODY_BOX[f.base];
    if (!art || !box) continue;
    const g = rasterise(art.l, box, []);
    for (const [j, seg] of Object.entries(CUTS[f.id].across ?? {})) {
      if (!seg) continue;
      const sp = span(g, seg);
      if (!sp) continue;
      const [p0, p1] = sp, mid: Pt = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      console.log(`${f.id} ${j}: art ${p0.map(fmt)} to ${p1.map(fmt)}, middle ${mid.map(fmt)}, half ${fmt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2)}; now ${f.j[j as JointId]}`);
    }
  }
}

/** Side-by-side PNGs for judging by eye: the puppet next to real Open Peeps bodies drawn in the same kind of pose,
    in the same colours with the same head, plus a sheet of single joints bent step by step. */
async function compare(dir: string): Promise<void> {
  await loadBodyArt();
  fs.mkdirSync(dir, { recursive: true });
  const look = { skin: '#e9b996', hair: 'short-1', hairC: '#141414', topC: '#9fd0ff', botC: '#ffe08a', shoeC: '#ff9a4d' };
  const puppet = (id: string, t: Partial<PoseTargets>) => { const c = newCharacter({ ...look, id }); return charSVG({ ...c, pose: poseFrom(c, t) }); };
  const real = (id: string) => charSVG(newCharacter({ ...look, id: 'real-' + id, body: id }));
  const sheet = (file: string, cells: Array<[string, string]>, zoom = 1.6) => {
    let body = '';
    cells.forEach(([svg, label], i) => {
      body += `<g transform="translate(${i * 340 + 160} 300)">${svg}</g><text x="${i * 340 + 160}" y="532" font-size="15" font-family="sans-serif" text-anchor="middle" fill="#333">${label}</text>`;
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cells.length * 340}" height="550"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
    fs.writeFileSync(`${dir}/${file}`, new Resvg(svg, { fitTo: { mode: 'zoom', value: zoom } }).render().asPng());
    console.log('wrote', `${dir}/${file}`);
  };
  sheet('1-rest.png', [[real('stand-shirt-3'), 'Open Peeps: shirt-3'], [puppet('p', {}), 'Puppet at rest']]);
  sheet('2-arms-raised.png', [[real('stand-pointing-finger-1'), 'Open Peeps: pointing-finger-1'], [puppet('p', { aR: [[100, -110], 1] }), 'Puppet: far arm raised'],
    [puppet('q', (POSES.find(p => p.id === 'cheer') as PosePreset).t), 'Puppet: both arms up'], [puppet('r', (POSES.find(p => p.id === 'wave') as PosePreset).t), 'Puppet: waving']]);
  sheet('3-arms-crossed.png', [[real('stand-crossed-arms-1'), 'Open Peeps: crossed-arms-1'], [puppet('p', (POSES.find(p => p.id === 'crossed') as PosePreset).t), 'Puppet: arms crossed'],
    [puppet('q', (POSES.find(p => p.id === 'hips') as PosePreset).t), 'Puppet: hands on hips']]);
  sheet('4-walking.png', [[real('stand-walking-1'), 'Open Peeps: walking-1'], [puppet('p', (POSES.find(p => p.id === 'walk') as PosePreset).t), 'Puppet: walking'],
    [puppet('q', (POSES.find(p => p.id === 'point') as PosePreset).t), 'Puppet: pointing']]);
  sheet('5-sitting.png', [[real('sit-crossed-legs'), 'Open Peeps: crossed-legs'], [puppet('p', (POSES.find(p => p.id === 'sit') as PosePreset).t), 'Puppet: sitting']]);
  // single joints, 30 degrees a step, zoomed
  const bend = (l: 'aL' | 'lL', deg: number, i: number) => {
    const c = newCharacter({ ...look, id: 'b' + l + i }), pose = { ...c.pose, [l]: [c.pose[l][0] + (l === 'lL' ? deg * 0.6 : -deg * 0.5), c.pose[l][1] + (l === 'lL' ? -deg : deg), c.pose[l][2]] };
    return charSVG({ ...c, pose });
  };
  sheet('6-elbow-bends.png', [0, 30, 60, 90, 120, 150].map((d, i) => [bend('aL', d, i), `near elbow ${d} degrees`]), 1.3);
  sheet('7-knee-bends.png', [0, 30, 60, 90, 120, 145].map((d, i) => [bend('lL', d, i), `near knee ${d} degrees`]), 1.3);
}

if (process.argv[2] === 'measure') measure();
else if (process.argv[2] === 'compare') await compare(process.argv[3] ?? 'docs/cutout');
else if (process.argv[2] === 'review') review(process.argv[3] ?? 'cutout-review.png');
else generate();
