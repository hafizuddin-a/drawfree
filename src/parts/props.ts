import type { PropPart } from '../types';
import { INK, W, esc, tags } from './draw';
import { type Pt, arc, cb, qd, rect, sketch } from './sketch';

/** greedy word wrap, at most 5 lines */
const wrapText = (t: string | undefined, n: number): string[] => {
  const out: string[] = [];
  let cur = '';
  String(t || '').split(/\s+/).forEach(w => {
    if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  });
  if (cur) out.push(cur);
  return out.slice(0, 5);
};

/** a prop drawn by hand: outlines in Open Peeps ink, fills under them in drawing order */
const hand = (seed: string, draw: (k: ReturnType<typeof sketch>) => void): string => {
  const k = sketch(seed, { w: W, amp: 0.9, ink: INK });
  draw(k);
  return k.done()[0];
};
const WHITE = 'fill="#fff"';

/** the bubble outline: a soft box with a tail, `h` tall above y=0 */
const bubble = (h: number): Pt[] => [
  ...arc(-98, -h + 14, 14, 14, 180, 270), ...arc(98, -h + 14, 14, 14, 270, 360), ...arc(98, -14, 14, 14, 0, 90),
  [-6, 0], [-38, 27], [-30, 0], ...arc(-98, -14, 14, 14, 90, 180)
];

export const PROPS: PropPart[] = [
  { id: 'bubble', name: 'Speech bubble', tags: tags('speech bubble dialogue talk text caption'), noFlip: true, text: 'Morning! Ready to shoot?',
    draw: p => {
      const lines = wrapText(p.text, 17), h = Math.max(64, 28 + lines.length * 24);
      const y0 = -h + (h - lines.length * 24) / 2 + 18;
      return hand(`bubble${h}`, k => k.shape(bubble(h), WHITE)) +
        lines.map((l, i) => `<text x="0" y="${y0 + i * 24}" text-anchor="middle" font-family="Figtree,system-ui,sans-serif" font-size="18" font-weight="600" fill="${INK}">${esc(l)}</text>`).join('');
    } },
  { id: 'plant', name: 'Potted plant', tags: tags('plant pot leaves green decor'),
    draw: () => hand('plant', k => {
      const leaf = (tip: Pt, c1: Pt, c2: Pt) => {
        k.shape([...cb([0, -50], c1, [tip[0] - (tip[0] - c2[0]) * 0.2, tip[1] + 6], tip), ...cb(tip, c2, [c2[0] * 0.3, -60], [0, -50])], 'fill="#bfe3c0"');
        k.line(qd([0, -52], [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2], [tip[0] * 0.8, tip[1] * 0.8 - 10]), W * 0.7);
      };
      leaf([-58, -134], [-14, -98], [-48, -96]);
      leaf([54, -156], [10, -110], [52, -112]);
      leaf([2, -184], [-14, -120], [20, -140]);
      k.shape([[-27, -46], [27, -46], [21, 0], [-21, 0]], 'fill="#ffc7c2"');
      k.shape(rect(-31, -56, 62, 12), 'fill="#ffc7c2"');
      k.line([[-12, -34], [-10, -10]], W * 0.7);
    }) },
  // chair and table are sized for people: the seat at knee height, the table top at waist height
  { id: 'chair', name: 'Chair', tags: tags('chair seat furniture'),
    draw: () => hand('chair', k => {
      k.shape(rect(-46, -76, 10, 76), WHITE); k.shape(rect(39, -76, 10, 76), WHITE);
      k.shape([[-56, -196], [-42, -198], [-40, -92], [-54, -92]], WHITE);
      k.shape([[-56, -96], [60, -96], [62, -76], [-56, -76]], 'fill="#ffe08a"');
      k.line([[-52, -170], [-44, -170]], W * 0.7);
    }) },
  { id: 'table', name: 'Table', tags: tags('table desk furniture coffee'),
    draw: () => hand('table', k => {
      k.shape(rect(-90, -104, 12, 104), WHITE); k.shape(rect(78, -104, 12, 104), WHITE);
      k.shape([[-108, -122], [108, -122], [106, -103], [-106, -103]], 'fill="#cfe8ff"');
      k.line(arc(17, -146, 13, 11, -90, 90));
      k.shape([[-12, -168], [17, -168], [16, -128], [12, -122], [-8, -122], [-11, -128]], WHITE);
      k.line([[-12, -158], [16, -158]], W * 0.7);
      k.line(cb([-2, -176], [-8, -186], [6, -192], [0, -204]), W * 0.7);
      k.line(cb([8, -178], [2, -186], [14, -190], [9, -200]), W * 0.7);
    }) }
];
