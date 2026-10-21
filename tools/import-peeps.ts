// One-off importer: reads the Open Peeps pack (CC0, https://www.openpeeps.com) from assets/open-peeps/
// and writes the art into src/parts/peeps/*.gen.ts as compact path data in the rig's local space.
// The pack is gitignored; the generated files are committed. Re-run after changing a mapping below.
// usage: tsx tools/import-peeps.ts
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { type Raster, innerPoint, regionAt, reviewSVG, segment, thickInk, trace } from './peeps-regions';

const ROOT = 'assets/open-peeps/Flat Assets';
const ATOMS = path.join(ROOT, 'Separate Atoms');
const OUT = 'src/parts/peeps';

/* ---------- SVG reading ---------- */

/** one filled path with the translate of every group above it already applied */
export interface RawPath { d: string; fill: string; layer: string; groups: string[]; tx: number; ty: number }

const attr = (s: string, name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(s)?.[1];

/** Walks a Sketch-exported SVG: nested <g transform="translate(..)"> and <path>, skipping <defs> and <mask>. */
export function readSvg(src: string): RawPath[] {
  const out: RawPath[] = [];
  const stack: Array<{ id: string; tx: number; ty: number; fill?: string }> = [{ id: '', tx: 0, ty: 0 }];
  let skip = 0;
  for (const m of src.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, rest, self] = m;
    if (tag === 'defs' || tag === 'mask') { if (!self) skip += close ? -1 : 1; continue; }
    if (skip) continue;
    if (tag === 'g') {
      if (close) { stack.pop(); continue; }
      const top = stack[stack.length - 1];
      const t = /translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)\s*\)/.exec(attr(rest, 'transform') ?? '');
      const g = { id: attr(rest, 'id') ?? '', tx: top.tx + (t ? +t[1] : 0), ty: top.ty + (t ? +t[2] : 0), fill: attr(rest, 'fill') ?? top.fill };
      if (!self) stack.push(g);
      continue;
    }
    if (tag === 'path' && !close) {
      const top = stack[stack.length - 1];
      const d = attr(rest, 'd');
      const fill = attr(rest, 'fill') ?? top.fill ?? '#000000';
      if (!d || fill === 'none') continue;
      out.push({ d, fill: fill.toUpperCase(), layer: attr(rest, 'id') ?? '', groups: stack.map(s => s.id).filter(Boolean), tx: top.tx, ty: top.ty });
    }
  }
  return out;
}

/* ---------- path maths ---------- */

type Pt = [number, number];
type Seg = { c: 'M' | 'L' | 'C' | 'Z'; p: Pt[] };

/** Parses absolute M, L, C and Z (all Sketch emits). Throws on anything else so a new pack fails loudly. */
export function parsePath(d: string): Seg[] {
  const segs: Seg[] = [];
  const re = /([MLCZmlcz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  let cmd = '', nums: number[] = [];
  const flush = () => {
    if (!cmd) return;
    const n = cmd === 'C' ? 6 : cmd === 'Z' ? 0 : 2;
    if (n === 0) { segs.push({ c: 'Z', p: [] }); return; }
    if (nums.length % n) throw new Error(`bad ${cmd} with ${nums.length} numbers`);
    for (let i = 0; i < nums.length; i += n) {
      const p: Pt[] = [];
      for (let j = 0; j < n; j += 2) p.push([nums[i + j], nums[i + j + 1]]);
      // extra pairs after M are implicit L
      segs.push({ c: (cmd === 'M' && i > 0 ? 'L' : cmd) as Seg['c'], p });
    }
  };
  for (const m of d.matchAll(re)) {
    if (m[1]) {
      flush();
      if (m[1] !== m[1].toUpperCase()) throw new Error(`relative command ${m[1]} not supported`);
      cmd = m[1]; nums = [];
    } else nums.push(+m[2]);
  }
  flush();
  return segs;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
/** shortest text for a number: no leading zero, no trailing .0 */
const num = (n: number): string => {
  const s = String(r1(n) || 0);
  return s.replace(/^(-?)0\./, '$1.');
};
/** joins numbers with the fewest separators: a minus sign separates by itself, so does a leading dot after a decimal */
function join(ns: number[]): string {
  let out = '', prevDot = false;
  for (const n of ns) {
    const s = num(n);
    const needsSep = out !== '' && !(s[0] === '-' || (s[0] === '.' && prevDot));
    out += (needsSep ? ' ' : '') + s;
    prevDot = s.includes('.');
  }
  return out;
}

/** Maps every point through `f`, rounds to 0.1 and writes compact relative path data. */
export function transformPath(segs: Seg[], f: (p: Pt) => Pt): string {
  let out = '', cur: Pt = [0, 0], start: Pt = [0, 0], last = '';
  for (const s of segs) {
    if (s.c === 'Z') { out += 'z'; cur = start; last = 'z'; continue; }
    const pts = s.p.map(p => { const q = f(p); return [r1(q[0]), r1(q[1])] as Pt; });
    const rel = pts.flatMap(p => [p[0] - cur[0], p[1] - cur[1]]);
    const c = s.c.toLowerCase();
    const body = join(rel);
    // repeat the command letter only when it changes (m is followed by implicit l, so write l explicitly after m)
    const letter = c === last && c !== 'm' ? '' : c;
    out += letter ? letter + body : (body[0] === '-' ? body : ' ' + body);
    cur = pts[pts.length - 1];
    if (c === 'm') start = cur;
    last = c;
  }
  return out;
}

/* ---------- placement ---------- */

/** Open Peeps head space to rig space. The point between the eyes (head-local 309,296) lands on the rig's (13.5,-214),
    and 0.144 makes the Peeps eyes as far apart as the rig's, so the skull fills the rig's head outline. */
export const K = 0.144;
const HEAD_ANCHOR: Pt = [309, 296];
const RIG_ANCHOR: Pt = [13.5, -214];
/** where each atom sits relative to the head, from the pack's composite files ("a person/*.svg"); every
    standing pose shares one canvas and neck position, and so does every sitting pose and every waist-up body */
export const IN_HEAD: Record<string, Pt> = {
  head: [0, 0], face: [159, 186], 'facial-hair': [123, 338], accessories: [47, 241],
  body: [-225, 459], 'pose/standing': [-525, 454], 'pose/sitting': [-426, 457]
};
export const headToRig = (p: Pt): Pt => [(p[0] - HEAD_ANCHOR[0]) * K + RIG_ANCHOR[0], (p[1] - HEAD_ANCHOR[1]) * K + RIG_ANCHOR[1]];

/* ---------- colour regions ---------- */

/** Which white areas of an atom take which colour, by a point inside each area (in the atom file's own coordinates).
    Unlisted white keeps the folder's default (WHITE: skin on heads, top colour on bodies). `cuts` are lines (also in file coordinates) that close gaps in the ink, so hair whose
    strokes stop short of the face still splits from it. Kinds: s skin, h hair, a hat, t top, b bottom (trousers, skirt),
    f footwear, w white. Found with `review`; `pick` turns region numbers from a review into seed points. */
const PAINT = ['s', 'h', 'a', 't', 'b', 'f', 'w'] as const;
type PaintKind = (typeof PAINT)[number];
/** `rest` overrides the folder default for every unlisted white area (the bike's frame is white, not the top colour) */
/** `holes`: points in see-through areas the ink encloses (a mug, a printed lightning bolt) to fill white */
interface RegionSpec { cuts?: Pt[][]; close?: number; rest?: PaintKind; holes?: Pt[]; paint: Partial<Record<PaintKind, Pt[]>> }
const REGIONS: Record<string, RegionSpec> = {
  'head/Bangs': { cuts: [[[166, 226], [404, 211]], [[158, 470], [208, 461]], [[120, 333], [95, 298]], [[92, 374], [112, 382]]], paint: { h: [[150, 120], [409, 464], [60, 450]] } },
  'head/Bun': { paint: { h: [[330, 51]], a: [[140, 85], [243, 88], [364, 86], [103, 204]] } },
  'head/Bun 2': { paint: { a: [[94, 99]] } },
  'head/Cornrows 2': { paint: { h: [[225, 64], [150, 67], [39, 85], [306, 87], [153, 108], [193, 111], [21, 144], [106, 181], [47, 197], [133, 210], [23, 285], [16, 348], [21, 425], [57, 448], [4, 481], [26, 523]] } },
  'head/Gray Bun': { paint: { h: [[60, 88], [178, 220]] } },
  'head/Gray Medium': { paint: { h: [[177, 207]] } },
  'head/Gray Short': { paint: { h: [[230, 105]] } },
  'head/hat-beanie': { paint: { a: [[104, 185]] } },
  'head/hat-hip': { paint: { a: [[82, 136]] } },
  'head/Medium Bangs 2': { cuts: [[[118, 302], [150, 306]], [[60, 236], [150, 224], [250, 212], [350, 200], [412, 194]]], paint: { h: [[63, 442], [250, 120]] } },
  'head/Mohawk': { cuts: [[[254, 134], [306, 134]]], paint: { h: [[285, 8], [200, 57], [294, 80]] } },
  'head/Mohawk 2': { cuts: [[[195, 68], [238, 96], [270, 104], [312, 88]]], paint: { h: [[122, 60], [61, 247], [104, 438], [262, 50]] } },
  'head/Short 4': { cuts: [[[60, 172], [300, 168], [405, 150]]], paint: { h: [[229, 44], [200, 110]] } },
  'head/Turban': { paint: { a: [[208, 180]] } },
  // bodies: white is the top colour unless listed (s skin, b trousers, f shoes, w white: soles, laces, prosthetics, highlights)
  'pose/standing/blazer-1': { paint: { s: [[680, 6], [701, 809], [1142, 893], [470, 1906]], b: [[808, 708]], f: [[886, 2194], [433, 2197]], w: [[830, 1927], [815, 2100], [830, 2126], [795, 2186]] } },
  'pose/standing/blazer-2': { paint: { s: [[680, 6], [700, 811], [1142, 894], [470, 1907]], w: [[882, 148], [877, 1312], [809, 1604], [830, 1928], [815, 2102], [830, 2128], [795, 2187]], f: [[886, 2196], [436, 2198]] } },
  'pose/standing/blazer-3': { paint: { s: [[678, 6], [698, 806], [1143, 889], [841, 2142], [437, 2160]], b: [[808, 707]], f: [[863, 2191], [435, 2193]] } },
  'pose/standing/blazer-4': { paint: { s: [[680, 6], [700, 807], [1142, 890], [844, 2143], [438, 2161]], w: [[881, 145]], f: [[863, 2192], [436, 2194]] } },
  'pose/standing/crossed_arms-1': { paint: { s: [[699, 6], [623, 387], [729, 516], [315, 2148], [874, 2158]], f: [[279, 2216], [969, 2239]], w: [[406, 2363], [839, 2369]] } },
  'pose/standing/crossed_arms-2': { paint: { s: [[698, 6], [634, 349], [973, 395], [746, 479], [332, 2110], [889, 2120]], b: [[467, 860], [1017, 1483]], w: [[1022, 2214], [1065, 2239], [250, 2228], [237, 2247], [225, 2267], [1083, 2271], [857, 2329], [416, 2324]] } },
  'pose/standing/easing-1': { paint: { s: [[686, 6], [499, 664], [1123, 697], [912, 2025], [274, 2032]], w: [[636, 159], [278, 2134], [110, 2414], [904, 2427]], f: [[944, 2105], [355, 2178]] } },
  'pose/standing/easing-2': { paint: { s: [[686, 6], [499, 664], [1123, 697], [912, 2025], [274, 2032]], b: [[913, 805]], w: [[278, 2134], [110, 2414], [904, 2427]], f: [[944, 2105], [355, 2178]] } },
  'pose/standing/pointing_finger-1': { paint: { s: [[684, 6], [1504, 100], [430, 881]], w: [[474, 1857], [900, 1862], [698, 2063], [407, 2137]] } },
  'pose/standing/pointing_finger-2': { paint: { s: [[684, 6], [1504, 100], [430, 881]], b: [[445, 828]], w: [[698, 2063], [407, 2137]] } },
  'pose/standing/polka_dots': { paint: { s: [[669, 6], [1102, 916], [352, 982], [466, 2085], [777, 2103]], b: [[1031, 914]], w: [[678, 2266], [435, 2363]] } },
  'pose/standing/resting-1': { paint: { s: [[693, 6], [699, 857], [1105, 925], [1235, 2066], [494, 2147]], w: [[1083, 1128]], f: [[1313, 2164], [671, 2265]] } },
  'pose/standing/resting-2': { paint: { s: [[693, 6], [1092, 921], [699, 857], [1233, 2066], [617, 2154]], w: [[1002, 379], [1542, 2303], [461, 2388]], b: [[466, 966]] } },
  'pose/standing/robot_dance-1': { paint: { s: [[684, 6], [1346, 631], [213, 783], [268, 2143], [1047, 2233]], f: [[384, 2272], [1107, 2309]], w: [[498, 2334], [184, 2410], [888, 2454]] } },
  'pose/standing/robot_dance-2': { paint: { s: [[684, 6], [1348, 629], [214, 782], [268, 2142], [1046, 2232]], w: [[1016, 307], [400, 474], [513, 2338], [185, 2409], [888, 2453]], b: [[553, 1111], [566, 1176]], f: [[384, 2271], [1107, 2307]] } },
  'pose/standing/robot_dance-3': { paint: { s: [[684, 6], [1348, 629], [214, 782], [268, 2142], [1046, 2232]], b: [[553, 1111], [566, 1176]], f: [[384, 2271], [1107, 2307]], w: [[513, 2338], [185, 2409], [888, 2453]] } },
  'pose/standing/shirt-1': { paint: { s: [[677, 6], [1181, 1019], [514, 1034], [838, 1531]], w: [[477, 1419], [791, 1466], [501, 1479], [499, 1726], [475, 1870], [435, 2131], [465, 2217], [388, 2218], [819, 2367], [337, 2462]], f: [[809, 2197], [427, 2252]] } },
  'pose/standing/shirt-2': { paint: { s: [[677, 6], [1181, 1019], [514, 1034], [838, 1531]], w: [[836, 222], [860, 329], [876, 447], [895, 565], [918, 684], [931, 827], [938, 937], [499, 1726], [475, 1870], [435, 2131], [465, 2217], [388, 2218], [819, 2367], [337, 2462]], b: [[582, 945], [477, 1419], [791, 1466]], f: [[809, 2197], [427, 2252]] } },
  'pose/standing/shirt-3': { paint: { s: [[677, 6], [1179, 1022], [513, 1035], [910, 2136], [383, 2169]], f: [[808, 2200], [432, 2253]], w: [[819, 2369], [336, 2462]] } },
  'pose/standing/shirt-4': { paint: { s: [[677, 6], [1179, 1022], [513, 1035], [910, 2136], [383, 2169]], w: [[832, 232], [858, 351], [871, 457], [889, 576], [913, 694], [926, 839], [932, 947], [819, 2369], [336, 2462]], b: [[583, 946]], f: [[808, 2200], [432, 2253]] } },
  'pose/standing/walking-1': { paint: { s: [[683, 6], [344, 386], [1029, 393], [335, 1902], [964, 2104]], f: [[315, 1848], [988, 2175]], w: [[212, 2083], [891, 2367]] } },
  'pose/standing/walking-2': { paint: { s: [[683, 6], [344, 386], [1029, 393], [335, 1902], [965, 2103]], b: [[791, 971]], f: [[315, 1848], [988, 2175]], w: [[212, 2083], [889, 2366]] } },
  'pose/standing/walking-3': { paint: { s: [[683, 6], [344, 386], [1029, 393], [335, 1902], [965, 2103]], w: [[891, 939], [436, 997], [212, 2083], [889, 2366]], f: [[315, 1848], [988, 2175]] } },
  'pose/sitting/bike': { rest: 'w', paint: { t: [[510, 48], [719, 77], [269, 389], [655, 710]], s: [[557, 6], [745, 623], [1028, 660], [1071, 644], [1071, 685]], f: [[671, 1766], [715, 1809]] } },
  'pose/sitting/closed_legs-1': { paint: { s: [[564, 6], [1166, 597], [972, 628]], w: [[754, 274], [757, 325], [790, 380], [808, 442], [800, 497], [1104, 776], [864, 879], [583, 1229], [1099, 1364], [1392, 1527], [1498, 1475]], f: [[1318, 1330], [1037, 1355]] } },
  'pose/sitting/closed_legs-2': { paint: { s: [[564, 6], [1166, 597], [972, 628]], w: [[500, 221], [819, 198], [754, 274], [893, 350], [302, 305], [586, 514], [917, 594], [1097, 1364], [1392, 1527], [1498, 1475]], b: [[1072, 495], [913, 501], [579, 720], [1079, 757], [825, 915]], f: [[1318, 1330], [1037, 1355]] } },
  'pose/sitting/crossed_legs': { paint: { s: [[576, 6], [974, 679], [1406, 777], [1064, 1526]], w: [[1126, 528], [792, 687]], f: [[1528, 766], [1196, 1590]] } },
  'pose/sitting/hands_back-1': { paint: { s: [[572, 6], [896, 368], [291, 396]], b: [[932, 800]], f: [[362, 1013], [814, 1201]] } },
  'pose/sitting/hands_back-2': { paint: { s: [[572, 6], [896, 368], [291, 396]], w: [[777, 1090], [839, 1122]], f: [[362, 1013], [814, 1201]] } },
  'pose/sitting/mid-1': { paint: { s: [[477, 6], [159, 142], [929, 287], [657, 934], [244, 1127]], b: [[6, 446], [1065, 606]], f: [[469, 947], [213, 1161]], w: [[109, 1368]] } },
  'pose/sitting/mid-2': { paint: { s: [[477, 6], [159, 142], [929, 287], [657, 934], [244, 1127]], f: [[469, 947], [213, 1161]], w: [[109, 1368]] } },
  'pose/sitting/one_leg_up-1': { paint: { s: [[563, 6], [194, 310], [937, 317], [650, 1237], [544, 1279]], b: [[290, 608], [1234, 886]], w: [[425, 1175], [603, 1414]], f: [[400, 1201], [699, 1266]] } },
  'pose/sitting/one_leg_up-2': { paint: { s: [[563, 6], [194, 310], [937, 317], [650, 1237], [544, 1279]], w: [[352, 828], [668, 1106], [912, 1018], [425, 1175], [603, 1414]], f: [[400, 1201], [699, 1266]] } },
  'pose/sitting/wheelchair': { rest: 'w', paint: { s: [[563, 6], [1415, 110], [621, 582], [1232, 1530]], t: [[510, 36], [773, 80], [741, 725]], b: [[1211, 717], [1092, 732]], f: [[1493, 1450], [1527, 1506], [1305, 1526]] } },
  'body/Blazer Black Tee': { paint: { s: [[405, 6]] } },
  'body/Button Shirt 2': { paint: { s: [[411, 6]] } },
  'body/Device': { paint: { s: [[404, 6], [633, 296], [681, 361], [663, 395]], w: [[667, 180]] } },
  'body/Dress': { paint: { s: [[420, 6], [749, 546], [88, 556]], w: [[71, 430], [108, 428], [69, 502], [723, 501]] } },
  'body/Explaining': { paint: { s: [[408, 6], [127, 213]] } },
  'body/Gym Shirt': { paint: { s: [[404, 6], [268, 93], [647, 131]] } },
  'body/Killer': { paint: { s: [[393, 6], [745, 523]], w: [[334, 95], [494, 204]] } },
  'body/Paper': { rest: 'w', paint: { s: [[405, 6], [749, 332], [681, 212]] } },
  'body/Pointing Up': { rest: 'w', paint: { s: [[405, 6], [807, 6], [781, 81], [747, 62], [811, 91]] } },
  'body/Polka Dot Jacket': { paint: { s: [[396, 6], [811, 208]] } },
  'body/Polo and Sweater': { rest: 'w', paint: { s: [[401, 6]] } },
  'body/Sporty Tee': { paint: { s: [[411, 6], [55, 415], [750, 440]], w: [[315, 73], [47, 358], [766, 401]] } },
  'body/Striped Pocket Tee': { paint: { s: [[401, 6], [-115, 345], [879, 402]], w: [[625, 304], [528, 308], [580, 313], [581, 341], [581, 373], [575, 402], [568, 430], [574, 457]] } },
  'body/Striped Tee': { paint: { s: [[405, 6], [81, 359], [750, 388]] } },
  'body/Sweater Dots': { rest: 'w', paint: { s: [[402, 6]] } },
  'body/Sweater': { paint: { s: [[401, 6], [270, 467], [401, 438], [303, 444], [339, 449], [390, 470]] } },
  'body/Tee 1': { paint: { s: [[414, 6], [69, 434]] } },
  'body/Tee 2': { paint: { s: [[407, 6], [55, 385], [757, 453]] } },
  'body/Tee Arms Crossed': { paint: { s: [[407, 6], [656, 374], [385, 379], [231, 398]] } },
  'body/Tee Selena': { paint: { s: [[413, 6], [77, 429], [746, 441]], w: [[583, 272], [637, 334]] } },
  'body/Thunder T-Shirt': { holes: [[470, 372]], paint: { s: [[401, 6], [84, 253], [739, 293]] } },
  'body/Turtleneck': { paint: { s: [[395, 6]] } },
  'body/Whatever': { paint: { s: [[407, 6], [7, 194], [-48, 182], [-24, 185], [2, 176], [905, 231], [812, 338], [729, 422], [75, 422]] } },
  'body/Gaming': { close: 8, paint: { s: [[411, 6], [547, 298], [751, 345], [739, 371]] } },
  'body/Coffee': { close: 8, holes: [[610, 410]], paint: { s: [[405, 6], [496, 346]] } },
  'body/Hoodie': { close: 8, paint: { s: [[422, 6]] } },
  'body/Button Shirt 1': { close: 16, paint: { s: [[407, 6]] } },
  'body/Macbook': { close: 16, paint: { s: [[420, 6], [542, 425], [474, 452], [360, 488], [577, 535], [731, 568]], w: [[812, 246]] } },
  'body/Shirt and Coat': { close: 16, paint: { s: [[405, 6]], w: [[406, 173], [546, 175], [411, 211], [415, 250], [420, 288], [425, 330], [480, 373], [536, 411], [438, 458], [503, 500], [529, 540], [452, 576], [482, 611], [461, 652]] } },
  'body/Fur Jacket': { cuts: [[[395,0],[440,60],[478,150]]], close: 8, rest: 'w', paint: { s: [[414, 6], [448, 62], [460, 137]] } }
};

/* ---------- output ---------- */

/** layer kinds the renderer fills: s = skin, h = hair colour, a = hat colour, w = white, i = ink, or a fixed '#rrggbb' */
type Layer = [kind: string, d: string];
/** `box`: bounds of every point in rig space [x0, y0, x1, y1] */
interface Atom { id: string; name: string; l: Layer[]; box: [number, number, number, number] }

const slug = (s: string): string => s.toLowerCase().replace(/^\*\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isInk = (fill: string): boolean => /^#(000000|221E1F|231F20)$/.test(fill);

/** white means skin on a head, light hair in facial hair, and plain white elsewhere (glasses) */
const WHITE: Record<string, string> = { head: 's', 'facial-hair': 'h', body: 't', 'pose/standing': 't', 'pose/sitting': 't' };
function kindOf(p: RawPath, cat: string): string {
  if (isInk(p.fill)) return 'i';
  if (p.fill === '#FFFFFF') return WHITE[cat] ?? 'w';
  return p.fill.toLowerCase();
}

const loopsToSegs = (loops: Pt[][]): Seg[] => loops.flatMap(l => [{ c: 'M', p: [l[0]] }, ...l.slice(1).map(p => ({ c: 'L', p: [p] }) as Seg), { c: 'Z', p: [] }] as Seg[]);

/** Extra colour layers for one atom: the painted regions of REGIONS, and for faces every hole the ink encloses
    (eye whites, teeth), which would otherwise show the skin through. */
/* Dark hair is solid ink in the pack, the same layer as the outlines. Its thick parts become a hair-coloured layer over
   the ink (with a thin ink ring left as the outline), so the hair colour reaches every hairstyle and beard. On a few
   heads the solid ink is a garment or a hat, which takes the hat colour instead. */
const THICK_INK: Record<string, 'h' | 'a'> = { head: 'h', 'facial-hair': 'h' };
const THICK_INK_AS: Record<string, 'a'> = { 'head/Hijab': 'a', 'head/hat-hip': 'a' };
/** source units: strokes thinner than 2 x ERODE disappear; REGROW < ERODE leaves the ink ring */
const ERODE = 14, REGROW = 6;

/** the layers that go over the ink: solid ink recoloured as hair (or hat) */
function overInk(cat: string, name: string, a: Source): Array<[string, Pt[][]]> {
  if (!a.inks.length) return [];
  if (cat === 'pose/standing' || cat === 'pose/sitting') return garmentInk(cat, name, a);
  const kind = THICK_INK_AS[`${cat}/${name}`] ?? THICK_INK[cat] ?? (cat === 'body' && !BUST_KEEP_INK.has(name) ? 't' : undefined);
  if (!kind) return [];
  const r = thickInk(a.width, a.height, a.inks, ERODE, REGROW);
  return r.regions[0].area > 20 ? [[kind, trace(r, [r.regions[0].mask], 0, 2)]] : [];
}

/* Black garments are solid ink too. A waist-up body's solid ink is its top, except where it is something else. */
const BUST_KEEP_INK = new Set(['Gaming', 'Blazer Black Tee']);
/* Full bodies come in families with the same geometry and different dark and light garments (resting-1 has a light
   top, resting-2 a dark one). The light garment's labelled area in a sibling tells which solid ink in this body is a
   top, trousers or shoes. */
const FAMILIES: readonly string[][] = [
  ['blazer-1', 'blazer-2'], ['blazer-3', 'blazer-4'], ['crossed_arms-1', 'crossed_arms-2'], ['easing-1', 'easing-2'],
  ['pointing_finger-1', 'pointing_finger-2'], ['resting-1', 'resting-2'], ['robot_dance-1', 'robot_dance-2', 'robot_dance-3'],
  ['shirt-1', 'shirt-2'], ['shirt-3', 'shirt-4'], ['walking-1', 'walking-2', 'walking-3'],
  ['closed_legs-1', 'closed_legs-2'], ['hands_back-1', 'hands_back-2'], ['mid-1', 'mid-2'], ['one_leg_up-1', 'one_leg_up-2']
];

/** the white areas of a body by colour kind (top, bottom, footwear), from its REGIONS labels */
function kindMasks(cat: string, name: string): Partial<Record<PaintKind, Uint8Array[]>> {
  const a = atomSource(path.join(ATOMS, cat, name + '.svg')), spec = REGIONS[`${cat}/${name}`];
  const top: Pt[] = [[-200, -1], [a.width + 200, -1]];
  const r = segment(a.width, a.height, a.fills, a.inks, [...(spec?.cuts ?? []), top], spec?.close);
  const kindOf = new Map<number, PaintKind>();
  for (const k of PAINT) for (const p of spec?.paint[k] ?? []) { const g = regionAt(r, p); if (g) kindOf.set(g.id, k); }
  const out: Partial<Record<PaintKind, Uint8Array[]>> = {};
  for (const g of r.regions) {
    const k = kindOf.get(g.id) ?? spec?.rest ?? 't';
    (out[k] ??= []).push(g.mask);
  }
  return out;
}

function garmentInk(cat: string, name: string, a: Source): Array<[string, Pt[][]]> {
  const fam = FAMILIES.find(f => f.includes(name));
  if (!fam) return [];
  const ink = thickInk(a.width, a.height, a.inks, ERODE, REGROW), solid = ink.regions[0].mask;
  const out: Array<[string, Pt[][]]> = [];
  const sibs = fam.filter(n => n !== name).map(n => kindMasks(cat, n));
  for (const k of ['t', 'b', 'f'] as const) {
    const area = new Uint8Array(solid.length);
    for (const m of sibs.flatMap(s => s[k] ?? [])) for (let i = 0; i < m.length; i++) if (m[i]) area[i] = 1;
    let n = 0;
    const mask = new Uint8Array(solid.length);
    for (let i = 0; i < solid.length; i++) if (solid[i] && area[i]) { mask[i] = 1; n++; }
    if (n > 400) out.push([k, trace(ink, [mask], 0, 2)]);
  }
  return out;
}

function colourLayers(cat: string, name: string, a: Source): Array<[string, Pt[][]]> {
  const out: Array<[string, Pt[][]]> = [];
  const spec = REGIONS[`${cat}/${name}`];
  if (spec) {
    // the canvas top is a boundary too: necks run off it, and above it a neck and a hood would join
    const top: Pt[] = [[-200, -1], [a.width + 200, -1]];
    const r = segment(a.width, a.height, a.fills, a.inks, [...(spec.cuts ?? []), top], spec.close);
    // a seed that lands in the face would paint the whole face: refuse it
    const face = cat === 'head' ? regionAt(r, HEAD_ANCHOR) : undefined;
    for (const kind of PAINT) {
      const seeds = spec.paint[kind];
      if (!seeds) continue;
      const masks = seeds.map(p => {
        const g = regionAt(r, p);
        if (!g) throw new Error(`${cat}/${name}: no region at ${p}`);
        if (g === face) throw new Error(`${cat}/${name}: the seed at ${p} is in the face`);
        return g.mask;
      });
      out.push([kind, trace(r, masks)]);
    }
  }
  if (spec?.holes) {
    const r = segment(a.width, a.height, [`M-1000 -1000H${a.width + 1000}V${a.height + 1000}H-1000Z`], [...a.inks, ...a.fills]);
    out.push(['w', trace(r, spec.holes.map(p => {
      const g = regionAt(r, p);
      if (!g) throw new Error(`${cat}/${name}: no see-through area at ${p}`);
      return g.mask;
    }))]);
  }
  if (cat === 'face') {
    const r: Raster = segment(a.width, a.height, [`M-1000 -1000H${a.width + 1000}V${a.height + 1000}H-1000Z`], a.inks);
    const holes = r.regions.filter(g => {
      for (let x = 0; x < r.w; x++) if (g.mask[x] || g.mask[(r.h - 1) * r.w + x]) return false;
      for (let y = 0; y < r.h; y++) if (g.mask[y * r.w] || g.mask[y * r.w + r.w - 1]) return false;
      return g.area > 2;
    });
    if (holes.length) out.push(['w', trace(r, holes.map(g => g.mask), 2)]);
  }
  return out;
}

function importDir(cat: string, prefix = ''): Atom[] {
  const dir = path.join(ATOMS, cat);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const off = IN_HEAD[cat];
  let box: Atom['box'] = [Infinity, Infinity, -Infinity, -Infinity];
  const toRig = (q: Pt): Pt => {
    const p = headToRig([q[0] + off[0], q[1] + off[1]]);
    box = [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[0]), Math.max(box[3], p[1])];
    return p;
  };
  return files.map(file => {
    box = [Infinity, Infinity, -Infinity, -Infinity];
    const name = file.replace(/\.svg$/, '').replace(/^\*\s*/, '');
    const a = atomSource(path.join(dir, file));
    const rest = REGIONS[`${cat}/${file.replace(/\.svg$/, '')}`]?.rest;
    const layers: Layer[] = a.raw.map(p => [rest && p.fill === '#FFFFFF' ? rest : kindOf(p, cat), transformPath(parsePath(p.d), q => toRig([q[0] + p.tx, q[1] + p.ty]))]);
    // colour regions go above the white silhouette and below the ink
    const extra: Layer[] = colourLayers(cat, file.replace(/\.svg$/, ''), a).map(([k, loops]) => [k, transformPath(loopsToSegs(loops), toRig)]);
    const firstInk = layers.findIndex(l => l[0] === 'i');
    layers.splice(firstInk < 0 ? layers.length : firstInk, 0, ...extra);
    layers.push(...overInk(cat, file.replace(/\.svg$/, ''), a).map(([k, loops]) => [k, transformPath(loopsToSegs(loops), toRig)] as Layer));
    return { id: prefix + slug(name), name, l: layers, box: box.map(Math.round) as Atom['box'] };
  });
}

function emit(file: string, lists: Array<[name: string, atoms: Atom[]]>): number {
  const arr = (atoms: Atom[]) => atoms.map(a => `  { id: ${JSON.stringify(a.id)}, name: ${JSON.stringify(a.name)}, l: [${a.l.map(([k, d]) => `[${JSON.stringify(k)}, ${JSON.stringify(d)}]`).join(', ')}] }`).join(',\n');
  const src = `/* Generated by tools/import-peeps.ts from Open Peeps by Pablo Stanley (CC0, see LICENSES.md). Do not edit. */\nimport type { PeepArt } from './art';\n` +
    lists.map(([name, atoms]) => `\nexport const ${name}: readonly PeepArt[] = [\n${arr(atoms)}\n];\n`).join('');
  fs.writeFileSync(path.join(OUT, file), src);
  return src.length;
}

/** generated file -> [export name, pack folder, id prefix] */
const OUTPUTS: Record<string, Array<[string, string, string?]>> = {
  'heads.gen.ts': [['PEEP_HEADS', 'head']],
  'faces.gen.ts': [['PEEP_FACES', 'face']],
  'facial.gen.ts': [['PEEP_FACIAL', 'facial-hair']],
  'accessories.gen.ts': [['PEEP_ACCESSORIES', 'accessories']],
  // the bodies are big, so they get their own file and are loaded on demand
  'bodies.gen.ts': [['PEEP_STANDING', 'pose/standing', 'stand-'], ['PEEP_SITTING', 'pose/sitting', 'sit-'], ['PEEP_BUSTS', 'body', 'bust-']]
};

interface Source { width: number; height: number; fills: string[]; inks: string[]; raw: RawPath[] }
/** an atom file's paths in its own coordinates, split into white fills and ink */
function atomSource(file: string): Source {
  const src = fs.readFileSync(file, 'utf8');
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(src);
  if (!vb) throw new Error(`no viewBox in ${file}`);
  const raw = readSvg(src);
  const own = (p: RawPath) => transformPath(parsePath(p.d), q => [q[0] + p.tx, q[1] + p.ty]);
  return { width: +vb[1], height: +vb[2], raw, fills: raw.filter(p => p.fill === '#FFFFFF').map(own), inks: raw.filter(p => isInk(p.fill)).map(own) };
}

/** `review out.png head/Bun ...`: numbered region maps, for choosing the seed points in REGIONS */
function review(out: string, names: string[]): void {
  const cells = names.map(n => {
    const a = atomSource(path.join(ATOMS, n + '.svg'));
    const r = segment(a.width, a.height, a.fills, a.inks, REGIONS[n]?.cuts, REGIONS[n]?.close ?? (process.env.CLOSE ? +process.env.CLOSE : 0));
    console.log(n, r.regions.filter(g => g.area > 30).map(g => `${g.id}:(${innerPoint(r, g).join(',')}) ${g.area.toFixed(0)}`).join('  '));
    // VIEW="x,y,w,h" crops every cell to that box, for a close look at one area
    const v = process.env.VIEW?.split(',').map(Number);
    const svg = reviewSVG(a.width, a.height, r, a.inks);
    return v ? { a: { ...a, width: v[2], height: v[3] }, svg: svg.replace(/width="[^"]*" height="[^"]*" viewBox="[^"]*"/, `width="${v[2]}" height="${v[3]}" viewBox="${v.join(' ')}"`) } : { a, svg };
  });
  const cw = Math.max(...cells.map(c => c.a.width)), ch = Math.max(...cells.map(c => c.a.height)), cols = Math.min(+(process.env.COLS ?? 4), cells.length);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${Math.ceil(cells.length / cols) * (ch + 40)}">` +
    cells.map((c, i) => `<g transform="translate(${(i % cols) * cw} ${Math.floor(i / cols) * (ch + 40)})">${c.svg.replace('<svg ', '<svg ')}<text x="10" y="${ch + 30}" font-size="28" font-family="sans-serif">${names[i]}</text></g>`).join('') + '</svg>';
  fs.writeFileSync(out, new Resvg(svg, { fitTo: { mode: 'width', value: Math.min(2400, cols * cw) * +(process.env.SCALE ?? 1) } }).render().asPng());
}

/** `pick "pose/standing/blazer-1 s:0,7,8 b:6 f:28,29" ...`: region numbers from a review -> a REGIONS entry */
function pick(lines: string[]): void {
  for (const line of lines) {
    // the name may contain spaces ("body/Tee Arms Crossed"); the groups are the "kind:ids" words after it
    const words = line.trim().split(/\s+/), first = words.findIndex(w => /^[a-z]+:/.test(w));
    const n = words.slice(0, first).join(' '), groups = words.slice(first);
    const a = atomSource(path.join(ATOMS, n + '.svg'));
    const r = segment(a.width, a.height, a.fills, a.inks, REGIONS[n]?.cuts, REGIONS[n]?.close ?? (process.env.CLOSE ? +process.env.CLOSE : 0));
    const paint = groups.filter(g => !g.startsWith('rest:')).map(g => {
      const [k, ids] = g.split(':');
      const pts = ids.split(',').map(id => innerPoint(r, r.regions[+id]));
      return `${k}: [${pts.map(p => `[${p[0]}, ${p[1]}]`).join(', ')}]`;
    });
    const close = REGIONS[n]?.close ?? (process.env.CLOSE ? +process.env.CLOSE : 0);
    const cuts = (REGIONS[n]?.cuts ? `cuts: ${JSON.stringify(REGIONS[n].cuts)}, ` : '') + (close ? `close: ${close}, ` : '');
    const rest = groups.find(g => g.startsWith('rest:'));
    console.log(`  '${n}': { ${cuts}${rest ? `rest: '${rest.slice(5)}', ` : ''}paint: { ${paint.join(', ')} } },`);
  }
}

if (process.argv[1]?.endsWith('import-peeps.ts') && process.argv[2] === 'review') {
  review(process.argv[3], process.argv.slice(4));
} else if (process.argv[1]?.endsWith('import-peeps.ts') && process.argv[2] === 'pick') {
  pick(process.argv.slice(3));
} else if (process.argv[1]?.endsWith('import-peeps.ts')) {
  if (!fs.existsSync(ATOMS)) { console.error(`Open Peeps pack not found at ${ATOMS}`); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv[2];
  for (const [file, lists] of Object.entries(OUTPUTS)) {
    if (only && only !== file) continue;
    const built = lists.map(([name, cat, prefix]) => [name, importDir(cat, prefix)] as [string, Atom[]]);
    console.log(`${file}: ${built.map(([n, a]) => `${n} ${a.length}`).join(', ')}, ${emit(file, built)} bytes`);
    if (file === 'bodies.gen.ts') {
      // the bounds ship in the main bundle (ground line, thumbnail framing) while the art itself loads later
      const rows = built.flatMap(([, atoms]) => atoms).map(a => `  ${JSON.stringify(a.id)}: [${a.box.join(', ')}]`).join(',\n');
      fs.writeFileSync(path.join(OUT, 'bodies.box.gen.ts'), `/* Generated by tools/import-peeps.ts. Do not edit. Bounds of each Open Peeps body in rig space: [x0, y0, x1, y1]. */\nexport const PEEP_BODY_BOX: Readonly<Record<string, readonly [number, number, number, number]>> = {\n${rows}\n};\n`);
    }
  }
}
