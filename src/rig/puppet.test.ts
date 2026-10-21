import { beforeAll, describe, expect, it } from 'vitest';
import { loadBodyArt } from '../parts/bodies';
import { ORDER, PIECES } from '../parts/cutout';
import { BOTTOMS, SHOES, TOPS } from '../parts';
import { charSVG, newCharacter } from './renderCharacter';
import { POSES, poseFrom } from './poses';

beforeAll(() => loadBodyArt());

const uses = (svg: string) => [...svg.matchAll(/<use class="cut" href="#([^"]+)" transform="matrix\(([^)]+)\)" mask="url\(#([^)]+)\)"\/>/g)];

describe('the cutout puppet', () => {
  it('draws every piece once, through its own clip shape, back to front', () => {
    const svg = charSVG(newCharacter({ id: 'a' }));
    const u = uses(svg);
    expect(u.map(m => m[3].split('-').pop())).toEqual(ORDER.filter(k => (PIECES as readonly string[]).includes(k)));
    for (const m of u) expect(svg).toContain(`id="${m[1]}"`);
    for (const m of u) expect(svg).toContain(`<mask id="${m[3]}"`);
  });
  it('at rest every piece is where it was cut from: no turn, only the drop onto the ground line', () => {
    for (const m of uses(charSVG(newCharacter({ id: 'a' })))) {
      const [a, b, c, d, e] = m[2].split(' ').map(Number);
      expect([a, b, c, d, e]).toEqual([1, 0, 0, 1, 0]);
    }
  });
  it('a pose turns the limb pieces and leaves the torso and pelvis alone', () => {
    const c = newCharacter({ id: 'a' }), svg = charSVG({ ...c, pose: poseFrom(c, (POSES.find(p => p.id === 'cheer') ?? POSES[0]).t) });
    const m = new Map(uses(svg).map(x => [x[3].split('-').pop(), x[2].split(' ').map(Number)]));
    expect(m.get('torso')?.slice(0, 4)).toEqual([1, 0, 0, 1]);
    expect(m.get('aL1')?.[0]).toBeLessThan(0);            // the near upper arm is turned past the horizontal
    expect(m.get('lL1')?.slice(0, 4)).toEqual([1, 0, 0, 1]);
  });
  it('ids are unique per character, so several puppets share a page', () => {
    const a = charSVG(newCharacter({ id: 'one' })), b = charSVG(newCharacter({ id: 'two' }));
    const ids = (s: string) => [...s.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    expect(ids(a).filter(i => ids(b).includes(i))).toEqual([]);
    expect(charSVG(newCharacter({ id: 'x"><script>' }))).not.toContain('<script>');
  });
  it('carries a .bounds outline to measure by, since clipped pieces measure as their whole art', () => {
    expect(charSVG(newCharacter({ id: 'a' }))).toMatch(/<path class="bounds" d="M[^"]+Z" fill="none"\/>/);
  });
  it('every garment dresses it', () => {
    for (const [slot, list] of [['top', TOPS], ['bottom', BOTTOMS], ['shoes', SHOES]] as const) {
      for (const g of list) expect(uses(charSVG(newCharacter({ id: 'a', [slot]: g.id }))).length).toBe(PIECES.length);
    }
  });
});
