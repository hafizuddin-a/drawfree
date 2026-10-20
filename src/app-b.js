/* Drawfree app, B: actions, input handling, boot */
function seed() {
  const wave = POSES.find(p => p.id === 'wave').t, hips = POSES.find(p => p.id === 'hips').t;
  const A = newChar({ id: nid(), x: 270, y: 300, s: 0.82, hat: 'beanie', hatC: '#ffffff', facial: 'beard', hairC: '#4a2f22',
    top: 'tee', topC: '#141414', bottom: 'jeans', botC: '#cfe8ff', pose: poseFrom(wave) });
  const B = newChar({ id: nid(), x: 690, y: 300, s: 0.82, flip: true, hair: 'bun', hairC: '#141414', glasses: 'round',
    top: 'blazer', topC: '#ffffff', neck: 'scarf', neckC: '#ff9a4d', bottom: 'skirt', botC: '#141414', shoes: 'boot', shoeC: '#141414', pose: poseFrom(hips) });
  const bub = { id: nid(), type: 'prop', kind: 'bubble', x: 480, y: 118, s: 1, flip: false, text: 'Morning! Ready to shoot?' };
  const plant = { id: nid(), type: 'prop', kind: 'plant', x: 880, y: 462, s: 1, flip: false };
  S.frames = [{ id: nid(), bg: BGS[0], scene: 'cafe', note: 'Two colleagues meet outside the café.', items: [A, B, bub, plant] }];
  S.fi = 0; S.sel = null; S.name = DEFAULT_NAME; S.aspect = '16:9';
}
function needChar() {
  const c = charTarget();
  if (!c) { toast('Click a character on the board first'); return null; }
  S.sel = c.id;
  return c;
}
function addProp(kind) {
  snap();
  const def = BY.prop[kind], y = { bubble: 118, plant: 462, chair: 462, table: 462 }[kind] || 300;
  const it = { id: nid(), type: 'prop', kind, x: 480 + Math.round((Math.random() - 0.5) * 160), y, s: 1, flip: false };
  if (def.text) it.text = def.text;
  cur().items.push(it); S.sel = it.id; refresh();
}
function addChar() {
  snap();
  const n = cur().items.filter(i => i.type === 'char').length;
  const c = newChar({ id: nid(), x: 240 + (n % 4) * 160, y: 300 });
  cur().items.push(c); S.sel = c.id; refresh();
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function shuffle() {
  let c = charTarget();
  if (!c) {
    if (cur().items.some(i => i.type === 'char')) { toast('Click a character first'); return; }
    addChar(); c = charTarget();
  } else snap();
  Object.assign(c, {
    hair: pick(HAIR).id, hairC: pick(HAIRC), face: pick(FACE).id, skin: pick(SKIN), top: pick(TOPS).id, topC: pick(CLOTH),
    bottom: pick(BOTTOMS).id, botC: pick(CLOTH), shoes: pick(SHOES).id, shoeC: pick(CLOTH), hatC: pick(CLOTH), neckC: pick(CLOTH),
    glasses: Math.random() < 0.4 ? pick(GLASSES).id : 'none', facial: Math.random() < 0.3 ? pick(FACIAL).id : 'none',
    hat: Math.random() < 0.3 ? pick(HATS).id : 'none', neck: Math.random() < 0.3 ? pick(NECK).id : 'none'
  });
  S.sel = c.id; refresh();
}
function act(a) {
  const it = selItem();
  if (!it) return;
  if (a === 'pose') { S.pose = !S.pose; if (S.pose) { S.tab = 'pose'; S.q = ''; $('#q').value = ''; } refresh(); return; }
  snap();
  const items = cur().items;
  if (a === 'flip') it.flip = !it.flip;
  else if (a === 'dup') { const c = JSON.parse(JSON.stringify(it)); c.id = nid(); c.x += 40; items.push(c); S.sel = c.id; }
  else if (a === 'front') { items.splice(items.indexOf(it), 1); items.push(it); }
  else if (a === 'del') { items.splice(items.indexOf(it), 1); S.sel = null; }
  refresh();
}
function addFrame() { snap(); S.frames.push({ id: nid(), bg: cur().bg, scene: cur().scene || 'none', note: '', items: [] }); S.fi = S.frames.length - 1; S.sel = null; refresh(); }
function dupFrame() {
  snap();
  const f = JSON.parse(JSON.stringify(cur())); f.id = nid(); f.items.forEach(i => { i.id = nid(); });
  S.frames.splice(S.fi + 1, 0, f); S.fi++; S.sel = null; refresh();
}
function delFrame() { if (S.frames.length < 2) return; snap(); S.frames.splice(S.fi, 1); S.fi = Math.max(0, S.fi - 1); S.sel = null; refresh(); }

/* ---------- panel and toolbar events ---------- */
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  S.tab = b.dataset.tab; S.q = ''; $('#q').value = ''; renderTabs(); renderPanel(); scrollEl.scrollTop = 0;
});
$('#q').addEventListener('input', e => { S.q = e.target.value; renderTabs(); renderPanel(); });
scrollEl.addEventListener('click', e => {
  const t = e.target.closest('.th,.sw'); if (!t) return;
  if (t.classList.contains('sw')) {
    if (t.dataset.slot === 'bg') { snap(); cur().bg = t.dataset.color; refresh(); return; }
    const c = needChar(); if (!c) return;
    snap(); c[t.dataset.slot] = t.dataset.color; refresh(); return;
  }
  const k = t.dataset.sec, id = t.dataset.id;
  if (k === 'props') { addProp(id); return; }
  if (k === 'scene') { snap(); cur().scene = id; refresh(); return; }
  const c = needChar(); if (!c) return;
  snap();
  if (k === 'pose') c.pose = poseFrom(POSES.find(p => p.id === id).t); else c[SECS[k].slot] = id;
  refresh();
});
scrollEl.addEventListener('focusin', e => { if (e.target.id === 'btext') snap(); });
scrollEl.addEventListener('input', e => {
  if (e.target.id !== 'btext') return;
  const it = selItem(); if (it) { it.text = e.target.value; renderStage(); save(); }
});
ovEl.addEventListener('dblclick', e => { if (!e.target.closest('.rot')) return; const it = selItem(); if (it) { snap(); it.r = 0; refresh(); } });
ovEl.addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (b) act(b.dataset.act); });
$('#bgs').addEventListener('click', e => { const b = e.target.closest('button[data-bg]'); if (!b) return; snap(); cur().bg = b.dataset.bg; refresh(); });
$('#frames').addEventListener('click', e => {
  if (e.target.closest('#add-frame')) { addFrame(); return; }
  const b = e.target.closest('.fr'); if (!b) return;
  S.fi = +b.dataset.i; S.sel = null; refresh();
});
$('#note').addEventListener('input', e => { cur().note = e.target.value; save(); });
$('#add-char').addEventListener('click', addChar);
$('#shuffle').addEventListener('click', shuffle);
$('#undo').addEventListener('click', doUndo);
$('#redo').addEventListener('click', doRedo);
$('#reset').addEventListener('click', () => { snap(); try { localStorage.removeItem(KEY); } catch (_) {} seed(); refresh(); });
$('#dup-frame').addEventListener('click', dupFrame);
$('#del-frame').addEventListener('click', delFrame);

/* ---------- canvas dragging: move, scale, joints ---------- */
let drag = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const svgPt = e => new DOMPoint(e.clientX, e.clientY).matrixTransform(stageEl.getScreenCTM().inverse());
stageEl.addEventListener('pointerdown', e => {
  const t = e.target, el = t.closest && t.closest('.item');
  if (!el) { if (S.sel) { S.sel = null; refresh(); } return; }
  const it = getItem(el.dataset.id); if (!it) return;
  e.preventDefault();
  if (t.classList.contains('bh')) {                       // elbow or knee dot: flip bend direction
    snap(); const l = t.dataset.limb;
    it.pose[l] = ik(LIMBS[l][0], LIMBS[l][1], LIMBS[l][2], rig(it)[l][2], -it.pose[l][2]);
    refresh(); return;
  }
  if (t.classList.contains('jh')) { drag = { k: 'joint', id: it.id, limb: t.dataset.limb, snapped: false }; return; }
  if (S.sel !== it.id) { S.sel = it.id; renderPanel(); }
  const p = svgPt(e);
  drag = { k: 'move', id: it.id, dx: it.x - p.x, dy: it.y - p.y, x0: e.clientX, y0: e.clientY, snapped: false };
  renderStage();
});
ovEl.addEventListener('pointerdown', e => {
  const c = e.target.closest('.corner, .rot'), it = selItem(); if (!c || !it) return;
  e.preventDefault();
  const o = new DOMPoint(it.x, it.y).matrixTransform(stageEl.getScreenCTM());
  if (c.classList.contains('rot')) { drag = { k: 'rotate', id: it.id, cx: o.x, cy: o.y, a0: Math.atan2(e.clientX - o.x, -(e.clientY - o.y)), r0: it.r || 0, snapped: false }; return; }
  drag = { k: 'scale', id: it.id, cx: o.x, cy: o.y, d0: Math.hypot(e.clientX - o.x, e.clientY - o.y) || 1, s0: it.s, snapped: false };
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const it = getItem(drag.id); if (!it) { drag = null; return; }
  if (!drag.snapped) {
    if (drag.k === 'move' && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 3) return;
    snap(); drag.snapped = true;
  }
  if (drag.k === 'move') {
    const p = svgPt(e); it.x = clamp(p.x + drag.dx, -40, 1000); it.y = clamp(p.y + drag.dy, -40, 700);
  } else if (drag.k === 'joint') {
    const body = stageEl.querySelector(`.item[data-id="${it.id}"] .body`); if (!body) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(body.getScreenCTM().inverse()), l = drag.limb;
    it.pose[l] = ik(LIMBS[l][0], LIMBS[l][1], LIMBS[l][2], [pt.x, pt.y], it.pose[l][2]);
  } else if (drag.k === 'rotate') {
    let r = drag.r0 + (Math.atan2(e.clientX - drag.cx, -(e.clientY - drag.cy)) - drag.a0) / RAD;
    if (e.shiftKey) r = Math.round(r / 15) * 15;
    it.r = Math.round((((r + 540) % 360) - 180) * 10) / 10;
  } else if (drag.k === 'scale') {
    it.s = clamp(drag.s0 * Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) / drag.d0, 0.3, 3);
  }
  renderStage();
});
window.addEventListener('pointerup', () => { if (drag) { const moved = drag.snapped; drag = null; if (moved) { save(); renderStrip(); renderPanel(); } } });

window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea';
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (mod && !e.shiftKey && !e.altKey && (k === 's' || k === 'o')) { e.preventDefault(); if (k === 's') saveProject(); else $('#file').click(); return; }
  if (typing) return;
  if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
  if (mod && k === 'y') { e.preventDefault(); doRedo(); return; }
  const it = selItem(); if (!it || mod) return;
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); act('del'); }
  else if (k === 'escape') { S.sel = null; refresh(); }
  else if (k === 'f') act('flip');
  else if (e.code === 'BracketLeft' || e.code === 'BracketRight') { snap(); it.r = (it.r || 0) + (e.code === 'BracketRight' ? 1 : -1) * (e.shiftKey ? 15 : 5); refresh(); }
  else if (k.startsWith('arrow')) {
    e.preventDefault(); snap();
    const d = e.shiftKey ? 20 : 4;
    if (k === 'arrowleft') it.x -= d; if (k === 'arrowright') it.x += d; if (k === 'arrowup') it.y -= d; if (k === 'arrowdown') it.y += d;
    refresh();
  }
});

/* ---------- boot ---------- */
if (!load()) seed();
refresh(); syncName();
if (window.ResizeObserver) new ResizeObserver(() => renderOverlay()).observe(boardEl);
