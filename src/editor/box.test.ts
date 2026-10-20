// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { boxFromCorners, handleSide } from './box';

type P = { x: number; y: number };
const rect = (x: number, y: number, w: number, h: number): [P, P, P, P] => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
/** rotate points about their centre */
const turn = (c: [P, P, P, P], deg: number): [P, P, P, P] => {
  const cx = c.reduce((n, p) => n + p.x, 0) / 4, cy = c.reduce((n, p) => n + p.y, 0) / 4, r = (deg * Math.PI) / 180;
  return c.map(p => ({ x: cx + (p.x - cx) * Math.cos(r) - (p.y - cy) * Math.sin(r), y: cy + (p.x - cx) * Math.sin(r) + (p.y - cy) * Math.cos(r) })) as [P, P, P, P];
};

describe('boxFromCorners', () => {
  it('an unrotated rectangle gives angle 0, its size plus padding, and the same bounds', () => {
    const b = boxFromCorners(rect(100, 50, 60, 200), 6);
    expect(b).toMatchObject({ cx: 130, cy: 150, w: 72, h: 212, angle: 0, ax: 94, ay: 44, aw: 72, ah: 212 });
  });
  it('a turned rectangle keeps its own size and reports the turn', () => {
    for (const deg of [10, 30, 45, -30, -60, 75]) {
      const b = boxFromCorners(turn(rect(100, 50, 60, 200), deg), 6);
      expect(b.angle).toBeCloseTo(deg, 0); expect(b.w).toBeCloseTo(72, 0); expect(b.h).toBeCloseTo(212, 0);
    }
  });
  it('the bounds of a turned box are wider than the box and contain every corner', () => {
    const c = turn(rect(100, 50, 60, 200), 40), b = boxFromCorners(c, 6);
    expect(b.aw).toBeGreaterThan(b.w);
    for (const p of c) { expect(p.x).toBeGreaterThanOrEqual(b.ax - 0.5); expect(p.x).toBeLessThanOrEqual(b.ax + b.aw + 0.5); expect(p.y).toBeGreaterThanOrEqual(b.ay - 0.5); expect(p.y).toBeLessThanOrEqual(b.ay + b.ah + 0.5); }
  });
  it('a flipped (mirrored) item gives the same box as an unflipped one', () => {
    const c = rect(100, 50, 60, 200), mirrored: [P, P, P, P] = [c[1], c[0], c[3], c[2]];
    expect(boxFromCorners(mirrored, 6)).toEqual(boxFromCorners(c, 6));
    expect(boxFromCorners(turn(mirrored, 25), 6).angle).toBeCloseTo(25, 0);
  });
  it('a half turn looks the same as no turn, and the angle stays in [-90, 90)', () => {
    expect(boxFromCorners(turn(rect(0, 0, 40, 100), 180), 0).angle).toBeCloseTo(0, 5);
    for (let d = -359; d < 360; d += 17) { const a = boxFromCorners(turn(rect(0, 0, 40, 100), d), 0).angle; expect(a).toBeGreaterThanOrEqual(-90); expect(a).toBeLessThan(90); }
  });
});

describe('handleSide', () => {
  const box = (cx: number, cy: number, w: number, h: number, angle = 0) => ({ cx, cy, w, h, angle, ax: 0, ay: 0, aw: w, ah: h });
  it('goes above when there is room', () => { expect(handleSide(box(300, 250, 60, 120), 800, 450)).toBe('above'); });
  it('goes below when the box is at the top edge', () => { expect(handleSide(box(300, 70, 60, 100), 800, 450)).toBe('below'); });
  it('goes beside the box when it fills the stage vertically (a phone)', () => { expect(handleSide(box(300, 225, 60, 440), 800, 450)).toBe('right'); });
  it('goes left when there is no room to the right either', () => { expect(handleSide(box(770, 225, 60, 440), 800, 450)).toBe('left'); });
  it('follows the turn: a box turned a quarter turn puts its "above" to the side of the screen', () => {
    // a tall box turned 90 degrees: its top now faces right (or left), and that point is what is tested
    expect(handleSide(box(400, 225, 60, 200, 60), 800, 450)).toBe('above');
    expect(handleSide(box(760, 225, 60, 200, 80), 800, 450)).not.toBe('above');          // its top would be off the right edge
  });
  it('always answers, even in a stage too small for any handle', () => { expect(['above', 'below', 'right', 'left']).toContain(handleSide(box(20, 20, 30, 30), 40, 40)); });
});
