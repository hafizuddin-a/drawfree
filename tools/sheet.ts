// Renders a contact sheet of the part library to PNG (and SVG) for visual checks.
// usage: tsx tools/sheet.ts <out.png>
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { BOTTOMS, FACE, FACIAL, GLASSES, HAIR, PROPS, SHOES, TOPS } from '../src/parts';
import { POSES, poseFrom } from '../src/rig/poses';
import { charSVG, newCharacter, propSVG } from '../src/rig/renderCharacter';
import type { Character, PartInfo } from '../src/types';

const out = process.argv[2] ?? 'art-sheet.png';
const W = 1500, cell = 250;
let body = '', n = 0;
const place = (svg: string, label: string) => {
  const x = (n % 6) * cell + 125, y = Math.floor(n / 6) * 330 + 270;
  body += `<g transform="translate(${x} ${y}) scale(0.5)">${svg}</g><text x="${x}" y="${y + 120}" font-size="14" text-anchor="middle" font-family="sans-serif">${label}</text>`;
  n++;
};
for (const p of POSES) place(charSVG(newCharacter({ pose: poseFrom(p.t) })), p.id);
for (const h of HAIR) place(charSVG(newCharacter({ hair: h.id, hairC: '#c97b4a', skin: '#e9b996' })), 'hair ' + h.id);
for (const t of TOPS) place(charSVG(newCharacter({ top: t.id, topC: '#ffe08a' })), 'top ' + t.id);
for (const t of BOTTOMS) place(charSVG(newCharacter({ bottom: t.id, botC: '#141414' })), 'bottom ' + t.id);
for (const t of SHOES) place(charSVG(newCharacter({ shoes: t.id, shoeC: '#4aa8ff', bottom: 'jeans' })), 'shoes ' + t.id);
for (const t of FACE) place(charSVG(newCharacter({ face: t.id })), 'face ' + t.id);
const extras: Array<[keyof Character, readonly PartInfo[]]> = [['glasses', GLASSES], ['facial', FACIAL]];
for (const [k, list] of extras) for (const t of list) place(charSVG(newCharacter({ [k]: t.id, top: 'tee' })), k + ' ' + t.id);
for (const p of PROPS) place(propSVG({ prop: p.id, text: p.text }), 'prop ' + p.id);
place('<g transform="scale(-1 1)">' + charSVG(newCharacter({ flip: false })) + '</g>', 'flipped');

const H = Math.ceil(n / 6) * 330 + 20;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#e7f3fd"/>${body}</svg>`;
fs.writeFileSync(out.replace('.png', '.svg'), svg);
fs.writeFileSync(out, new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('cells', n, 'size', W, H);
