import type { FacialPart, GlassesPart, HatPart, NeckPart } from '../types';
import { INK, circ, ln, shp, tags } from './draw';

export const GLASSES: GlassesPart[] = [
  { id: 'none', name: 'No glasses', tags: tags('none'), draw: () => '' },
  { id: 'round', name: 'Round glasses', tags: tags('glasses round specs'),
    draw: () => circ(5, -214, 9, 'rgba(255,255,255,.35)', 2.6) + circ(23, -214, 9, 'rgba(255,255,255,.35)', 2.6) + ln('M-4,-214 L-28,-212', 2.6) },
  { id: 'square', name: 'Square glasses', tags: tags('glasses square frames'),
    draw: () => shp('M-3,-221 H12 V-208 H-3 Z', 'rgba(255,255,255,.35)', 2.6) + shp('M16,-221 H31 V-208 H16 Z', 'rgba(255,255,255,.35)', 2.6) + ln('M12,-217 L16,-217', 2.6) + ln('M-3,-217 L-28,-213', 2.6) },
  { id: 'shades', name: 'Sunglasses', tags: tags('sunglasses shades dark'),
    draw: () => shp('M-4,-222 H12 V-210 Q8,-205 2,-207 Q-4,-208 -4,-222Z', INK, 2.6) + shp('M15,-222 H32 V-210 Q28,-205 21,-207 Q15,-208 15,-222Z', INK, 2.6) + ln('M-4,-218 L-28,-213', 2.6) }
];

export const FACIAL: FacialPart[] = [
  { id: 'none', name: 'Clean shaven', tags: tags('none'), pre: () => '', post: () => '' },
  { id: 'stache', name: 'Moustache', tags: tags('moustache mustache'), pre: () => '', post: c => shp('M7,-197 C11,-204 24,-204 30,-198 C24,-193 14,-193 7,-197Z', c, 2.4) },
  { id: 'beard', name: 'Full beard', tags: tags('beard bearded'),
    pre: c => shp('M-28,-206 C-28,-180 -12,-166 4,-166 C20,-166 29,-180 29,-196 C23,-188 15,-185 9,-184 C1,-186 -14,-188 -28,-206 Z', c), post: () => '' },
  { id: 'goatee', name: 'Goatee', tags: tags('goatee chin'),
    pre: c => shp('M6,-186 C10,-182 12,-176 16,-174 C24,-176 26,-184 28,-190 C22,-186 14,-187 6,-186Z', c, 2.4), post: () => '' }
];

export const HATS: HatPart[] = [
  { id: 'none', name: 'No hat', tags: tags('none'), draw: () => '' },
  { id: 'beanie', name: 'Beanie', tags: tags('beanie knit winter hat'),
    draw: c => shp('M-33,-228 C-33,-264 -10,-276 0,-276 C14,-276 33,-262 33,-228 Z', c) +
               shp('M-35,-239 H35 V-224 H-35 Z', c) + ln('M-18,-239 V-224', 2) + ln('M-4,-239 V-224', 2) + ln('M10,-239 V-224', 2) + ln('M24,-239 V-224', 2) + circ(0, -282, 8, c) },
  { id: 'cap', name: 'Baseball cap', tags: tags('cap baseball hat'),
    draw: c => shp('M-31,-232 C-31,-262 -4,-268 12,-266 C30,-262 33,-244 32,-232 Z', c) + shp('M14,-236 H50 C57,-236 57,-228 50,-228 H14 Z', c) },
  { id: 'bucket', name: 'Bucket hat', tags: tags('bucket hat sun'),
    draw: c => shp('M-32,-230 C-32,-262 -8,-268 0,-268 C12,-268 32,-262 32,-230 Z', c) + shp('M-48,-224 C-30,-236 30,-236 48,-224 C48,-217 -48,-217 -48,-224Z', c) }
];

export const NECK: NeckPart[] = [
  { id: 'none', name: 'No neckwear', tags: tags('none'), draw: () => '' },
  { id: 'scarf', name: 'Scarf', tags: tags('scarf winter'),
    draw: c => shp('M-20,-174 Q0,-160 20,-174 L23,-160 Q0,-144 -23,-160 Z', c) + shp('M6,-154 L18,-106 L3,-102 L-4,-148 Z', c) + ln('M7,-134 L16,-131', 2) + ln('M5,-122 L14,-119', 2) },
  { id: 'tie', name: 'Tie', tags: tags('tie necktie office formal'),
    draw: c => shp('M-5,-168 L5,-168 L8,-158 L-8,-158 Z', c, 2.4) + shp('M-7,-158 L7,-158 L9,-112 L0,-100 L-9,-112 Z', c, 2.4) },
  { id: 'chain', name: 'Pendant', tags: tags('necklace pendant chain jewelry'),
    draw: c => ln('M-16,-168 Q0,-122 16,-168', 2.4) + circ(0, -131, 6, c, 2.4) }
];
