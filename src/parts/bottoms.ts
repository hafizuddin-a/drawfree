import type { BottomPart } from '../types';
import { ln, shp, tags } from './draw';

/** the seat of trousers and shorts: as wide as the top's hem, so the two meet without a step */
const block = (c: string) => shp('M-38,-30 L38,-30 L39,10 Q0,17 -39,10 Z', c);

export const BOTTOMS: BottomPart[] = [
  { id: 'jeans', name: 'Jeans', tags: tags('jeans trousers pants long denim'), leg: 172, lw: 31, stitch: true,
    pelvis: c => block(c) + ln('M0,-28 L0,0', 2.2) + ln('M-30,-26 Q-26,-15 -12,-13', 2) + ln('M30,-26 Q26,-15 12,-13', 2) },
  { id: 'shorts', name: 'Shorts', tags: tags('shorts short summer'), leg: 64, lw: 33,
    pelvis: c => block(c) },
  { id: 'skirt', name: 'Skirt', tags: tags('skirt mini pleated'), leg: 0, lw: 0,
    pelvis: c => shp('M-38,-30 L38,-30 L52,62 Q0,73 -52,62 Z', c) + ln('M-10,-24 L-14,64', 2.2) + ln('M10,-24 L14,64', 2.2) },
  { id: 'wide', name: 'Wide trousers', tags: tags('wide trousers pants loose baggy'), leg: 172, lw: 40,
    pelvis: c => block(c) + ln('M0,-28 L0,0', 2.2) + ln('M-30,-26 Q-26,-15 -12,-13', 2) + ln('M30,-26 Q26,-15 12,-13', 2) }
];
