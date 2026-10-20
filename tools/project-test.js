// Node tests for the pure project-file module (src/project.js). No DOM needed. usage: node tools/project-test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = ['parts-a.js', 'parts-b.js', 'scenes.js', 'project.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
const L = new Function(src + `; return { newChar, poseFrom, POSES, ik, LIMBS, HAIR, PROPS, toProject, parseProject, cleanFrames, cleanName, slug,
  projectFileName, frameFileName, esc, PROJECT_VERSION, DEFAULT_NAME };`)();
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.error('FAIL', name, '\n    ', e.message); process.exitCode = 1; } };
const strip = p => Object.assign({}, p, { updatedAt: '-' });
const wave = L.POSES.find(p => p.id === 'wave').t;

const sample = () => {
  const c = L.newChar({ id: 'c1', x: 270.5, y: 301.25, s: 0.82, r: 12.5, flip: true, hat: 'beanie', hatC: '#ffffff', facial: 'beard', pose: L.poseFrom(wave) });
  c.pose.aR = L.ik(L.LIMBS.aR[0], L.LIMBS.aR[1], L.LIMBS.aR[2], [60, -40], -1);   // arbitrary solved pose, bend flipped
  return {
    name: 'Café: Act 1', aspect: '4:3',
    frames: [
      { id: 'f1', bg: '#e7f3fd', scene: 'cafe', note: 'Two colleagues meet.', items: [c,
        { id: 'p1', type: 'prop', kind: 'bubble', x: 480, y: 118, s: 1, flip: false, text: 'Morning! Ready to shoot?' },
        { id: 'p2', type: 'prop', kind: 'plant', x: 880, y: 462, s: 1.3, r: 20, flip: true }] },
      { id: 'f2', bg: '#ffe6e2', scene: 'none', note: '', items: [] }
    ]
  };
};

t('round trip: state -> file -> state -> file is identical', () => {
  const st = sample(), a = L.toProject(st);
  const back = L.parseProject(JSON.stringify(a));
  assert.strictEqual(back.fixed, 0); assert.strictEqual(back.dropped, 0);
  assert.deepStrictEqual(strip(L.toProject(back.state)), strip(a));
  assert.strictEqual(back.state.name, st.name); assert.strictEqual(back.state.aspect, '4:3');
});
t('file uses the spec shape (kind/prop, no editor-only type field)', () => {
  const p = L.toProject(sample());
  assert.strictEqual(p.version, 1);
  const [c, bub, plant] = p.frames[0].items;
  assert.strictEqual(c.kind, 'char'); assert.ok(!('type' in c)); assert.strictEqual(c.pose.aR[2], -1);
  assert.strictEqual(bub.kind, 'prop'); assert.strictEqual(bub.prop, 'bubble'); assert.strictEqual(bub.text, 'Morning! Ready to shoot?');
  assert.strictEqual(plant.prop, 'plant'); assert.ok(!('text' in plant)); assert.strictEqual(plant.r, 20);
  assert.ok(!Number.isNaN(Date.parse(p.updatedAt)));
});
t('editor state survives the trip field for field', () => {
  const st = sample(), back = L.parseProject(JSON.stringify(L.toProject(st))).state;
  const c = back.frames[0].items[0], o = st.frames[0].items[0];
  for (const k of Object.keys(o)) assert.deepStrictEqual(c[k], o[k], k);
  assert.strictEqual(back.frames[0].items[2].r, 20);
});
t('unknown part ids fall back to the first part of the section', () => {
  const p = L.toProject(sample()); const c = p.frames[0].items[0];
  c.hair = 'no-such-hair'; c.top = 42; c.skin = 'red'; c.topC = '#12';
  const r = L.parseProject(JSON.stringify(p)), got = r.state.frames[0].items[0];
  assert.strictEqual(got.hair, L.HAIR[0].id); assert.strictEqual(got.skin, '#ffffff'); assert.strictEqual(got.topC, '#ffffff');
  assert.strictEqual(r.fixed, 4);
});
t('unknown props are dropped and counted; bad scene becomes none', () => {
  const p = L.toProject(sample());
  p.frames[0].items.push({ id: 'x', kind: 'prop', prop: 'dragon', x: 1, y: 1, s: 1, r: 0, flip: false }, { kind: 'wat' }, 7, null);
  p.frames[0].scene = 'mars';
  const r = L.parseProject(JSON.stringify(p));
  assert.strictEqual(r.dropped, 4); assert.strictEqual(r.state.frames[0].items.length, 3); assert.strictEqual(r.state.frames[0].scene, 'none');
});
t('numbers are clamped and non-finite values replaced', () => {
  const p = L.toProject(sample()), c = p.frames[0].items[0];
  c.s = 99; c.x = 'left'; c.pose.lL = [NaN, 5, 1]; c.pose.aL = 'nope';
  const got = L.parseProject(JSON.stringify(p)).state.frames[0].items[0];
  assert.strictEqual(got.s, 3); assert.strictEqual(got.x, 480);
  for (const l of ['aL', 'aR', 'lL', 'lR']) { assert.strictEqual(got.pose[l].length, 3); assert.ok(got.pose[l].every(Number.isFinite)); }
});
t('control characters are stripped from text and from escaped SVG', () => {
  const p = L.toProject(sample());
  p.frames[0].items[1].text = 'Hi\u0000 there\u0007'; p.frames[0].note = 'a\u0001b\ud800c';
  const r = L.parseProject(JSON.stringify(p)).state.frames[0];
  assert.strictEqual(r.items[1].text, 'Hi there'); assert.strictEqual(r.note, 'abc');
  assert.strictEqual(L.esc('x\u0000<y>&"'), 'x&lt;y&gt;&amp;&quot;');
});
t('rejects non-projects with a readable message', () => {
  const bad = ['not json', '[]', '{}', '{"version":1}', '{"version":"1","frames":[]}', '{"version":0,"frames":[{}]}', '{"version":1.5,"frames":[{}]}',
    JSON.stringify({ version: 1, frames: [] }), JSON.stringify({ version: 1, frames: ['x', 3] })];
  bad.forEach(b => assert.throws(() => L.parseProject(b), /not a Drawfree project|no frames/, b));
  assert.throws(() => L.parseProject(JSON.stringify({ version: 2, frames: [{}] })), /newer version/);
});
t('tolerates minimal frames and fills ids, background, scene', () => {
  const r = L.parseProject(JSON.stringify({ version: 1, name: '  ', frames: [{}] })).state;
  assert.strictEqual(r.frames.length, 1); assert.ok(r.frames[0].id); assert.strictEqual(r.frames[0].scene, 'none'); assert.strictEqual(r.name, L.DEFAULT_NAME);
  assert.strictEqual(r.aspect, '16:9');
});
t('caps absurd files', () => {
  const frames = Array.from({ length: 500 }, () => ({ items: Array.from({ length: 500 }, () => ({ kind: 'char' })) }));
  const r = L.parseProject(JSON.stringify({ version: 1, frames }));
  assert.strictEqual(r.state.frames.length, 200); assert.strictEqual(r.state.frames[0].items.length, 200);
});
t('localStorage path: cleanFrames accepts editor-shaped frames and repairs them', () => {
  const st = sample(); st.frames[0].items[0].face = 'gone';
  const r = L.cleanFrames(st.frames);
  assert.strictEqual(r.fixed, 1); assert.strictEqual(r.frames[0].items[0].type, 'char');
  assert.deepStrictEqual(L.cleanFrames('junk'), { frames: [], fixed: 0, dropped: 0 });
});
t('file names', () => {
  assert.strictEqual(L.slug('My Film: Act 1!'), 'my-film-act-1');
  assert.strictEqual(L.slug('  '), 'drawfree'); assert.strictEqual(L.slug('../../etc/passwd'), 'etc-passwd');
  assert.strictEqual(L.slug('映画 ストーリー'), '映画-ストーリー');
  assert.strictEqual(L.projectFileName('Café Act 1'), 'café-act-1.drawfree.json');
  assert.strictEqual(L.frameFileName('Untitled storyboard', 3, 'png'), 'untitled-storyboard-frame-3.png');
  assert.ok(L.slug('x'.repeat(200)).length <= 60);
});
console.log(passed + ' passed' + (process.exitCode ? ', with failures' : ''));
