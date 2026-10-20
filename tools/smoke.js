// jsdom smoke test of the bundled page. usage: node tools/smoke.js [dir-containing-node_modules]
const fs = require('fs'), path = require('path');
const base = process.argv[2], req = m => (base ? require(path.resolve(base, 'node_modules', m)) : require(m));
const { JSDOM } = req('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../dist/artifact.html'), 'utf8')
  .replace(/<link[^>]*>/g, '');
/* boots the bundled page in jsdom. opts.blockStorage makes localStorage throw, like a locked-down browser */
function boot(opts = {}) {
  const errors = [], downloads = [], blobs = new Map();
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/',
    beforeParse(w) {
      w.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return { x: this.x, y: this.y }; } };
      w.SVGElement.prototype.getScreenCTM = function () { return { inverse() { return { _inv: 1 }; } }; };
      w.Element.prototype.getBoundingClientRect = function () { return { left: 100, top: 80, width: 120, height: 300, right: 220, bottom: 380 }; };
      w.URL.createObjectURL = b => { const u = 'blob:test/' + blobs.size; blobs.set(u, b); return u; };
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download, blob: blobs.get(this.href) }); };
      if (opts.blockStorage) Object.defineProperty(w, 'localStorage', { get() { throw new w.DOMException('blocked', 'SecurityError'); } });
      w.addEventListener('error', e => errors.push(e.message));
    }
  });
  return { dom, errors, downloads };
}
const readBlob = (w, b) => new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(b); });
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
(async () => {
const { dom, errors, downloads } = boot();
const w = dom.window, d = w.document;
const ev = (el, type) => el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: 300, clientY: 300 }));
const S = k => w.eval(k);
const out = {};
out.items = d.querySelectorAll('#stage .item').length;
out.hairThumbs = d.querySelectorAll('.th[data-sec="hair"]').length;
const firstChar = d.querySelector('#stage .item .hit');
ev(firstChar, 'pointerdown'); ev(w, 'pointerup');
out.selected = S('S.sel') !== null;
out.toolbarButtons = d.querySelectorAll('#overlay .tb button').length;
d.querySelector('.th[data-sec="hair"][data-id="curly"]').click();
out.hairAfterPick = S('selItem().hair');
d.querySelector('#overlay button[data-act="flip"]').click();
out.flipped = S('selItem().flip');
d.querySelector('#undo').click();
out.flipAfterUndo = S('selItem().flip');
d.querySelector('#overlay button[data-act="pose"]').click();
out.poseHandles = d.querySelectorAll('#stage .jh').length;
out.poseTab = S('S.tab');
d.querySelector('.th[data-sec="pose"][data-id="cheer"]').click();
out.cheerLeftShoulder = Math.round(S('selItem().pose.aL[0]'));
d.querySelector('.tab[data-tab="props"]').click();
d.querySelector('.th[data-sec="props"][data-id="chair"]').click();
out.itemsAfterProp = S('cur().items.length');
const q = d.querySelector('#q'); q.value = 'beard'; q.dispatchEvent(new w.Event('input', { bubbles: true }));
out.searchHits = d.querySelectorAll('.th').length;
d.querySelector('#add-frame') && d.querySelector('#add-frame').click();
out.frames = S('S.frames.length');
out.exportOk = S('exportSVG()').startsWith('<svg') && !S('exportSVG()').includes('class="hit"') && !S('exportSVG()').includes('class="jh"');
d.querySelector('.fr[data-i="0"]').click();
d.querySelector('#stage .item .hit').dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 })); ev(w, 'pointerup');
const rot = d.querySelector('#overlay .rot');
out.rotHandle = !!rot;
rot.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 100 }));
w.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, clientX: 420, clientY: 160 }));
w.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true }));
out.rotated = S('selItem().r');
out.rotInSvg = d.querySelector('#stage .item[data-id="' + S('S.sel') + '"]').getAttribute('transform').includes('rotate(' + S('selItem().r'));
d.querySelector('#overlay .rot').dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
out.rotAfterDbl = S('selItem().r');
w.dispatchEvent(new w.KeyboardEvent('keydown', { bubbles: true, code: 'BracketRight', key: ']' }));
out.rotAfterKey = S('selItem().r');
d.querySelector('.tab[data-tab="scene"]').click();
out.sceneThumbs = d.querySelectorAll('.th[data-sec="scene"]').length;
d.querySelector('.th[data-sec="scene"][data-id="park"]').click();
out.scene = S('cur().scene');
d.querySelector('.sw[data-slot="bg"][data-color="#ffe6e2"]').click();
out.bg = S('cur().bg');
const svgx = S('exportSVG()');
out.exportScene = svgx.includes('id="scene"') && svgx.includes('id="background"') && svgx.includes('id="character-1"');

/* ---- export dialog: SVG download ---- */
const modal = d.querySelector('#export-modal');
d.querySelector('#export').click();
out.exportDialogOpens = !modal.hidden && d.activeElement.id === 'ex-go';
out.pngScaleEnabled = !d.querySelector('#ex-scale-set').disabled;
const fmtSvg = d.querySelector('input[name="ex-fmt"][value="svg"]'); fmtSvg.checked = true; fmtSvg.dispatchEvent(new w.Event('change', { bubbles: true }));
out.pngScaleDisabledForSvg = d.querySelector('#ex-scale-set').disabled && d.querySelector('#ex-go').textContent === 'Download SVG';
d.querySelector('#ex-go').click(); await tick();
const dl = downloads.pop(), svgText = dl ? await readBlob(w, dl.blob) : '';
out.svgDownloadName = dl && dl.name;
out.svgDownloadClean = /<svg [^>]*width="1920"/.test(svgText) && !/class="(hit|jh|bh)"|var\(--/.test(svgText);
const xml = new w.DOMParser().parseFromString(svgText, 'image/svg+xml');
out.svgIsValidXml = !xml.querySelector('parsererror') && !!xml.querySelector('#background') && !!xml.querySelector('#character-1');
out.dialogClosedAfterExport = modal.hidden;
d.querySelector('#export').click();
d.querySelector('#ex-transp').checked = true;
fmtSvg.dispatchEvent(new w.Event('change', { bubbles: true }));
d.querySelector('#ex-go').click(); await tick();
const tsvg = await readBlob(w, downloads.pop().blob);
out.transparentSvgHasNoBackground = !tsvg.includes('id="background"') && tsvg.includes('id="character-1"');
d.querySelector('#export').click();
w.dispatchEvent(new w.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })); d.dispatchEvent(new w.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
out.escapeClosesDialog = modal.hidden;

/* ---- project save, edit, open ---- */
d.querySelector('#pname').value = 'My Film: Act 1'; d.querySelector('#pname').dispatchEvent(new w.Event('input', { bubbles: true }));
d.querySelector('#save').click(); await tick();
const sv = downloads.pop(), fileText = await readBlob(w, sv.blob), proj = JSON.parse(fileText);
out.saveName = sv.name;
out.saveShape = proj.version === 1 && proj.name === 'My Film: Act 1' && proj.frames.length === S('S.frames.length') && proj.frames[0].items[0].kind === 'char' && !fileText.includes('"type"');
const before = S('JSON.stringify(toProject(S).frames)'), framesBefore = S('S.frames.length');
d.querySelector('.fr.add').click(); d.querySelector('.fr.add').click();            // change the project, then open the saved file over it
out.framesAfterEdit = S('S.frames.length');
const f = new w.File([fileText], 'x.drawfree.json', { type: 'application/json' });
await w.eval('openProjectFile')(f); await tick();
out.openRestoresFrames = S('S.frames.length') === framesBefore;
out.openRoundTripExact = S('JSON.stringify(toProject(S).frames)') === before;
out.openedNameShown = d.querySelector('#pname').value;
d.querySelector('#undo').click();
out.undoOpenBringsBackEdit = S('S.frames.length') === 4;
await w.eval('openProjectFile')(new w.File(['{"hello":1}'], 'bad.json')); await tick();
out.badFileToast = d.querySelector('#toast').textContent;
out.badFileKeepsState = S('S.frames.length') === 4;
const dropEv = new w.Event('drop', { bubbles: true, cancelable: true });
dropEv.dataTransfer = { types: ['Files'], files: [new w.File([fileText], 'dropped.drawfree.json')] };
w.dispatchEvent(dropEv); await tick();
out.dropOpens = S('S.frames.length') === framesBefore;
w.dispatchEvent(new w.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 's', ctrlKey: true })); await tick();
out.ctrlSSaves = downloads.length > 0 && downloads.pop().name.endsWith('.drawfree.json');
out.errors = errors;
console.log(JSON.stringify(out, null, 1));

/* ---- autosave: debounced, restored on reload, and harmless when storage is blocked ---- */
const bad = Object.entries(out).filter(([k, v]) => v === false && k !== 'flipAfterUndo');   // flipAfterUndo is meant to be false
const blocked = boot({ blockStorage: true });
await tick(700);
const bw = blocked.dom.window;
const blockedOut = { itemsWhenStorageBlocked: bw.document.querySelectorAll('#stage .item').length, errors: blocked.errors, toast: bw.document.querySelector('#toast').textContent };
bw.document.querySelector('#add-frame').click(); await tick(700);
blockedOut.stillWorks = bw.eval('S.frames.length') === 2;
console.log('blocked storage:', JSON.stringify(blockedOut));
if (bad.length || out.errors.length || blockedOut.errors.length || blockedOut.itemsWhenStorageBlocked !== 4 || !blockedOut.stillWorks) { console.error('SMOKE FAILED', bad.map(b => b[0])); process.exitCode = 1; }
})();

