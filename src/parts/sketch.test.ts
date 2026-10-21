import { describe, expect, it } from 'vitest';
import { ell, rect, rng, sketch } from './sketch';

const draw = (seed: string) => {
  const k = sketch(seed, { w: 2.3, amp: 1 });
  k.line([[0, 0], [100, 0]]); k.shape(rect(0, 0, 50, 30), 'fill="#fff"'); k.wash(ell(0, 0, 20), 'fill="#fff"');
  return k.done();
};

describe('sketch', () => {
  it('is seeded: the same seed draws the same, another seed differently', () => {
    expect(draw('a')).toEqual(draw('a'));
    expect(draw('a')).not.toEqual(draw('b'));
    expect(rng('x')()).toBe(rng('x')());
  });
  it('draws finite, closed path data, with fills apart from ink unless an ink colour is given', () => {
    const [fills, ink] = draw('a');
    for (const d of (fills + ink).match(/d="[^"]+"/g) ?? []) { expect(d).not.toMatch(/NaN|Infinity/); expect(d).toMatch(/z"$/); }
    expect(fills.match(/<path/g)).toHaveLength(2); expect(ink.match(/<path/g)).toHaveLength(2);
    const k = sketch('a', { w: 2, amp: 1, ink: '#141414' });
    k.shape(rect(0, 0, 10, 10), 'fill="#fff"');
    const [all, none] = k.done();
    expect(none).toBe(''); expect(all.indexOf('fill="#fff"')).toBeLessThan(all.indexOf('fill="#141414"'));   // fill under its outline
  });
  it('stays near the line it follows', () => {
    const [, ink] = draw('a'), nums = (ink.match(/M(-?[\d.]+) (-?[\d.]+)/) ?? []).slice(1).map(Number);
    expect(Math.hypot(nums[0], nums[1])).toBeLessThan(4);
  });
});
