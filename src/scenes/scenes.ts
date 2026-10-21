/* Line-art backdrops drawn in the 960x540 frame space. The ground line sits at y=458. */
import type { Frame, Scene } from '../types';
import { tags } from '../parts/draw';
import { type Pt, arc, cb, ell, qd, rect, sketch } from '../parts/sketch';
import { lum } from './backgrounds';

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
/* Flat fills under the ink lines, in the Open Peeps manner: a white wash for windows, doors and buildings (it reads on
   every pastel background), and a few soft accents. Each is an attribute string for a fill shape. */
const F = 'fill="#fff" fill-opacity=".55"', SUN = 'fill="#ffe08a" fill-opacity=".8"', LEAF = 'fill="#bfe3c0" fill-opacity=".8"';
const SAND = 'fill="#ffe9cf" fill-opacity=".8"', SEA = 'fill="#cfe8ff" fill-opacity=".7"';

/** a leafy canopy or a cloud: a circle with soft bumps */
function bumpy(cx: number, cy: number, r: number, bumps: number, ry = r): Pt[] {
  return range(90).map(j => {
    const t = (j / 90) * Math.PI * 2, k = 0.9 + 0.1 * Math.abs(Math.sin((t * bumps) / 2));
    return [cx + r * k * Math.cos(t), cy + ry * k * Math.sin(t)] as Pt;
  });
}
/** a run of small waves from x0 to x1 at height y */
const waves = (x0: number, x1: number, y: number, w = 30): Pt[] =>
  range(Math.round((x1 - x0) / w)).flatMap(i => qd([x0 + i * w, y], [x0 + i * w + w / 2, y - 9], [x0 + (i + 1) * w, y], 6));

export const SCENES: Scene[] = [
  { id: 'none', name: 'Plain', tags: tags('plain blank none empty'), draw: () => {} },
  { id: 'room', name: 'Living room', tags: tags('room indoor home window sofa interior'),
    draw: k => {
      k.line([[0, 458], [960, 458]]); k.line([[0, 436], [960, 436]]);
      k.shape(rect(90, 80, 190, 230), F); k.line([[185, 80], [185, 310]]); k.line([[90, 195], [280, 195]]);
      k.line([[52, 64], [318, 64]]);
      k.line(qd([66, 66], [100, 190], [62, 330])); k.line(qd([304, 66], [270, 190], [308, 330]));
      k.shape(rect(420, 90, 120, 86), F); k.line([[434, 162], [462, 128], [484, 150], [502, 134], [526, 162]]);
      k.shape(rect(570, 110, 76, 110), F); k.shape(ell(608, 150, 14), SUN);
      k.line([[690, 236], [900, 236]]);
      k.shape(rect(712, 200, 40, 36)); k.shape(rect(772, 180, 30, 56), F); k.shape([[830, 236], [838, 202], [878, 206], [872, 236]]);
      k.shape(ell(480, 502, 270, 22), F);
      k.line([[880, 458], [880, 330]]); k.line([[860, 458], [900, 458]]); k.shape([[860, 330], [900, 330], [892, 286], [868, 286]], SUN);
    } },
  { id: 'cafe', name: 'Café front', tags: tags('cafe shop street store building awning outdoor'),
    draw: k => {
      k.line([[0, 458], [960, 458]]); k.line([[0, 476], [960, 476]]);
      // the awning, its stripes, and a scalloped edge
      k.shape([[110, 118], [850, 118], [872, 188], ...range(8).flatMap(i => qd([872 - i * 98, 188], [823 - i * 98, 210], [774 - i * 98, 188], 8)).slice(1)], SUN);
      for (const i of range(7)) k.line([[110 + (i + 1) * 89.5, 118], [88 + (i + 1) * 98, 188]]);
      for (const x of [150, 570]) {
        k.shape(rect(x, 224, 250, 186), F);
        k.line([[x + 26, 270], [x + 60, 240]], 2); k.line([[x + 26, 296], [x + 86, 244]], 2);
        k.line([[x - 10, 410], [x + 260, 410]]);
      }
      k.shape(rect(432, 212, 106, 246), F); k.shape(rect(452, 232, 66, 84)); k.raw('<circle cx="520" cy="338" r="4.5"/>');
      k.line([[60, 118], [60, 40], [180, 40], [180, 90]]); k.shape(rect(780, 70, 90, 28), F);
    } },
  { id: 'park', name: 'Park', tags: tags('park outdoor trees bench nature sun garden'),
    draw: k => {
      k.line([[0, 458], [960, 458]]);
      k.shape(ell(840, 92, 40), SUN);
      for (const i of range(8)) { const a = (i * Math.PI) / 4; k.line([[840 + 54 * Math.cos(a), 92 + 54 * Math.sin(a)], [840 + 66 * Math.cos(a), 92 + 66 * Math.sin(a)]]); }
      k.line([...qd([120, 150], [150, 124], [190, 142]), ...qd([190, 142], [224, 124], [254, 150]).slice(1)]);
      k.line([...qd([520, 110], [546, 90], [576, 104]), ...qd([576, 104], [604, 90], [628, 110]).slice(1)]);
      k.line([...qd([0, 392], [200, 336], [400, 388], 20), ...qd([400, 388], [600, 440], [800, 372], 20).slice(1), ...qd([800, 372], [900, 340], [960, 396], 10).slice(1)]);
      for (const [x, y, r] of [[120, 272, 74], [830, 286, 66]]) {
        k.line([[x, 458], [x, y + r * 0.6]], 3.2); k.line([[x, y + r * 0.95], [x + 20, y + r * 0.6]]);
        k.shape(bumpy(x, y, r, 9), LEAF);
      }
      k.line([[350, 458], [350, 410]]); k.line([[530, 458], [530, 410]]);
      k.shape(rect(330, 398, 226, 12), F); k.line([[338, 372], [548, 372]]); k.line([[338, 384], [548, 384]]);
      k.line([[346, 398], [342, 366]]); k.line([[540, 398], [544, 366]]);
      for (const i of range(12)) k.line([[40 + i * 80, 474], [46 + i * 80, 464], [52 + i * 80, 474], [48 + i * 80, 462]], 2);
    } },
  { id: 'city', name: 'City skyline', tags: tags('city skyline buildings urban downtown street'),
    draw: k => {
      k.line([[0, 458], [960, 458]]);
      for (const [x, h, w] of [[50, 210, 110], [180, 150, 92], [292, 290, 130], [452, 190, 100], [572, 310, 124], [724, 220, 110], [850, 160, 92]]) {
        k.shape(rect(x, 458 - h, w, h), F);
        for (const j of range(Math.floor((h - 24) / 34))) for (const c of range(Math.floor((w - 20) / 28)))
          k.raw(`<rect x="${x + 14 + c * 28}" y="${458 - h + 18 + j * 34}" width="11" height="15" rx="2"/>`);
      }
      k.line([[357, 168], [357, 130]]); k.line([[634, 148], [634, 112]]); k.shape(ell(634, 108, 5), SUN);
    } },
  { id: 'beach', name: 'Beach', tags: tags('beach sea ocean sun palm summer waves'),
    draw: k => {
      k.wash([[0, 300], [960, 300], [960, 458], [0, 458]], SEA);
      k.wash([...qd([0, 430], [480, 404], [960, 430], 20), [960, 458], [0, 458]], SAND);
      k.shape([...arc(720, 300, 60, 60, 180, 360)], SUN);
      k.line([[0, 300], [960, 300]]); k.line(qd([0, 430], [480, 404], [960, 430], 20)); k.line([[0, 458], [960, 458]]);
      for (const [x0, x1, y] of [[60, 240, 336], [420, 600, 350], [120, 360, 372], [640, 860, 366], [300, 480, 394]]) k.line(waves(x0, x1, y));
      k.line(cb([840, 458], [850, 400], [840, 340], [816, 290]), 3.4);
      for (const [c, tip] of [[[786, 270], [744, 312]], [[790, 250], [756, 262]], [[836, 250], [870, 246]], [[856, 270], [890, 304]]] as Array<[Pt, Pt]>)
        k.shape([...qd([816, 290], c, tip, 10), ...qd(tip, [(c[0] + 816) / 2, (c[1] + 300) / 2 + 12], [816, 290], 10).slice(1)], LEAF);
    } },
  { id: 'studio', name: 'Studio', tags: tags('studio backdrop light stand photo set'),
    draw: k => {
      k.line(qd([0, 420], [480, 372], [960, 420], 24)); k.line([[0, 458], [960, 458]]);
      for (const x of [110, 850]) {
        k.line([[x, 458], [x, 250]]); k.line([[x - 40, 458], [x, 430], [x + 40, 458]]);
        k.shape([[x - 28, 250], [x + 28, 250], [x + 18, 206], [x - 18, 206]], F);
      }
      k.shape(ell(480, 470, 230, 10), F);
    } },
  { id: 'grid', name: 'Grid paper', tags: tags('grid paper graph squares blueprint'),
    draw: k => {
      for (const i of range(23)) k.line([[(i + 1) * 40, 0], [(i + 1) * 40, 540]], 1.4);
      for (const i of range(13)) k.line([[0, (i + 1) * 40], [960, (i + 1) * 40]], 1.4);
    } },
  { id: 'dots', name: 'Dot grid', tags: tags('dots dot grid bullet journal'),
    draw: k => { for (const r of range(12)) for (const c of range(23)) k.raw(`<circle cx="${(c + 1) * 40}" cy="${(r + 1) * 40}" r="2.6"/>`); } }
];
const sceneById = new Map(SCENES.map(s => [s.id, s] as const));
export const hasScene = (id: unknown): id is string => typeof id === 'string' && sceneById.has(id);

/** Scene linework: hand-drawn brush lines a little heavier than the characters', drawn soft (the ink layer as a whole is
    faded, so crossing strokes do not darken) to stay quieter than the characters in front of it. The ink colour
    follows the background's brightness. */
export function sceneSVG(f: Pick<Frame, 'scene' | 'bg'>): string {
  const s = sceneById.get(f.scene || 'none');
  if (!s || s.id === 'none') return '';
  const k = sketch(s.id, { w: 2.8, amp: 1.6 });
  s.draw(k);
  const [fills, ink] = k.done(), lc = lum(f.bg) > 0.45 ? '#141414' : '#ffffff';
  return `<g>${fills}</g><g fill="${lc}" opacity=".4">${ink}</g>`;
}
export const frameBG = (f: Pick<Frame, 'scene' | 'bg'>, round?: boolean): string =>
  `<rect width="960" height="540"${round ? ' rx="14"' : ''} fill="${f.bg}"/>` + sceneSVG(f);
