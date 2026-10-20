import type { ShoePart } from '../types';
import { ln, shp, tags } from './draw';

const SOLE = '<path d="M-12,9 H28 V15 H-12 Z" fill="#fff" stroke="#141414" stroke-width="2.6" stroke-linejoin="round"/>';

export const SHOES: ShoePart[] = [
  { id: 'sneaker', name: 'Sneakers', tags: tags('sneakers trainers shoes casual'), boot: 0,
    draw: c => shp('M-11,-9 L9,-9 C14,-9 18,-4 26,1 C31,4 31,12 27,14 L-12,14 Z', c) + SOLE + ln('M2,-4 L8,-2', 2) + ln('M6,-1 L12,1', 2) },
  { id: 'boot', name: 'Boots', tags: tags('boots tall shoes'), boot: 46,
    draw: c => shp('M-12,-12 H11 V-2 C20,0 29,5 29,12 V15 H-12 Z', c) + SOLE },
  { id: 'sandal', name: 'Sandals', tags: tags('sandals summer open'), boot: 0,
    draw: (c, skin) => shp('M-9,-8 L9,-8 C14,-6 20,0 26,8 L26,12 L-9,12 Z', skin) + ln('M-9,-2 L10,2', 2) + ln('M-9,4 L12,7', 2) + shp('M-10,10 H27 V15 H-10 Z', c, 2.6) },
  { id: 'bare', name: 'Barefoot', tags: tags('bare barefoot none'), boot: 0,
    draw: (_c, skin) => shp('M-9,-8 L9,-8 C14,-6 20,0 26,8 L26,13 L-9,13 Z', skin) }
];
