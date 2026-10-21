// The drawn figure's style sheet: every top, bottom and shoe kind in a pose, under Open Peeps heads, next to the
// current Open Peeps body for comparison. usage: npx tsx tools/style-sheet.ts docs/style/sample.png
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { FACE, HAIR } from '../src/parts';
import { peepSVG } from '../src/parts/peeps/art';
import { figureSVG, type Look, type Pose } from '../src/art/figure';
import { charSVG, newCharacter } from '../src/rig/renderCharacter';
import { loadBodyArt } from '../src/parts/bodies';
await loadBodyArt();
const head = (hair: string, face: string, skin: string, hairC: string) => {
  const c = { skin, hair: hairC, hat: '#ffe08a' };
  return `<g transform="translate(0 16)">${peepSVG((HAIR.find(h => h.id === hair) ?? HAIR[0]).art, c)}${peepSVG((FACE.find(f => f.id === face) ?? FACE[0]).art, c)}</g>`;
};
const rest: Pose = { aL: [-3, 6, 1], aR: [3, 4, 1], lL: [-7, 2, -1], lR: [5, -2, -1] };
const P: Record<string, Pose> = {
  rest, wave: { ...rest, aR: [150, -35, -1] }, cheer: { ...rest, aL: [-150, 35, 1], aR: [150, -35, -1] },
  hips: { ...rest, aL: [-40, 100, 1], aR: [40, -100, -1] }, crossed: { ...rest, aL: [20, 120, 1], aR: [-25, -110, 1] },
  walk: { ...rest, aL: [-25, -20, 1], aR: [30, 20, 1], lL: [25, -15, -1], lR: [-25, -30, -1] },
  point: { ...rest, aR: [95, -8, 1] },
  sit: { ...rest, aL: [20, 50, 1], aR: [15, 55, 1], lL: [88, -88, -1], lR: [84, -84, -1] },
};
type Cell = [label: string, look: Look, pose: Pose, hair: string, face: string, hairC: string];
const cells: Cell[] = [
  ['tee, trousers', { skin: '#e9b996', top: '#9fd0ff', bottom: '#ffe08a', shoe: '#ff9a4d', topKind: 'tee', bottomKind: 'trousers', shoeKind: 'sneaker' }, P.rest, 'short-1', 'smile', '#141414'],
  ['shirt, waving', { skin: '#c68a62', top: '#ffffff', bottom: '#141414', shoe: '#141414', topKind: 'shirt', bottomKind: 'trousers', shoeKind: 'boot' }, P.wave, 'bun-2', 'smile-big', '#141414'],
  ['hoodie, shorts', { skin: '#8d5a3b', top: '#ffb3c1', bottom: '#4aa8ff', shoe: '#ffe08a', topKind: 'hoodie', bottomKind: 'shorts', shoeKind: 'sneaker' }, P.hips, 'afro', 'cute', '#141414'],
  ['long sleeve, skirt', { skin: '#f1c9a5', top: '#c3e6c7', bottom: '#ff9a4d', shoe: '#141414', topKind: 'longsleeve', bottomKind: 'skirt', shoeKind: 'boot' }, P.crossed, 'long', 'blank', '#c97b4a'],
  ['tank, walking', { skin: '#e9b996', top: '#ffe08a', bottom: '#cfe8ff', shoe: '#ffffff', topKind: 'tank', bottomKind: 'trousers', shoeKind: 'sneaker' }, P.walk, 'short-3', 'smile', '#5a3a22'],
  ['shirt, pointing', { skin: '#c68a62', top: '#4aa8ff', bottom: '#ffffff', shoe: '#ff9a4d', topKind: 'shirt', bottomKind: 'trousers', shoeKind: 'sneaker' }, P.point, 'short-2', 'explaining', '#141414'],
  ['tee, sitting', { skin: '#8d5a3b', top: '#ff9a4d', bottom: '#141414', shoe: '#ffffff', topKind: 'tee', bottomKind: 'trousers', shoeKind: 'sneaker' }, P.sit, 'pomp', 'smile', '#141414'],
  ['hoodie, cheering', { skin: '#f1c9a5', top: '#cfe8ff', bottom: '#ffe08a', shoe: '#4aa8ff', topKind: 'hoodie', bottomKind: 'trousers', shoeKind: 'sneaker' }, P.cheer, 'bun-2', 'smile-big', '#e0b95a'],
];
let body = '';
cells.forEach(([label, L, p, hair, face, hc], i) => {
  const x = (i % 5) * 300 + 150, y = Math.floor(i / 5) * 520 + 300;
  body += `<g transform="translate(${x} ${y})">${figureSVG(p, L)}${head(hair, face, L.skin, hc)}</g><text x="${x}" y="${y + 228}" font-size="16" text-anchor="middle" font-family="sans-serif" fill="#444">${label}</text>`;
});
const i = cells.length, x = (i % 5) * 300 + 150, y = Math.floor(i / 5) * 520 + 300;
body += `<g transform="translate(${x} ${y})">${charSVG(newCharacter({ skin: '#e9b996', topC: '#9fd0ff', botC: '#ffe08a', shoeC: '#ff9a4d', body: 'stand-shirt-3' }))}</g><text x="${x}" y="${y + 228}" font-size="16" text-anchor="middle" font-family="sans-serif" fill="#444">current Open Peeps body</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1080"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
fs.writeFileSync(process.argv[2] ?? 'docs/style/sample.png', new Resvg(svg, { fitTo: { mode: 'zoom', value: 1.4 } }).render().asPng());
