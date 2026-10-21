import { describe, expect, it } from 'vitest';
import { SKELETON, figureSVG, joints, type BottomKind, type Look, type Pose, type ShoeKind, type TopKind } from './figure';
import { LW, curve, bonePath } from './pen';

function wellFormed(fragment: string): boolean {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`, 'image/svg+xml');
  return !doc.querySelector('parsererror') && !/NaN|undefined|Infinity/.test(fragment);
}
const rest: Pose = { aL: [-3, 6, 1], aR: [3, 4, 1], lL: [-7, 2, -1], lR: [5, -2, -1] };
const poses: Pose[] = [rest, { ...rest, aR: [150, -35, -1] }, { ...rest, aL: [20, 120, 1], aR: [-25, -110, 1] }, { ...rest, lL: [88, -88, -1], lR: [84, -84, -1] }, { aL: [0, 0, 1], aR: [180, 0, 1], lL: [0, 0, -1], lR: [-80, 145, -1] }];
const TOPS: TopKind[] = ['tee', 'longsleeve', 'shirt', 'hoodie', 'tank'], BOTTOMS: BottomKind[] = ['trousers', 'shorts', 'skirt'], SHOES: ShoeKind[] = ['sneaker', 'boot'];

describe('the drawn figure', () => {
  it('draws every top, bottom and shoe in every pose as well-formed SVG', () => {
    for (const topKind of TOPS) for (const bottomKind of BOTTOMS) for (const shoeKind of SHOES) for (const p of poses) {
      const look: Look = { skin: '#e9b996', top: '#9fd0ff', bottom: '#ffe08a', shoe: '#ff9a4d', topKind, bottomKind, shoeKind };
      expect(wellFormed(figureSVG(p, look)), `${topKind} ${bottomKind} ${shoeKind}`).toBe(true);
    }
  });
  it('uses one line weight: every outline is LW, details are thinner, nothing is thicker', () => {
    const svg = figureSVG(rest, { skin: '#fff', top: '#fff', bottom: '#fff', shoe: '#fff', topKind: 'shirt', bottomKind: 'trousers', shoeKind: 'sneaker' });
    const widths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m => Number(m[1]));
    expect(Math.max(...widths)).toBe(LW);
    expect(widths.filter(w => w === LW).length).toBeGreaterThan(widths.length / 2);
  });
  it('puts hands and feet at the ends of the bones', () => {
    const j = joints({ ...rest, aL: [0, 0, 1] });
    expect(j.aL[2][0]).toBeCloseTo(SKELETON.sh.L[0], 6);
    expect(j.aL[2][1]).toBeCloseTo(SKELETON.sh.L[1] + SKELETON.arm[0] + SKELETON.arm[1], 6);
  });
  it('rounds a bent joint into one curve and leaves a straight limb straight', () => {
    const bent = bonePath([0, 0], [0, 50], [40, 50]), straight = bonePath([0, 0], [0, 50], [0, 100]);
    expect(bent.some(p => p[0] > 0.5 && p[1] < 49.5)).toBe(true);                  // the corner is cut
    expect(straight.every(p => Math.abs(p[0]) < 1e-9)).toBe(true);
    expect(curve([[0, 0], [10, 0]])).toBe('M0,0L10,0');
  });
});
