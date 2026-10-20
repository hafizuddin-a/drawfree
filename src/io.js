/* Drawfree IO: frame export (SVG, PNG), project save and open, the export dialog. */
const FRAME_W = 960, FRAME_H = 540;

/* Standalone SVG for one frame. No editor chrome: itemSVG(.., false) skips hit areas and pose handles.
   Layers are named: background, scene, character-N (N is the item's position in the frame). */
function exportSVG(f = cur(), o = {}) {
  const k = o.scale || 2, sc = sceneSVG(f);
  const items = f.items.map((it, n) => `<g id="${it.type === 'char' ? 'character' : it.kind}-${n + 1}">${itemSVG(it, false)}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME_W} ${FRAME_H}" width="${FRAME_W * k}" height="${FRAME_H * k}" role="img"><title>${esc(f.note || 'Storyboard frame')}</title>` +
    (o.transparent ? '' : `<rect id="background" width="${FRAME_W}" height="${FRAME_H}" fill="${f.bg}"/>`) +
    `${sc ? sc.replace('<g ', '<g id="scene" ') : ''}${items}</svg>`;
}
function svgToPng(svg, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(b => (b ? resolve(b) : reject(new Error('The browser could not encode the PNG.'))), 'image/png');
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('The browser could not draw this frame.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const EXPORT_KEY = 'drawfree.export';
const exportPrefs = { fmt: 'png', scale: 2, transparent: false };
try { Object.assign(exportPrefs, JSON.parse(localStorage.getItem(EXPORT_KEY) || '{}')); } catch (_) {}
if (!['png', 'svg'].includes(exportPrefs.fmt)) exportPrefs.fmt = 'png';
if (![1, 2, 3].includes(exportPrefs.scale)) exportPrefs.scale = 2;
exportPrefs.transparent = exportPrefs.transparent === true;

/* Builds the file for the current frame. Resolves to { blob, name }. */
async function buildFrameExport(o) {
  const n = S.fi + 1, f = cur();
  if (o.fmt === 'svg') return { blob: new Blob([exportSVG(f, { transparent: o.transparent })], { type: 'image/svg+xml' }), name: frameFileName(S.name, n, 'svg') };
  const w = FRAME_W * o.scale, h = FRAME_H * o.scale;
  return { blob: await svgToPng(exportSVG(f, { transparent: o.transparent, scale: o.scale }), w, h), name: frameFileName(S.name, n, 'png') };
}
function copySVG() {
  const svg = exportSVG(cur(), { transparent: exportPrefs.transparent });
  const fallback = () => { const t = $('#modal-text'); t.value = svg; openDialog('#modal', '#modal-text'); t.select(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(svg).then(() => toast('SVG copied'), fallback);
  else fallback();
}

/* ---------- projects ---------- */
function saveProject() {
  saveNow();
  const text = JSON.stringify(toProject(S), null, 2);
  downloadBlob(new Blob([text], { type: 'application/json' }), projectFileName(S.name));
  toast('Project saved');
}
const readText = file => new Promise((res, rej) => {
  const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('Could not read that file.')); fr.readAsText(file);
});
async function openProjectFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) { toast('That file is too large to be a Drawfree project.', 4000); return; }
  try {
    const r = parseProject(await readText(file));
    snap();                                  // one undo step brings the previous frames back
    S.frames = r.state.frames; S.fi = 0; S.sel = null; S.name = r.state.name; S.aspect = r.state.aspect;
    refresh(); syncName();
    const odd = r.fixed + r.dropped;
    toast(odd ? `Opened “${S.name}”. ${odd} unknown ${odd === 1 ? 'value was' : 'values were'} replaced.` : `Opened “${S.name}”. Undo goes back.`, 4000);
  } catch (e) { toast(e.message || 'Could not open that file.', 4000); }
}
function syncName() { const n = $('#pname'); if (document.activeElement !== n) n.value = S.name; }

/* ---------- dialogs: focus moves in, Tab stays inside, Esc closes, focus returns ---------- */
let dialogOpener = null;
function openDialog(sel, focusSel) {
  dialogOpener = document.activeElement;
  const m = $(sel); m.hidden = false;
  (focusSel ? $(focusSel) : m.querySelector('input,button')).focus();
}
function closeDialogs() {
  let any = false;
  document.querySelectorAll('.modal').forEach(m => { if (!m.hidden) { m.hidden = true; any = true; } });
  if (any && dialogOpener && dialogOpener.focus) dialogOpener.focus();
  return any;
}
document.addEventListener('keydown', e => {
  const m = document.querySelector('.modal:not([hidden])'); if (!m) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDialogs(); return; }
  if (e.key !== 'Tab') return;
  const f = [...m.querySelectorAll('input,button,textarea')].filter(el => !el.matches(':disabled') && el.offsetParent !== null && (el.type !== 'radio' || el.checked));
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}, true);

/* ---------- export dialog ---------- */
function exportOpts() {
  const q = n => document.querySelector(`input[name="${n}"]:checked`);
  return { fmt: q('ex-fmt').value, scale: +q('ex-scale').value, transparent: $('#ex-transp').checked };
}
function syncExport() {
  const o = exportOpts();
  $('#ex-scale-set').disabled = o.fmt !== 'png';
  $('#ex-title-n').textContent = 'Frame ' + (S.fi + 1);
  $('#ex-go').textContent = 'Download ' + o.fmt.toUpperCase();
  $('#ex-copy').hidden = o.fmt !== 'svg';
  Object.assign(exportPrefs, o);
  try { localStorage.setItem(EXPORT_KEY, JSON.stringify(o)); } catch (_) {}
}
function showExport() {
  document.querySelector(`input[name="ex-fmt"][value="${exportPrefs.fmt}"]`).checked = true;
  document.querySelector(`input[name="ex-scale"][value="${exportPrefs.scale}"]`).checked = true;
  $('#ex-transp').checked = exportPrefs.transparent;
  $('#ex-status').textContent = '';
  syncExport(); openDialog('#export-modal', '#ex-go');
}
async function runExport() {
  const go = $('#ex-go'), st = $('#ex-status'), o = exportOpts();
  go.disabled = true; st.textContent = 'Preparing…';
  try {
    const { blob, name } = await buildFrameExport(o);
    downloadBlob(blob, name); st.textContent = ''; closeDialogs(); toast('Downloaded ' + name);
  } catch (e) { st.textContent = e.message || 'Export failed.'; }
  go.disabled = false;
}
$('#export').addEventListener('click', showExport);
$('#export-modal').addEventListener('change', syncExport);
$('#ex-go').addEventListener('click', runExport);
$('#ex-copy').addEventListener('click', () => { closeDialogs(); copySVG(); });
$('#ex-close').addEventListener('click', closeDialogs);
$('#modal-close').addEventListener('click', closeDialogs);
document.querySelectorAll('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) closeDialogs(); }));

/* ---------- project buttons, file picker, drag and drop ---------- */
$('#save').addEventListener('click', saveProject);
$('#open').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', e => { openProjectFile(e.target.files[0]); e.target.value = ''; });
$('#pname').addEventListener('input', e => { S.name = cleanName(e.target.value); save(); });
$('#pname').addEventListener('blur', syncName);
$('#pname').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
window.addEventListener('dragenter', e => { if (hasFiles(e)) { dragDepth++; document.body.classList.add('dropping'); } });
window.addEventListener('dragleave', e => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); } });
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('dropping');
  openProjectFile(e.dataTransfer.files[0]);
});
