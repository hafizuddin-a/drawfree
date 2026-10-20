// Pre-deploy check on the built page: the inline script compiles, required files exist, headers are in dist.
// (Stand-in for `tsc` until the TypeScript port in milestone 3.) usage: node tools/check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const dist = path.join(__dirname, '../dist'), problems = [];
const must = f => { if (!fs.existsSync(path.join(dist, f))) problems.push('missing dist/' + f); };
['index.html', 'artifact.html', '_headers'].forEach(must);
for (const f of ['index.html', 'artifact.html']) {
  const m = fs.existsSync(path.join(dist, f)) && fs.readFileSync(path.join(dist, f), 'utf8').match(/<script>([\s\S]*)<\/script>/);
  if (!m) { problems.push(f + ': no inline script'); continue; }
  try { new vm.Script(m[1], { filename: f }); } catch (e) { problems.push(f + ': script does not compile: ' + e.message); }
}
const html = fs.existsSync(path.join(dist, 'index.html')) ? fs.readFileSync(path.join(dist, 'index.html'), 'utf8') : '';
if (!/^<!doctype html>/i.test(html)) problems.push('index.html: missing doctype');
if (/@@(CSS|JS)@@/.test(html)) problems.push('index.html: unreplaced build placeholder');
const kb = Buffer.byteLength(html) / 1024;
if (kb > 400) problems.push(`index.html is ${kb.toFixed(0)} KB, over the 400 KB guard`);
if (problems.length) { console.error('CHECK FAILED\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`check ok (index.html ${kb.toFixed(1)} KB)`);
