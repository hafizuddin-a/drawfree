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
  { id: 'chair', name: 'Chair', tags: tags('chair seat furniture'),
    draw: () => shp('M-32,-52 H-24 V0 H-32Z', '#fff') + shp('M26,-52 H34 V0 H26Z', '#fff') +
                shp('M-38,-136 H-28 V-62 H-38Z', '#fff') + shp('M-38,-66 H40 V-52 H-38 Z', '#ffe08a') },
  { id: 'table', name: 'Table', tags: tags('table desk furniture coffee'),
    draw: () => shp('M-62,-72 H-54 V0 H-62Z', '#fff') + shp('M54,-72 H62 V0 H54Z', '#fff') + shp('M-74,-84 H74 V-70 H-74 Z', '#cfe8ff') +
                shp('M-8,-116 H12 V-84 H-8Z', '#fff') + ln('M12,-108 Q22,-108 22,-98 Q22,-92 12,-92', 2.6) }
];
