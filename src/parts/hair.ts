import type { HairPart } from '../types';
import { INK, blob, circ, ln, shp, tags } from './draw';

/* hair: the back layer sits behind the head, the front layer on top */
export const HAIR: HairPart[] = [
  { id: 'none', name: 'Bald', tags: tags('bald none shaved'), back: () => '', front: () => '' },
  { id: 'crop', name: 'Crop cut', tags: tags('short crop neat'),
    back: () => '',
    front: c => shp('M-29,-216 C-37,-246 -14,-263 8,-260 C30,-258 40,-240 33,-221 C31,-229 27,-233 22,-234 C15,-229 6,-234 -2,-232 C-12,-231 -21,-226 -25,-214 Z', c) + ln('M-14,-250 Q-4,-256 8,-254', 2) + ln('M10,-252 Q22,-250 28,-241', 2) },
  { id: 'quiff', name: 'Quiff', tags: tags('short volume swept'),
    back: () => '',
    front: c => shp('M-29,-220 C-40,-250 -6,-270 22,-264 C42,-258 44,-240 34,-224 C30,-236 22,-241 8,-241 C-8,-241 -22,-236 -25,-220 Z', c) + ln('M-8,-250 Q8,-258 24,-252', 2.4) },
  { id: 'bun', name: 'Top bun', tags: tags('bun updo tied'),
    back: c => circ(-14, -264, 13, c),
    front: c => shp('M-28,-216 C-32,-244 -8,-254 10,-252 C28,-250 34,-236 31,-222 C24,-230 16,-232 4,-232 C-10,-232 -22,-228 -26,-212 Z', c) },
  { id: 'curly', name: 'Curls', tags: tags('curly afro volume big'),
    back: c => blob([[-26, -236, 17], [-8, -252, 17], [12, -254, 17], [30, -240, 14], [-35, -216, 13], [-31, -196, 10], [34, -222, 10]], c),
    front: c => blob([[-12, -238, 9], [4, -243, 9], [20, -240, 8]], c) },
  { id: 'long', name: 'Long', tags: tags('long straight shoulder'),
    back: c => shp('M-33,-226 C-48,-196 -44,-158 -34,-130 L-4,-134 L-6,-200 Z', c) + ln('M-38,-196 Q-40,-160 -32,-138', 2) + ln('M-30,-210 Q-34,-170 -26,-142', 2),
    front: c => shp('M-30,-218 C-36,-248 -6,-258 10,-254 C28,-250 36,-236 32,-218 C24,-238 8,-236 -2,-228 C-12,-222 -22,-224 -30,-218 Z', c) + ln('M-12,-246 Q4,-252 20,-247', 2) },
  { id: 'pony', name: 'Ponytail', tags: tags('ponytail tied back'),
    back: c => shp('M-30,-232 C-54,-238 -66,-208 -54,-172 C-50,-188 -42,-196 -32,-200 Z', c) + circ(-31, -226, 4.5, INK, 1),
    front: c => shp('M-28,-218 C-34,-246 -10,-258 8,-255 C26,-253 35,-238 31,-222 C26,-232 18,-236 6,-237 C-8,-237 -20,-232 -24,-218 Z', c) }
];
