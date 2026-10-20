import type { FacePart } from '../types';
import { circ, dot, ln, shp, tags } from './draw';

const eyes = () => dot(5, -214, 2.6, 3.6) + dot(22, -214, 2.6, 3.6);
const brows = (dy = 0) => ln(`M0,${-224 + dy} Q5,${-227 + dy} 10,${-225 + dy}`, 2.6) + ln(`M17,${-225 + dy} Q22,${-228 + dy} 27,${-225 + dy}`, 2.6);

export const FACE: FacePart[] = [
  { id: 'smile', name: 'Smile', tags: tags('happy smile'), draw: () => eyes() + brows() + ln('M10,-192 Q18,-185 26,-192') },
  { id: 'neutral', name: 'Neutral', tags: tags('calm flat straight'), draw: () => eyes() + brows() + ln('M12,-190 L25,-190') },
  { id: 'grin', name: 'Big grin', tags: tags('laugh grin teeth happy'),
    draw: () => eyes() + brows(-1) + shp('M9,-196 Q18,-181 28,-196 Z', '#fff', 2.6) + ln('M10,-192.5 L27,-192.5', 1.8) },
  { id: 'wink', name: 'Wink', tags: tags('wink playful'), draw: () => dot(5, -214, 2.6, 3.6) + ln('M17,-214 Q22,-219 27,-214') + brows() + ln('M10,-192 Q20,-184 27,-193') },
  { id: 'surprised', name: 'Surprised', tags: tags('shock wow surprised'),
    draw: () => circ(5, -214, 4.6, '#fff', 2.4) + dot(6, -214, 1.6, 1.6) + circ(22, -214, 4.6, '#fff', 2.4) + dot(23, -214, 1.6, 1.6) + brows(-4) + dot(19, -189, 4, 5) },
  { id: 'sleepy', name: 'Sleepy', tags: tags('tired sleepy calm closed'), draw: () => ln('M0,-214 Q5,-210 10,-214') + ln('M17,-214 Q22,-210 27,-214') + brows(1) + ln('M13,-191 Q19,-187 25,-191') }
];
