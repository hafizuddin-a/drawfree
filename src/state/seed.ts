/* The starting scene: two characters facing each other outside a café. */
import type { Frame } from '../types';
import { BGC } from '../scenes/backgrounds';
import { newCharacter } from '../rig/renderCharacter';
import { presetPose } from '../rig/poses';

let counter = 1;
/** short unique id */
export const newId = (): string => 'i' + (counter++) + Math.random().toString(36).slice(2, 5);

export function seedFrames(): Frame[] {
  const A = newCharacter({ id: newId(), x: 270, y: 300, s: 0.82, hat: 'beanie', hatC: '#ffffff', facial: 'beard', hairC: '#4a2f22',
    top: 'tee', topC: '#141414', bottom: 'jeans', botC: '#cfe8ff', pose: presetPose('wave') });
  const B = newCharacter({ id: newId(), x: 690, y: 300, s: 0.82, flip: true, hair: 'bun', hairC: '#141414', glasses: 'round',
    top: 'blazer', topC: '#ffffff', neck: 'scarf', neckC: '#ff9a4d', bottom: 'skirt', botC: '#141414', shoes: 'boot', shoeC: '#141414', pose: presetPose('hips') });
  return [{
    id: newId(), bg: BGC[0], scene: 'cafe', note: 'Two colleagues meet outside the café.',
    items: [
      A, B,
      { id: newId(), kind: 'prop', prop: 'bubble', x: 480, y: 118, s: 1, r: 0, flip: false, text: 'Morning! Ready to shoot?' },
      { id: newId(), kind: 'prop', prop: 'plant', x: 880, y: 462, s: 1, r: 0, flip: false }
    ]
  }];
}
