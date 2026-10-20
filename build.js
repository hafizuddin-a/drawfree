// Bundles src/ into two single-file pages:
//   dist/artifact.html  fragment for Claude's Artifact viewer (it adds its own <html>/<head>)
//   dist/index.html     standalone document for hosting (Cloudflare Workers assets / Pages)
// Also copies public/* (e.g. _headers) into dist/.
const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = ['parts-a.js', 'parts-b.js', 'scenes.js', 'project.js', 'app-a.js', 'io.js', 'app-b.js'].map(rd).join('\n');
const fragment = rd('index.html').replace('@@CSS@@', () => rd('style.css')).replace('@@JS@@', () => js);

const cut = fragment.indexOf('<div class="app">');
const head = fragment.slice(0, cut), body = fragment.slice(cut);
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b9cf2">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
${head}</head>
<body>
${body}</body>
</html>
`;
const dist = path.join(__dirname, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'artifact.html'), fragment);
fs.writeFileSync(path.join(dist, 'index.html'), standalone);
const pub = path.join(__dirname, 'public');
if (fs.existsSync(pub)) fs.readdirSync(pub).forEach(f => fs.copyFileSync(path.join(pub, f), path.join(dist, f)));
console.log('built dist/index.html', (standalone.length / 1024).toFixed(1) + ' KB');
