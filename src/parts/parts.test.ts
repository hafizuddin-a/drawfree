import { describe, expect, it } from 'vitest';
import { BOTTOMS, CLOTH, FACE, FACIAL, GLASSES, HAIR, HAIRC, PROPS, SHOES, SKIN, TOPS } from '.';
import { peepSVG } from './peeps/art';
import { POSES, poseFrom } from '../rig/poses';
import { charSVG, itemSVG, newCharacter, propSVG } from '../rig/renderCharacter';
import { BGC } from '../scenes/backgrounds';
import { SCENES, frameBG } from '../scenes/scenes';
import { esc } from './draw';

/** parses an SVG fragment as XML; throws a readable message if it is not well formed */
function assertWellFormed(fragment: string, label: string): void {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`, 'image/svg+xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`${label}: ${err.textContent?.slice(0, 160)}`);
  expect(fragment.length, label).toBeGreaterThanOrEqual(0);
}

describe('every part draws well-formed SVG for every palette colour', () => {
  it('Open Peeps heads, faces, facial hair and glasses, with every skin, hair and hat colour', () => {
    for (const p of [...HAIR, ...FACE, ...FACIAL, ...GLASSES]) for (const skin of SKIN) for (const hair of HAIRC) {
      assertWellFormed(peepSVG(p.art, { skin, hair, hat: CLOTH[(SKIN.indexOf(skin) + HAIRC.indexOf(hair)) % CLOTH.length] }), `${p.id} ${skin} ${hair}`);
    }
  });
  it('Open Peeps layers have a known colour kind and compact path data only', () => {
    for (const p of [...HAIR, ...FACE, ...FACIAL, ...GLASSES]) for (const [kind, d] of p.art.l) {
      expect(kind, p.id).toMatch(/^([shawi]|#[0-9a-f]{6})$/);
      expect(d, p.id).toMatch(/^m[-\d. mlcz]+$/);
    }
  });
  it('the colour kinds reach the right colours', () => {
    const svg = peepSVG({ id: 't', name: 't', l: [['s', 'm0 0'], ['h', 'm0 0'], ['a', 'm0 0'], ['w', 'm0 0'], ['i', 'm0 0'], ['#4f66af', 'm0 0']] }, { skin: '#111111', hair: '#222222', hat: '#333333' });
    expect(svg.match(/fill="[^"]+"/g)).toEqual(['fill="#111111"', 'fill="#222222"', 'fill="#333333"', 'fill="#ffffff"', 'fill="#141414"', 'fill="#4f66af"']);
  });
  it('tops, bottoms and shoes, with every skin tone where it matters', () => {
    for (const t of TOPS) for (const c of CLOTH) for (const s of SKIN) assertWellFormed(t.draw(c, s), `top ${t.id} ${c} ${s}`);
    for (const b of BOTTOMS) for (const c of CLOTH) assertWellFormed(b.pelvis(c), `bottom ${b.id} ${c}`);
    for (const sh of SHOES) for (const c of CLOTH) for (const s of SKIN) assertWellFormed(sh.draw(c, s), `shoes ${sh.id} ${c} ${s}`);
  });
  it('props, including a speech bubble with awkward text', () => {
    for (const p of PROPS) assertWellFormed(propSVG({ prop: p.id, text: p.text }), p.id);
    assertWellFormed(propSVG({ prop: 'bubble', text: `<b>&"quotes" & ampersands\u0000 ${'long '.repeat(40)}` }), 'bubble awkward text');
  });
  it('scenes on every background colour', () => {
    for (const s of SCENES) for (const bg of BGC) assertWellFormed(frameBG({ bg, scene: s.id }), `scene ${s.id} ${bg}`);
  });
  it('whole characters: every part combination slot by slot, every pose, flipped and rotated', () => {
    const base = newCharacter();
    const slots = { hair: HAIR, face: FACE, top: TOPS, bottom: BOTTOMS, shoes: SHOES, glasses: GLASSES, facial: FACIAL };
    for (const [slot, list] of Object.entries(slots)) for (const p of list) assertWellFormed(charSVG({ ...base, [slot]: p.id }), `${slot} ${p.id}`);
    for (const p of POSES) assertWellFormed(itemSVG({ ...base, pose: poseFrom(p.t), flip: true, r: 30 }), `pose ${p.id}`);
  });
});

describe('the well-formedness check itself', () => {
  it('rejects broken markup (so the tests above are not vacuous)', () => {
    expect(() => assertWellFormed('<g><path></g>', 'broken')).toThrow(/broken/);
    expect(() => assertWellFormed('<text>a & b</text>', 'bare ampersand')).toThrow();
    expect(() => assertWellFormed('<g/>', 'fine')).not.toThrow();
  });
});

describe('part data', () => {
  it('ids are unique within each list and every part has a name and tags', () => {
    for (const list of [HAIR, FACE, GLASSES, FACIAL, TOPS, BOTTOMS, SHOES, PROPS, POSES, SCENES]) {
      expect(new Set(list.map(p => p.id)).size).toBe(list.length);
      for (const p of list) { expect(p.name).toBeTruthy(); expect(p.tags.length).toBeGreaterThan(0); }
    }
  });
  it('the first part of the lists that allow "none" really draws nothing', () => {
    expect(GLASSES[0].art.l).toEqual([]); expect(FACIAL[0].art.l).toEqual([]);
  });
  it('unknown part ids render the first part instead of throwing', () => {
    const odd = newCharacter({ hair: 'nope', face: 'nope', top: 'nope', bottom: 'nope', shoes: 'nope', glasses: 'nope', facial: 'nope' });
    expect(() => charSVG(odd)).not.toThrow();
    expect(propSVG({ prop: 'nope' })).toBe(propSVG({ prop: PROPS[0].id }));
  });
  it('esc strips characters XML forbids and escapes markup', () => {
    expect(esc('a\u0000b\u0007<&>"')).toBe('ab&lt;&amp;&gt;&quot;');
  });
});
