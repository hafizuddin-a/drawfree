import { describe, expect, it } from 'vitest';
import { HAIR } from '../parts';
import { LIMB_IDS } from '../rig/geometry';
import { ik } from '../rig/ik';
import { LIMBS } from '../rig/geometry';
import { presetPose } from '../rig/poses';
import { newCharacter } from '../rig/renderCharacter';
import type { Character, Frame, Project } from '../types';
import {
  DEFAULT_NAME, MAX_FILE_BYTES, PROJECT_VERSION, ProjectError, cleanFrames, frameFileName, fromLegacyFrames, parseProject, projectFileName, slug, toProject
} from './project';

const strip = (p: Project): Project => ({ ...p, updatedAt: '-' });

function sample() {
  const c: Character = newCharacter({ id: 'c1', x: 270.5, y: 301.25, s: 0.82, r: 12.5, flip: true, hair: 'hat-beanie', hatC: '#ffffff', facial: 'full', pose: presetPose('wave') });
  c.pose.aR = ik(LIMBS.aR[0], LIMBS.aR[1], LIMBS.aR[2], [60, -40], -1);          // an arbitrary solved pose with a flipped bend
  const frames: Frame[] = [
    { id: 'f1', bg: '#e7f3fd', scene: 'cafe', note: 'Two colleagues meet.', items: [c,
      { id: 'p1', kind: 'prop', prop: 'bubble', x: 480, y: 118, s: 1, r: 0, flip: false, text: 'Morning! Ready to shoot?' },
      { id: 'p2', kind: 'prop', prop: 'plant', x: 880, y: 462, s: 1.3, r: 20, flip: true }] },
    { id: 'f2', bg: '#ffe6e2', scene: 'none', note: '', items: [] }
  ];
  return { name: 'Café: Act 1', aspect: '4:3' as const, frames };
}
/** the file as the editor would save it, as a plain mutable object for tampering */
const fileOf = (): Project => JSON.parse(JSON.stringify(toProject(sample()))) as Project;
/** view a typed value as loose JSON, to plant values the types forbid */
const loose = (v: unknown) => v as Record<string, unknown>;

describe('project files', () => {
  it('round trip: state -> file -> state -> file is identical', () => {
    const a = toProject(sample()), back = parseProject(JSON.stringify(a));
    expect(back.fixed).toBe(0); expect(back.dropped).toBe(0);
    expect(strip(toProject(back.state))).toEqual(strip(a));
    expect(back.state.name).toBe('Café: Act 1'); expect(back.state.aspect).toBe('4:3');
  });
  it('keeps every field of every character and prop', () => {
    const st = sample(), back = parseProject(JSON.stringify(toProject(st))).state;
    expect(back.frames).toEqual(st.frames);
  });
  it('writes the spec shape with a version and a timestamp', () => {
    const p = toProject(sample());
    expect(p.version).toBe(PROJECT_VERSION);
    expect(p.frames[0].items[0].kind).toBe('char');
    expect(Number.isNaN(Date.parse(p.updatedAt))).toBe(false);
  });
  it('unknown part ids fall back to the first part, bad colours to defaults', () => {
    const p = fileOf(), c = loose(p.frames[0].items[0]);
    c.hair = 'no-such-hair'; c.top = 42; c.skin = 'red'; c.topC = '#12';
    const r = parseProject(JSON.stringify(p)), got = r.state.frames[0].items[0] as Character;
    expect(got.hair).toBe(HAIR[0].id); expect(got.skin).toBe('#ffffff'); expect(got.topC).toBe('#ffffff');
    expect(r.fixed).toBe(4);
  });
  it('unknown props and junk items are dropped and counted; an unknown scene becomes none', () => {
    const p = fileOf();
    (p.frames[0].items as unknown[]).push({ id: 'x', kind: 'prop', prop: 'dragon', x: 1, y: 1, s: 1, r: 0, flip: false }, { kind: 'wat' }, 7, null);
    p.frames[0].scene = 'mars';
    const r = parseProject(JSON.stringify(p));
    expect(r.dropped).toBe(4); expect(r.state.frames[0].items).toHaveLength(3); expect(r.state.frames[0].scene).toBe('none');
  });
  it('clamps numbers and replaces non-finite values and malformed poses', () => {
    const p = fileOf(), c = loose(p.frames[0].items[0]), pose = loose(c.pose);
    c.s = 99; c.x = 'left'; pose.lL = [NaN, 5, 1]; pose.aL = 'nope'; (pose.aR as unknown[])[2] = 7;
    const got = parseProject(JSON.stringify(p)).state.frames[0].items[0] as Character;
    expect(got.s).toBe(3); expect(got.x).toBe(480);
    for (const l of LIMB_IDS) { expect(got.pose[l]).toHaveLength(3); expect(got.pose[l].every(Number.isFinite)).toBe(true); expect([1, -1]).toContain(got.pose[l][2]); }
  });
  it('strips control characters from text', () => {
    const p = fileOf();
    loose(p.frames[0].items[1]).text = 'Hi\u0000 there\u0007'; p.frames[0].note = 'a\u0001b\ud800c';
    const f = parseProject(JSON.stringify(p)).state.frames[0];
    expect(f.note).toBe('abc'); expect(f.items[1]).toMatchObject({ text: 'Hi there' });
  });
  it('rejects non-projects with a readable message', () => {
    const bad = ['not json', '[]', '{}', '{"version":1}', '{"version":"1","frames":[]}', '{"version":0,"frames":[{}]}', '{"version":1.5,"frames":[{}]}',
      JSON.stringify({ version: 1, frames: [] }), JSON.stringify({ version: 1, frames: ['x', 3] })];
    for (const b of bad) expect(() => parseProject(b), b).toThrow(/not a Drawfree project|no frames/);
    expect(() => parseProject(JSON.stringify({ version: PROJECT_VERSION + 1, frames: [{}] }))).toThrow(/newer version/);
    expect(() => parseProject('not json')).toThrow(ProjectError);
  });
  it('migrates version 1 heads to the Open Peeps parts, hats included', () => {
    const v1 = (o: Record<string, unknown>) => ({ ...newCharacter({ id: 'c' }), hair: 'crop', face: 'grin', glasses: 'round', facial: 'beard', hat: 'none', hairC: '#141414', neck: 'scarf', neckC: '#ff9a4d', ...o });
    const file = { version: 1, frames: [{ items: [v1({}), v1({ hair: 'long', hat: 'beanie', face: 'sleepy', glasses: 'shades', facial: 'stache', hairC: '#e0b95a' })] }] };
    const r = parseProject(JSON.stringify(file));
    const [a, b] = r.state.frames[0].items as Character[];
    expect(r.fixed).toBe(0);
    expect(a).toMatchObject({ hair: 'short-1', face: 'smile-big', glasses: 'glasses', facial: 'full', hairC: '#141414' });
    expect(b).toMatchObject({ hair: 'hat-beanie', face: 'tired', glasses: 'sunglasses', facial: 'moustache-1', hairC: '#e0b95a' });
    for (const gone of ['hat', 'neck', 'neckC']) expect(gone in a, gone).toBe(false);
    expect(toProject(r.state).version).toBe(2);
  });
  it('bodies: kept through a save, the posable figure when missing (older files) or unknown (counted as a fix)', () => {
    const p = fileOf(), c = loose(p.frames[0].items[0]);
    c.body = 'sit-wheelchair';
    expect((parseProject(JSON.stringify(p)).state.frames[0].items[0] as Character).body).toBe('sit-wheelchair');
    delete c.body;
    let r = parseProject(JSON.stringify(p));
    expect((r.state.frames[0].items[0] as Character).body).toBe('rig'); expect(r.fixed).toBe(0);
    c.body = 'stand-moonwalk';
    r = parseProject(JSON.stringify(p));
    expect((r.state.frames[0].items[0] as Character).body).toBe('rig'); expect(r.fixed).toBe(1);
  });
  it('a version 1 file with unknown ids still repairs them after migrating', () => {
    const r = parseProject(JSON.stringify({ version: 1, frames: [{ items: [{ kind: 'char', hair: 'mullet' }] }] }));
    expect((r.state.frames[0].items[0] as Character).hair).toBe(HAIR[0].id);
  });
  it('tolerates minimal frames and fills ids, background and scene', () => {
    const r = parseProject(JSON.stringify({ version: 1, name: '  ', frames: [{}] })).state;
    expect(r.frames[0].id).toBeTruthy(); expect(r.frames[0].scene).toBe('none'); expect(r.name).toBe(DEFAULT_NAME); expect(r.aspect).toBe('16:9');
  });
  it('caps absurd files', () => {
    const frames = Array.from({ length: 500 }, () => ({ items: Array.from({ length: 500 }, () => ({ kind: 'char' })) }));
    const r = parseProject(JSON.stringify({ version: 1, frames }));
    expect(r.state.frames).toHaveLength(200); expect(r.state.frames[0].items).toHaveLength(200);
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('legacy autosave from the prototype', () => {
  const legacy = [{
    id: 'f', bg: '#e7f3fd', scene: 'cafe', note: 'n', items: [
      { ...newCharacter({ id: 'a' }), kind: undefined, type: 'char' },
      { id: 'b', type: 'prop', kind: 'bubble', x: 1, y: 2, s: 1, flip: false, text: 'hello' }
    ]
  }];
  it('converts type/kind items to the file shape and cleans them', () => {
    const r = cleanFrames(fromLegacyFrames(legacy));
    expect(r.fixed).toBe(0); expect(r.dropped).toBe(0);
    expect(r.frames[0].items.map(i => i.kind)).toEqual(['char', 'prop']);
    expect(r.frames[0].items[1]).toMatchObject({ prop: 'bubble', text: 'hello', r: 0 });
  });
  it('maps the prototype\'s head part ids to the Open Peeps ones', () => {
    const old = [{ items: [{ ...newCharacter({ id: 'a' }), kind: undefined, type: 'char', hair: 'curly', hat: 'cap', face: 'wink' }] }];
    const r = cleanFrames(fromLegacyFrames(old));
    expect(r.fixed).toBe(0);
    expect(r.frames[0].items[0]).toMatchObject({ hair: 'hat-hip', face: 'cute' });
  });
  it('repairs bad data and survives junk input', () => {
    const bad = JSON.parse(JSON.stringify(legacy)) as typeof legacy; loose(bad[0].items[0]).face = 'gone';
    expect(cleanFrames(fromLegacyFrames(bad)).fixed).toBe(1);
    expect(cleanFrames('junk')).toEqual({ frames: [], fixed: 0, dropped: 0 });
  });
});

describe('file names', () => {
  it('slugs project names', () => {
    expect(slug('My Film: Act 1!')).toBe('my-film-act-1');
    expect(slug('  ')).toBe('drawfree'); expect(slug('../../etc/passwd')).toBe('etc-passwd');
    expect(slug('映画 ストーリー')).toBe('映画-ストーリー');
    expect(slug('x'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
  it('builds the documented file names', () => {
    expect(projectFileName('Café Act 1')).toBe('café-act-1.drawfree.json');
    expect(frameFileName('Untitled storyboard', 3, 'png')).toBe('untitled-storyboard-frame-3.png');
  });
});
