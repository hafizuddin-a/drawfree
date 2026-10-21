import type { ShoePart } from '../types';
import { ln, shp, tags } from './draw';

/** a thick white sole with rounded ends, like the Open Peeps sneakers */
const SOLE = shp('M-14,11 H32 C35,11 35.5,17 32,17 H-12 C-15.5,17 -15.5,11 -14,11 Z', '#ffffff');

export const SHOES: ShoePart[] = [
  { id: 'sneaker', name: 'Sneakers', tags: tags('sneakers trainers shoes casual'), boot: 0,
    draw: c => shp('M-12,-8 C-6,-11 5,-11 9,-7 C15,-3 23,0 29,4 C34,7 34,12 30,13 L-13,13 C-15,6 -15,-3 -12,-8 Z', c) + SOLE + ln('M3,-6 L9,-2', 1.6) + ln('M8,-3 L14,1', 1.6) + ln('M13,0 L19,3', 1.6) },
  { id: 'boot', name: 'Boots', tags: tags('boots tall shoes'), boot: 46,
    draw: c => shp('M-12,-12 H11 V-2 C20,0 29,5 29,12 V15 H-12 Z', c) + SOLE },
  { id: 'sandal', name: 'Sandals', tags: tags('sandals summer open'), boot: 0,
    draw: (c, skin) => shp('M-9,-8 L9,-8 C14,-6 20,0 26,8 L26,12 L-9,12 Z', skin) + ln('M-9,-2 L10,2', 2) + ln('M-9,4 L12,7', 2) + shp('M-10,10 H27 V15 H-10 Z', c, 2.6) },
  { id: 'bare', name: 'Barefoot', tags: tags('bare barefoot none'), boot: 0,
    draw: (_c, skin) => shp('M-9,-8 L9,-8 C14,-6 20,0 26,8 L26,13 L-9,13 Z', skin) }
];
