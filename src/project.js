/* Drawfree project files: pure data code (no DOM). Converts between the editor's state and the
   .drawfree.json format, cleans untrusted input, migrates by version. Needs the part lists, SCENES, BGC. */
const PROJECT_VERSION = 1;
const ASPECTS = ['16:9', '4:3', '1:1', '9:16'];
const MAX_FRAMES = 200, MAX_ITEMS = 200, MAX_FILE_BYTES = 10 * 1024 * 1024;
const PART_LISTS = { hair: HAIR, face: FACE, top: TOPS, bottom: BOTTOMS, shoes: SHOES, glasses: GLASSES, facial: FACIAL, hat: HATS, neck: NECK };
const COLOR_SLOTS = ['skin', 'hairC', 'topC', 'botC', 'shoeC', 'hatC', 'neckC'];
const LIMB_IDS = ['aL', 'aR', 'lL', 'lR'];
const DEFAULT_NAME = 'Untitled storyboard';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isHex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const num = (v, d, lo = -1e5, hi = 1e5) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
/* drop characters XML 1.0 forbids (control codes, lone surrogates) so exported SVG always parses */
const cleanText = (v, max) => (typeof v === 'string' ? v : '').replace(/[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu, '').slice(0, max);
const rid = () => 'i' + Math.random().toString(36).slice(2, 9);

function cleanPose(raw, base) {
  const out = {};
  LIMB_IDS.forEach(l => {
    const p = isObj(raw) ? raw[l] : null;
    out[l] = Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]) && typeof p[0] === 'number' && typeof p[1] === 'number'
      ? [p[0], p[1], p[2] === -1 ? -1 : 1] : base[l].slice();
  });
  return out;
}

/* Items arrive here in the editor's shape: { type: 'char' } or { type: 'prop', kind: <prop id> }.
   Returns a clean item, or null when it cannot be drawn. `fix` counts values that had to be replaced. */
function cleanItem(raw, fix) {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : rid();
  const place = d => ({ x: num(raw.x, d.x), y: num(raw.y, d.y), s: num(raw.s, d.s, 0.3, 3), r: num(raw.r, 0, -3600, 3600), flip: raw.flip === true });
  if (raw.type === 'char') {
    const base = newChar(), c = Object.assign({ id, type: 'char' }, place(base));
    for (const k in PART_LISTS) {
      const hit = PART_LISTS[k].some(p => p.id === raw[k]);
      if (!hit) fix.n++;
      c[k] = hit ? raw[k] : PART_LISTS[k][0].id;
    }
    COLOR_SLOTS.forEach(k => { if (!isHex(raw[k])) fix.n++; c[k] = isHex(raw[k]) ? raw[k] : base[k]; });
    c.pose = cleanPose(raw.pose, base.pose);
    return c;
  }
  if (raw.type === 'prop' && BY.prop[raw.kind]) {
    const p = Object.assign({ id, type: 'prop', kind: raw.kind }, place({ x: 480, y: 300, s: 1 }));
    if (BY.prop[raw.kind].text) p.text = cleanText(raw.text, 300);
    if (isHex(raw.color)) p.color = raw.color;
    return p;
  }
  return null;
}
function cleanFrame(raw, fix) {
  if (!isObj(raw)) return null;
  const sceneOk = typeof raw.scene === 'string' && sceneById[raw.scene];
  if (!sceneOk && raw.scene != null && raw.scene !== '') fix.n++;
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, MAX_ITEMS).map(i => {
    const c = cleanItem(i, fix);
    if (!c) fix.dropped++;
    return c;
  }).filter(Boolean);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : rid(),
    bg: isHex(raw.bg) ? raw.bg : BGC[0], scene: sceneOk ? raw.scene : 'none', note: cleanText(raw.note, 2000), items
  };
}
/* editor frames (or untrusted look-alikes) -> clean editor frames. Used for localStorage and for opened files. */
function cleanFrames(raw) {
  const fix = { n: 0, dropped: 0 };
  const frames = (Array.isArray(raw) ? raw : []).slice(0, MAX_FRAMES).map(f => cleanFrame(f, fix)).filter(Boolean);
  return { frames, fixed: fix.n, dropped: fix.dropped };
}
const cleanName = v => cleanText(v, 80).trim() || DEFAULT_NAME;

/* ---------- editor shape <-> file shape ---------- */
function toProjectItem(it) {
  const at = { x: it.x, y: it.y, s: it.s, r: it.r || 0, flip: !!it.flip };
  if (it.type === 'char') {
    const o = { id: it.id, kind: 'char' };
    for (const k in PART_LISTS) o[k] = it[k];
    COLOR_SLOTS.forEach(k => { o[k] = it[k]; });
    return Object.assign(o, at, { pose: it.pose });
  }
  const o = Object.assign({ id: it.id, kind: 'prop', prop: it.kind }, at);
  if (it.text !== undefined) o.text = it.text;
  if (it.color !== undefined) o.color = it.color;
  return o;
}
function fromProjectItem(f) {
  if (!isObj(f)) return null;
  if (f.kind === 'char') return Object.assign({}, f, { type: 'char' });
  if (f.kind === 'prop') { const o = Object.assign({}, f, { type: 'prop', kind: f.prop }); delete o.prop; return o; }
  return null;
}
function toProject(st) {
  return {
    version: PROJECT_VERSION, name: st.name || DEFAULT_NAME,
    frames: st.frames.map(f => ({ id: f.id, items: f.items.map(toProjectItem), scene: f.scene || 'none', bg: f.bg, note: f.note || '' })),
    aspect: ASPECTS.includes(st.aspect) ? st.aspect : '16:9', updatedAt: new Date().toISOString()
  };
}

/* One step per old version: MIGRATIONS[n] turns a version n file into version n + 1. Empty until the format changes. */
const MIGRATIONS = {};
function migrateProject(p) {
  while (p.version < PROJECT_VERSION) {
    if (!MIGRATIONS[p.version]) throw new Error('This project file is from an unsupported version.');
    p = MIGRATIONS[p.version](p);
  }
  return p;
}
/* Parses file text. Returns { state: { name, aspect, frames }, fixed, dropped } or throws an Error with a user-facing message. */
function parseProject(text) {
  let p;
  try { p = JSON.parse(text); } catch (_) { throw new Error('That file is not a Drawfree project.'); }
  if (!isObj(p) || typeof p.version !== 'number' || !Array.isArray(p.frames)) throw new Error('That file is not a Drawfree project.');
  if (!Number.isInteger(p.version) || p.version < 1) throw new Error('That file is not a Drawfree project.');
  if (p.version > PROJECT_VERSION) throw new Error('This project was saved by a newer version of Drawfree.');
  p = migrateProject(p);
  const r = cleanFrames(p.frames.map(f => isObj(f) ? Object.assign({}, f, { items: (Array.isArray(f.items) ? f.items : []).map(fromProjectItem) }) : f));
  if (!r.frames.length) throw new Error('That project has no frames.');
  return { state: { name: cleanName(p.name), aspect: ASPECTS.includes(p.aspect) ? p.aspect : '16:9', frames: r.frames }, fixed: r.fixed, dropped: r.dropped };
}

/* ---------- file names ---------- */
function slug(name) {
  const s = String(name || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return s || 'drawfree';
}
const projectFileName = name => slug(name) + '.drawfree.json';
const frameFileName = (name, n, ext) => slug(name) + '-frame-' + n + '.' + ext;
