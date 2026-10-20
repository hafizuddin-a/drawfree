import type { TopPart } from '../types';
import { INK, circ, ln, shp, tags } from './draw';
import { torsoPath } from '../rig/geometry';

export const TOPS: TopPart[] = [
  { id: 'tee', name: 'T-shirt', tags: tags('tee shirt short sleeve casual'), sleeve: 32, sw: 20,
    draw: c => shp(torsoPath(-14), c) + ln('M-13,-168 Q0,-153 13,-168') + ln('M-27,-62 Q-19,-50 -23,-34', 1.8) + ln('M27,-58 Q19,-46 25,-32', 1.8) },
  { id: 'hoodie', name: 'Hoodie', tags: tags('hoodie sweatshirt hood long sleeve'), sleeve: 112, sw: 23,
    draw: c => shp(torsoPath(-4), c) + shp('M-26,-171 Q0,-134 26,-171 Q0,-179 -26,-171Z', c) +
               ln('M-20,-52 L20,-52 L25,-26 L-25,-26 Z') + ln('M-6,-146 L-7,-122', 2.4) + ln('M6,-146 L7,-122', 2.4) },
  { id: 'blazer', name: 'Blazer', tags: tags('blazer jacket formal office suit'), sleeve: 110, sw: 20,
    draw: c => shp(torsoPath(-2), c) + shp('M-11,-168 L0,-92 L11,-168 Z', '#ffffff') +
               shp('M-11,-168 L-27,-128 L-9,-104 L0,-92 L-5,-132 Z', c) + shp('M11,-168 L27,-128 L9,-104 L0,-92 L5,-132 Z', c) +
               circ(0, -70, 2.6, INK, 1) + ln('M-24,-30 H-12', 2.4) + ln('M12,-30 H24', 2.4) },
  { id: 'tank', name: 'Tank top', tags: tags('tank top sleeveless summer vest'), sleeve: 0, sw: 0,
    draw: (c, skin) => shp(torsoPath(-4), skin) + shp('M-24,-168 L-14,-168 Q0,-150 14,-168 L24,-168 L27,-140 L29,-60 L30,-10 L-30,-10 L-29,-60 L-27,-140 Z', c) },
  { id: 'sweater', name: 'Turtleneck', tags: tags('sweater turtleneck knit jumper long sleeve'), sleeve: 112, sw: 20,
    draw: c => shp(torsoPath(-8), c) + shp('M-14,-176 Q-14,-182 -7,-182 H7 Q14,-182 14,-176 V-166 Q14,-162 7,-162 H-7 Q-14,-162 -14,-166 Z', c) +
               ln('M-29.5,-20 L29.5,-20', 2.4) + ln('M-6,-181 V-163', 1.8) + ln('M6,-181 V-163', 1.8) },
  { id: 'jacket', name: 'Bomber jacket', tags: tags('jacket bomber zip coat long sleeve'), sleeve: 112, sw: 22,
    draw: c => shp(torsoPath(-2), c) + shp('M-12,-168 L-22,-158 L-8,-150 Z', c) + shp('M12,-168 L22,-158 L8,-150 Z', c) +
               ln('M0,-150 L0,-2') + ln('M-22,-46 H-10', 2.4) + ln('M10,-46 H22', 2.4) + ln('M-29.5,-14 H29.5', 2.4) }
];
