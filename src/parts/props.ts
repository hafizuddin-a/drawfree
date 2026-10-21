import type { PropPart } from '../types';
import { INK, esc, ln, shp, tags } from './draw';

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

export const PROPS: PropPart[] = [
  { id: 'bubble', name: 'Speech bubble', tags: tags('speech bubble dialogue talk text caption'), noFlip: true, text: 'Morning! Ready to shoot?',
    draw: p => {
      const lines = wrapText(p.text, 17), h = Math.max(64, 28 + lines.length * 24);
      const y0 = -h + (h - lines.length * 24) / 2 + 18;
      return shp(`M-100,${-h} H100 Q112,${-h} 112,${-h + 12} V-12 Q112,0 100,0 H-8 L-36,26 L-32,0 H-100 Q-112,0 -112,-12 V${-h + 12} Q-112,${-h} -100,${-h}Z`, '#fff') +
        lines.map((l, i) => `<text x="0" y="${y0 + i * 24}" text-anchor="middle" font-family="Figtree,system-ui,sans-serif" font-size="18" font-weight="600" fill="${INK}">${esc(l)}</text>`).join('');
    } },
  { id: 'plant', name: 'Potted plant', tags: tags('plant pot leaves green decor'),
    draw: () => shp('M0,-48 C-10,-92 -40,-102 -54,-132 C-20,-132 0,-102 0,-48Z', '#bfe3c0') +
                shp('M0,-48 C10,-100 30,-122 50,-152 C62,-112 30,-80 0,-48Z', '#bfe3c0') +
                shp('M0,-48 C-4,-110 4,-150 0,-178 C18,-150 14,-100 0,-48Z', '#bfe3c0') +
                shp('M-28,-50 H28 L21,0 H-21 Z', '#ffc7c2') + ln('M-30,-50 H30', 4) },
  // chair and table are sized for people: the seat at knee height, the table top at waist height
  { id: 'chair', name: 'Chair', tags: tags('chair seat furniture'),
    draw: () => shp('M-46,-75 H-35 V0 H-46Z', '#fff') + shp('M38,-75 H49 V0 H38Z', '#fff') +
                shp('M-55,-197 H-41 V-90 H-55Z', '#fff') + shp('M-55,-96 H58 Q61,-96 61,-92 V-79 Q61,-75 58,-75 H-55 Z', '#ffe08a') },
  { id: 'table', name: 'Table', tags: tags('table desk furniture coffee'),
    draw: () => shp('M-90,-104 H-78 V0 H-90Z', '#fff') + shp('M78,-104 H90 V0 H78Z', '#fff') + shp('M-107,-122 H107 V-102 H-107 Z', '#cfe8ff') +
                shp('M-12,-168 H17 V-126 Q17,-122 13,-122 H-8 Q-12,-122 -12,-126Z', '#fff') + ln('M17,-157 Q31,-157 31,-143 Q31,-134 17,-134') }
];
