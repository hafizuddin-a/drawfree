// One-off importer: reads the Open Peeps pack (CC0, https://www.openpeeps.com) from assets/open-peeps/
// and writes the art into src/parts/peeps/*.gen.ts as compact path data in the rig's local space.
// The pack is gitignored; the generated files are committed. Re-run after changing a mapping below.
// usage: tsx tools/import-peeps.ts
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { type Raster, innerPoint, regionAt, reviewSVG, segment, trace } from './peeps-regions';

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
/** where each head-layer atom sits inside the head, from the pack's composite files */
export const IN_HEAD: Record<string, Pt> = { head: [0, 0], face: [159, 186], 'facial-hair': [123, 338], accessories: [47, 241] };
export const headToRig = (p: Pt): Pt => [(p[0] - HEAD_ANCHOR[0]) * K + RIG_ANCHOR[0], (p[1] - HEAD_ANCHOR[1]) * K + RIG_ANCHOR[1]];

/* ---------- colour regions ---------- */

/** Which white areas of an atom take which colour, by a point inside each area (in the atom file's own coordinates).
    Unlisted white stays skin. `cuts` are lines (also in file coordinates) that close gaps in the ink, so hair whose
    strokes stop short of the face still splits from it. Kinds: h = hair colour, a = hat colour. Found with `review`. */
interface RegionSpec { cuts?: Pt[][]; paint: Partial<Record<'h' | 'a', Pt[]>> }
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
  'head/Turban': { paint: { a: [[208, 180]] } }
};

/* ---------- output ---------- */

/** layer kinds the renderer fills: s = skin, h = hair colour, a = hat colour, w = white, i = ink, or a fixed '#rrggbb' */
type Layer = [kind: string, d: string];
interface Atom { id: string; name: string; l: Layer[] }

const slug = (s: string): string => s.toLowerCase().replace(/^\*\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isInk = (fill: string): boolean => /^#(000000|221E1F|231F20)$/.test(fill);

/** white means skin on a head, light hair in facial hair, and plain white elsewhere (glasses) */
const WHITE: Record<string, string> = { head: 's', 'facial-hair': 'h' };
function kindOf(p: RawPath, cat: string): string {
  if (isInk(p.fill)) return 'i';
  if (p.fill === '#FFFFFF') return WHITE[cat] ?? 'w';
  return p.fill.toLowerCase();
}

const loopsToSegs = (loops: Pt[][]): Seg[] => loops.flatMap(l => [{ c: 'M', p: [l[0]] }, ...l.slice(1).map(p => ({ c: 'L', p: [p] }) as Seg), { c: 'Z', p: [] }] as Seg[]);

/** Extra colour layers for one atom: the painted regions of REGIONS, and for faces every hole the ink encloses
    (eye whites, teeth), which would otherwise show the skin through. */
function colourLayers(cat: string, name: string, a: Source): Array<[string, Pt[][]]> {
  const out: Array<[string, Pt[][]]> = [];
  const spec = REGIONS[`${cat}/${name}`];
  if (spec) {
    const r = segment(a.width, a.height, a.fills, a.inks, spec.cuts);
    // a seed that lands in the face would paint the whole face: refuse it
    const face = cat === 'head' ? regionAt(r, HEAD_ANCHOR) : undefined;
    for (const kind of ['h', 'a'] as const) {
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
  if (cat === 'face') {
    const r: Raster = segment(a.width, a.height, [`M0 0H${a.width}V${a.height}H0Z`], a.inks);
    const holes = r.regions.filter(g => {
      for (let x = 0; x < r.w; x++) if (g.mask[x] || g.mask[(r.h - 1) * r.w + x]) return false;
      for (let y = 0; y < r.h; y++) if (g.mask[y * r.w] || g.mask[y * r.w + r.w - 1]) return false;
      return g.area > 2;
    });
    if (holes.length) out.push(['w', trace(r, holes.map(g => g.mask), 2)]);
  }
  return out;
}

function importDir(cat: string): Atom[] {
  const dir = path.join(ATOMS, cat);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const off = IN_HEAD[cat];
  const toRig = (q: Pt): Pt => headToRig([q[0] + off[0], q[1] + off[1]]);
  return files.map(file => {
    const name = file.replace(/\.svg$/, '').replace(/^\*\s*/, '');
    const a = atomSource(path.join(dir, file));
    const layers: Layer[] = a.raw.map(p => [kindOf(p, cat), transformPath(parsePath(p.d), q => toRig([q[0] + p.tx, q[1] + p.ty]))]);
    // colour regions go above the white silhouette and below the ink
    const extra: Layer[] = colourLayers(cat, file.replace(/\.svg$/, ''), a).map(([k, loops]) => [k, transformPath(loopsToSegs(loops), toRig)]);
    const firstInk = layers.findIndex(l => l[0] === 'i');
    layers.splice(firstInk < 0 ? layers.length : firstInk, 0, ...extra);
    return { id: slug(name), name, l: layers };
  });
}

function emit(file: string, name: string, atoms: Atom[]): number {
  const body = atoms.map(a => `  { id: ${JSON.stringify(a.id)}, name: ${JSON.stringify(a.name)}, l: [${a.l.map(([k, d]) => `[${JSON.stringify(k)}, ${JSON.stringify(d)}]`).join(', ')}] }`).join(',\n');
  const src = `/* Generated by tools/import-peeps.ts from Open Peeps by Pablo Stanley (CC0, see LICENSES.md). Do not edit. */\nimport type { PeepArt } from './art';\n\nexport const ${name}: readonly PeepArt[] = [\n${body}\n];\n`;
  fs.writeFileSync(path.join(OUT, file), src);
  return src.length;
}

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
    const r = segment(a.width, a.height, a.fills, a.inks, REGIONS[n]?.cuts);
    console.log(n, r.regions.filter(g => g.area > 30).map(g => `${g.id}:(${innerPoint(r, g).join(',')}) ${g.area.toFixed(0)}`).join('  '));
    return { a, svg: reviewSVG(a.width, a.height, r, a.inks) };
  });
  const cw = Math.max(...cells.map(c => c.a.width)), ch = Math.max(...cells.map(c => c.a.height)), cols = Math.min(+(process.env.COLS ?? 4), cells.length);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${Math.ceil(cells.length / cols) * (ch + 40)}">` +
    cells.map((c, i) => `<g transform="translate(${(i % cols) * cw} ${Math.floor(i / cols) * (ch + 40)})">${c.svg.replace('<svg ', '<svg ')}<text x="10" y="${ch + 30}" font-size="28" font-family="sans-serif">${names[i]}</text></g>`).join('') + '</svg>';
  fs.writeFileSync(out, new Resvg(svg, { fitTo: { mode: 'width', value: Math.min(2400, cols * cw) * +(process.env.SCALE ?? 1) } }).render().asPng());
}

if (process.argv[1]?.endsWith('import-peeps.ts') && process.argv[2] === 'review') {
  review(process.argv[3], process.argv.slice(4));
} else if (process.argv[1]?.endsWith('import-peeps.ts')) {
  if (!fs.existsSync(ATOMS)) { console.error(`Open Peeps pack not found at ${ATOMS}`); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  for (const [cat, file, name] of [['head', 'heads.gen.ts', 'PEEP_HEADS'], ['face', 'faces.gen.ts', 'PEEP_FACES'], ['facial-hair', 'facial.gen.ts', 'PEEP_FACIAL'], ['accessories', 'accessories.gen.ts', 'PEEP_ACCESSORIES']] as const) {
    const atoms = importDir(cat);
    console.log(`${file}: ${atoms.length} parts, ${emit(file, name, atoms)} bytes`);
  }
}
