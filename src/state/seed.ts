/* The starting scene: two characters facing each other outside a café. */
import type { Frame } from '../types';
import { DEFAULT_BG } from '../scenes/backgrounds';
import { newCharacter } from '../rig/renderCharacter';

let counter = 1;
/** short unique id */
export const newId = (): string => 'i' + (counter++) + Math.random().toString(36).slice(2, 5);

export function seedFrames(): Frame[] {
  const A = newCharacter({ id: newId(), x: 270, y: 300, s: 0.82, hair: 'hat-beanie', hatC: '#ffe08a', facial: 'full', skin: '#c68a62', face: 'smile-big',
    body: 'stand-pointing-finger-1', topC: '#141414', botC: '#cfe8ff' });
  const B = newCharacter({ id: newId(), x: 690, y: 300, s: 0.82, flip: true, body: 'stand-blazer-3', hair: 'gray-bun', hairC: '#c97b4a', glasses: 'glasses', face: 'explaining',
    topC: '#ffe08a', botC: '#ffffff', shoeC: '#141414' });
  return [{
    id: newId(), bg: DEFAULT_BG, scene: 'cafe', note: 'Two colleagues meet outside the café.',
    items: [
      A, B,
      { id: newId(), kind: 'prop', prop: 'bubble', x: 480, y: 118, s: 1, r: 0, flip: false, text: 'Morning! Ready to shoot?' },
      { id: newId(), kind: 'prop', prop: 'plant', x: 880, y: 462, s: 1, r: 0, flip: false }
    ]
  }];
}
