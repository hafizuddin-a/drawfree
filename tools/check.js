// Pre-deploy check on the built site and the source rules from the spec. usage: node tools/check.js (after `vite build`)
//  - dist is complete and every asset index.html points at exists
//  - JS + CSS is under the size budget (gzipped, fonts excluded)
//  - no `any` in TypeScript
//  - src/parts, src/rig, src/scenes import no React and touch no DOM, so they stay testable in Node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const BUDGET_KB = 250;

/* ---- dist ---- */
const dist = path.join(root, 'dist');
const htmlPath = path.join(dist, 'index.html');
if (!fs.existsSync(htmlPath)) problems.push('missing dist/index.html (run the build first)');
if (!fs.existsSync(path.join(dist, '_headers'))) problems.push('missing dist/_headers');
let gz = 0;
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!/^<!doctype html>/i.test(html)) problems.push('index.html: missing doctype');
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
  if (!refs.some(r => r.endsWith('.js'))) problems.push('index.html does not load a script');
  for (const r of refs) {
    const f = path.join(dist, r);
    if (!fs.existsSync(f)) { problems.push('missing ' + r); continue; }
    gz += zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length;
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>[^<]/i.test(html)) problems.push('index.html has an inline script, but the CSP only allows external ones');
}
if (gz / 1024 > BUDGET_KB) problems.push(`JS+CSS is ${(gz / 1024).toFixed(0)} KB gzipped, over the ${BUDGET_KB} KB budget`);

/* ---- source rules ---- */
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = f => path.relative(root, f);
// drop comments and string contents so words like "any" in prose or text do not count
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
const ts = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'tools'))].filter(f => /\.tsx?$/.test(f));
const ANY = /(:\s*any\b|\bas\s+any\b|<any\b|\bany\s*\[\]|,\s*any\s*>|\bArray<any>)/;
for (const f of ts) if (ANY.test(code(fs.readFileSync(f, 'utf8')))) problems.push(`${rel(f)}: uses \`any\``);

const PURE = ['src/parts', 'src/rig', 'src/scenes'].map(d => path.join(root, d));
const DOM = /(\bfrom\s+['"]react|\bdocument\b|\bwindow\b|\bnavigator\b|\blocalStorage\b|\bnew\s+Image\b|\bDOMParser\b|\bHTML\w*Element\b|\bSVG\w*Element\b)/;
for (const f of ts.filter(f => PURE.some(d => f.startsWith(d)) && !/\.test\.tsx?$/.test(f))) {
  const m = code(fs.readFileSync(f, 'utf8')).match(DOM);
  if (m) problems.push(`${rel(f)}: must not use React or the DOM (found "${m[0]}")`);
}

if (problems.length) { console.error('CHECK FAILED\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`check ok (JS+CSS ${(gz / 1024).toFixed(1)} KB gzipped of ${BUDGET_KB}; ${ts.length} TypeScript files)`);
