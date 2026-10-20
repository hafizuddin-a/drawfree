/* Drawfree app, A: state, config, rendering */
const $ = s => document.querySelector(s);
const BGS = ['#e7f3fd', '#ffffff', '#fff2d3', '#ffe6e2', '#e3f3e5', '#ece6ff'];
const ICONS = {
  hair: '<path d="M6 20v-8a6 6 0 0112 0v8"/><path d="M8.5 11.5c3 0 5-1.4 6.5-3.5"/>',
  face: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10v1.4M15 10v1.4"/><path d="M8.8 14.5c1.8 2 4.6 2 6.4 0"/>',
  top: '<path d="M8.5 4L3 7l2 4.2 3-1V20h8V10.2l3 1L21 7l-5.5-3a3.6 3.6 0 01-7 0z"/>',
  bottom: '<path d="M7 3h10l1.2 18h-4.4L12 12.5 10.2 21H5.8z"/>',
  shoes: '<path d="M3 17c3.2 0 4.6-3 4.6-7.5h4V12c0 2 1.8 3.2 4 3.8l5.4 1.2V20H3z"/>',
  extras: '<circle cx="7" cy="14" r="3.6"/><circle cx="17" cy="14" r="3.6"/><path d="M10.6 14h2.8M3.4 14L5 8M20.6 14L19 8"/>',
  pose: '<circle cx="12" cy="5" r="2.4"/><path d="M12 8v7M12 10.5l-5 3M12 10.5l5 3M12 15l-3.4 5.5M12 15l3.4 5.5"/>',
  props: '<path d="M4 5h16v11h-9l-4 4v-4H4z"/>',
  scene: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 5"/><circle cx="16.5" cy="8.5" r="1.6"/>',
  flip: '<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M8 7L3 12l5 5z"/><path d="M16 7l5 5-5 5z"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8"/>',
  front: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
};
const HEADV = '-58 -290 116 116', FACEV = '-48 -262 96 96';
const SECS = {
  hair: { title: 'Hairstyles', slot: 'hair', list: HAIR, view: HEADV },
  hairC: { title: 'Hair colour', slot: 'hairC', colors: HAIRC },
  face: { title: 'Expressions', slot: 'face', list: FACE, view: FACEV },
  skin: { title: 'Skin tone', slot: 'skin', colors: SKIN },
  top: { title: 'Tops', slot: 'top', list: TOPS, view: '-72 -190 144 150' },
  topC: { title: 'Top colour', slot: 'topC', colors: CLOTH },
  bottom: { title: 'Bottoms', slot: 'bottom', list: BOTTOMS, view: '-72 -40 144 240' },
  botC: { title: 'Bottom colour', slot: 'botC', colors: CLOTH },
  shoes: { title: 'Shoes', slot: 'shoes', list: SHOES, view: '-62 125 124 80' },
  shoeC: { title: 'Shoe colour', slot: 'shoeC', colors: CLOTH },
  glasses: { title: 'Glasses', slot: 'glasses', list: GLASSES, view: FACEV },
  facial: { title: 'Facial hair', slot: 'facial', list: FACIAL, view: FACEV },
  hat: { title: 'Hats', slot: 'hat', list: HATS, view: HEADV },
  hatC: { title: 'Hat colour', slot: 'hatC', colors: CLOTH },
  neck: { title: 'Neckwear', slot: 'neck', list: NECK, view: '-50 -215 100 100' },
  neckC: { title: 'Neckwear colour', slot: 'neckC', colors: CLOTH },
  pose: { title: 'Poses', slot: 'pose', list: POSES, view: '-130 -300 270 500' },
  props: { title: 'Props', slot: 'prop', list: PROPS, view: '-125 -200 250 235' },
  scene: { title: 'Scenes', slot: 'scene', list: SCENES, view: '0 0 960 540' },
  bgC: { title: 'Background colour', slot: 'bg', colors: BGC }
};
const TABS = [
  { id: 'hair', label: 'Hair', secs: ['hair', 'hairC'] },
  { id: 'face', label: 'Face', secs: ['face', 'skin'] },
  { id: 'top', label: 'Tops', secs: ['top', 'topC'] },
  { id: 'bottom', label: 'Bottoms', secs: ['bottom', 'botC'] },
  { id: 'shoes', label: 'Shoes', secs: ['shoes', 'shoeC'] },
  { id: 'extras', label: 'Extras', secs: ['glasses', 'facial', 'hat', 'hatC', 'neck', 'neckC'] },
  { id: 'pose', label: 'Pose', secs: ['pose'] },
  { id: 'props', label: 'Props', secs: ['props'] },
  { id: 'scene', label: 'Scene', secs: ['scene', 'bgC'] }
];

let uid = 1;
const nid = () => 'i' + (uid++) + Math.random().toString(36).slice(2, 5);
const S = { frames: [], fi: 0, sel: null, tab: 'hair', q: '', pose: false, name: DEFAULT_NAME, aspect: '16:9' };
const cur = () => S.frames[S.fi];
const getItem = id => cur().items.find(i => i.id === id);
const selItem = () => (S.sel ? getItem(S.sel) : null);
const stageEl = $('#stage'), boardEl = $('#board'), scrollEl = $('#scroll'), ovEl = $('#overlay');

/* the character the picker edits: the selected one, or the only one on the board */
function charTarget() {
  const it = selItem();
  if (it && it.type === 'char') return it;
  const cs = cur().items.filter(i => i.type === 'char');
  return cs.length === 1 ? cs[0] : null;
}

/* ---------- scene rendering ---------- */
function poseHandles(it) {
  const r = rig(it), k = 1 / it.s;
  let h = '';
  for (const l in r) {
    const p = r[l];
    h += `<circle class="bh" data-limb="${l}" cx="${f1(p[1][0])}" cy="${f1(p[1][1])}" r="${f1(6 * k)}" style="fill:#fff;stroke:var(--accent);stroke-width:${f1(2.2 * k)}px"><title>Click to flip the bend</title></circle>`;
    h += `<circle class="jh" data-limb="${l}" cx="${f1(p[2][0])}" cy="${f1(p[2][1])}" r="${f1(11 * k)}" style="fill:var(--accent);fill-opacity:.85;stroke:#fff;stroke-width:${f1(2.5 * k)}px"><title>Drag to move</title></circle>`;
  }
  return h;
}
function itemSVG(it, live) {
  const isChar = it.type === 'char';
  const noFlip = !isChar && BY.prop[it.kind] && BY.prop[it.kind].noFlip;
  const flip = it.flip && !noFlip ? -1 : 1;
  const hit = live ? `<rect class="hit" x="-130" y="${isChar ? -290 : -200}" width="260" height="${isChar ? 490 : 240}" fill="transparent"/>` : '';
  const inner = isChar ? charSVG(it) : propSVG(it);
  const handles = live && S.pose && isChar && it.id === S.sel ? poseHandles(it) : '';
  let shadow = '';
  if (isChar && Math.abs(it.r || 0) < 8) {
    const r = rig(it), ay = Math.max(r.lL[2][1], r.lR[2][1]) + 15, ax = (r.lL[2][0] + r.lR[2][0]) / 2 + 6;
    shadow = `<ellipse cx="${f1(ax)}" cy="${f1(ay)}" rx="64" ry="7" fill="#000" fill-opacity=".1"/>`;
  }
  return `<g class="item" data-id="${it.id}" transform="translate(${f1(it.x)} ${f1(it.y)}) rotate(${f1(it.r || 0)}) scale(${f1(it.s * 100) / 100})">${hit}<g class="body" transform="scale(${flip} 1)">${shadow}${inner}${handles}</g></g>`;
}
const frameSVG = (f, live) => f.items.map(it => itemSVG(it, live)).join('');
function renderStage() {
  const f = cur();
  stageEl.innerHTML = frameBG(f, true) + frameSVG(f, true);
  renderOverlay();
}
function renderOverlay() {
  const it = selItem();
  const g = it && stageEl.querySelector(`.item[data-id="${it.id}"] .body`);
  if (!g) { ovEl.innerHTML = ''; return; }
  const r = g.getBoundingClientRect(), b = boardEl.getBoundingClientRect();
  const x = r.left - b.left - 6, y = r.top - b.top - 6, w = r.width + 12, h = r.height + 12;
  let tx = x + w + 12;
  if (tx + 44 > b.width) tx = Math.max(4, x - 56);
  const ty = Math.max(4, Math.min(y, b.height - 220));
  const ic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
  const noFlip = it.type === 'prop' && BY.prop[it.kind].noFlip;
  const btns = [
    it.type === 'char' ? `<button type="button" data-act="pose" class="${S.pose ? 'on' : ''}" title="Pose: drag hands and feet" aria-label="Pose">${ic('pose')}</button>` : '',
    noFlip ? '' : `<button type="button" data-act="flip" title="Flip to face the other way" aria-label="Flip">${ic('flip')}</button>`,
    `<button type="button" data-act="dup" title="Duplicate" aria-label="Duplicate">${ic('dup')}</button>`,
    `<button type="button" data-act="front" title="Bring to front" aria-label="Bring to front">${ic('front')}</button>`,
    `<button type="button" data-act="del" title="Delete" aria-label="Delete">${ic('del')}</button>`
  ].join('');
  const corners = ['nw', 'ne', 'sw', 'se'].map(c => `<i class="corner" data-c="${c}" style="top:${c[0] === 'n' ? '0' : '100%'};left:${c[1] === 'w' ? '0' : '100%'}"></i>`).join('');
  const above = y > 52, rtop = above ? y - 40 : y + h + 40, ltop = above ? y - 28 : y + h;
  const rot = `<i class="rotline" style="left:${f1(x + w / 2 - 1)}px;top:${f1(ltop)}px"></i><i class="rot" data-act-none="1" style="left:${f1(x + w / 2)}px;top:${f1(rtop)}px" title="Rotate. Shift snaps to 15°, double-click resets."><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4"/></svg></i>`;
  ovEl.innerHTML = `<div class="selbox" style="left:${f1(x)}px;top:${f1(y)}px;width:${f1(w)}px;height:${f1(h)}px">${corners}</div>${rot}` +
    `<div class="tb" style="left:${f1(tx)}px;top:${f1(ty)}px">${btns}</div>`;
}

/* ---------- picker panel ---------- */
function thumb(k, o) {
  const sec = SECS[k], base = charTarget() || newChar();
  if (k === 'scene') return `<svg viewBox="0 0 960 540" aria-hidden="true">${frameBG({ bg: cur().bg, scene: o.id })}</svg>`;
  let inner;
  if (k === 'props') inner = propSVG({ kind: o.id, text: o.text });
  else if (k === 'pose') inner = charSVG(Object.assign({}, base, { pose: poseFrom(o.t) }));
  else inner = charSVG(Object.assign({}, base, { [sec.slot]: o.id }));
  return `<svg viewBox="${sec.view}" aria-hidden="true">${inner}</svg>`;
}
function thBtn(k, o) {
  const c = charTarget(), sec = SECS[k];
  const on = k === 'scene' ? (cur().scene || 'none') === o.id : c && k !== 'pose' && k !== 'props' && c[sec.slot] === o.id;
  return `<button type="button" class="th${on ? ' on' : ''}" data-sec="${k}" data-id="${o.id}" title="${esc(o.name)}" aria-label="${esc(o.name)}">${thumb(k, o)}</button>`;
}
function secHTML(k) {
  const sec = SECS[k], c = charTarget();
  let h = `<h3>${sec.title}</h3>`;
  if (sec.list) h += `<div class="grid${k === 'scene' ? ' wide' : ''}">${sec.list.map(o => thBtn(k, o)).join('')}</div>`;
  if (sec.colors) h += `<div class="swatches">${sec.colors.map(col =>
    `<button type="button" class="sw${(sec.slot === 'bg' ? cur().bg === col : c && c[sec.slot] === col) ? ' on' : ''}" data-slot="${sec.slot}" data-color="${col}" style="background:${col}" aria-label="Colour ${col}" title="${col}"></button>`).join('')}</div>`;
  return h;
}
function renderPanel() {
  const q = S.q.trim().toLowerCase(), it = selItem();
  let h = '';
  if (q) {
    Object.keys(SECS).filter(k => SECS[k].list).forEach(k => {
      const hits = SECS[k].list.filter(o => (o.name + ' ' + o.tags).toLowerCase().includes(q));
      if (hits.length) h += `<h3>${SECS[k].title}</h3><div class="grid">${hits.map(o => thBtn(k, o)).join('')}</div>`;
    });
    if (!h) h = `<div class="empty">Nothing matches “${esc(q)}”.</div>`;
  } else {
    if (!charTarget() && S.tab !== 'props' && S.tab !== 'scene') h += '<p class="hint">Click a character on the board to dress it.</p>';
    if (S.tab === 'pose') h += '<p class="hint">Pick a preset, or turn on Pose in the toolbar and drag the blue hand and foot dots. Click a white elbow or knee dot to flip its bend.</p>';
    if (S.tab === 'props' && it && it.type === 'prop' && it.kind === 'bubble')
      h += `<h3>Bubble text</h3><input class="field" id="btext" type="text" value="${esc(it.text || '')}" aria-label="Bubble text" autocomplete="off">`;
    TABS.find(t => t.id === S.tab).secs.forEach(k => { h += secHTML(k); });
  }
  const st = scrollEl.scrollTop;
  scrollEl.innerHTML = h;
  scrollEl.scrollTop = st;
}
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(t =>
    `<button type="button" class="tab${t.id === S.tab && !S.q ? ' on' : ''}" role="tab" data-tab="${t.id}" title="${t.label}" aria-label="${t.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t.id === 'extras' ? 'extras' : t.id]}</svg></button>`).join('');
}
function renderBgs() {
  $('#bgs').innerHTML = BGS.map(c => `<button type="button" class="${cur().bg === c ? 'on' : ''}" data-bg="${c}" style="background:${c}" aria-label="Background ${c}" title="Background"></button>`).join('');
}
function renderStrip() {
  const frames = S.frames.map((f, i) =>
    `<button type="button" class="fr${i === S.fi ? ' on' : ''}" data-i="${i}" aria-label="Frame ${i + 1}"><svg viewBox="0 0 960 540">${frameBG(f)}${frameSVG(f, false)}</svg><span>${i + 1}</span></button>`).join('');
  $('#frames').innerHTML = frames + '<button type="button" class="fr add" id="add-frame" aria-label="Add frame" title="Add frame">+</button>';
  const n = $('#note');
  if (document.activeElement !== n) n.value = cur().note || '';
  $('#del-frame').disabled = S.frames.length < 2;
  $('#undo').disabled = !hist.length; $('#redo').disabled = !redoStack.length;
}
function refresh() { renderStage(); renderPanel(); renderTabs(); renderBgs(); renderStrip(); save(); }

/* ---------- history and persistence ---------- */
const hist = [], redoStack = [];
const packState = () => JSON.stringify({ frames: S.frames, fi: S.fi });
function snap() { hist.push(packState()); if (hist.length > 80) hist.shift(); redoStack.length = 0; }
function restore(json) {
  const d = JSON.parse(json);
  S.frames = d.frames; S.fi = Math.min(d.fi, d.frames.length - 1);
  if (S.sel && !getItem(S.sel)) S.sel = null;
  refresh();
}
function doUndo() { if (!hist.length) return; redoStack.push(packState()); restore(hist.pop()); }
function doRedo() { if (!redoStack.length) return; hist.push(packState()); restore(redoStack.pop()); }
const KEY = 'drawfree.v1', OLD_KEY = 'inkframe.v1';
/* Autosave is debounced (500 ms) and flushed when the tab is hidden. It must never throw: storage can be blocked. */
let saveTimer, storageWarned = false;
function saveNow() {
  clearTimeout(saveTimer); saveTimer = 0;
  try { localStorage.setItem(KEY, JSON.stringify({ frames: S.frames, fi: S.fi, name: S.name, aspect: S.aspect })); }
  catch (_) { if (!storageWarned) { storageWarned = true; toast('Autosave is unavailable in this browser. Use Save to keep your work.', 5000); } }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); }
window.addEventListener('pagehide', () => { if (saveTimer) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) saveNow(); });
/* Stored data is untrusted: unknown part ids fall back to the section's first part, bad colours to defaults. */
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || 'null');
    const r = d && cleanFrames(d.frames);
    if (r && r.frames.length) {
      S.frames = r.frames; S.fi = Math.min(Math.max(0, d.fi | 0), r.frames.length - 1);
      S.name = cleanName(d.name); S.aspect = ASPECTS.includes(d.aspect) ? d.aspect : '16:9';
      return true;
    }
  } catch (_) {}
  return false;
}
let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
