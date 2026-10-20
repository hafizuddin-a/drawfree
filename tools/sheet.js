// Renders a contact sheet of the part library to PNG for visual checks.
// usage: node tools/sheet.js [dir-containing-node_modules or .] <out.png>
const fs = require('fs'), path = require('path');
const src = ['parts-a.js', 'parts-b.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
const lib = new Function(src + '; return {newChar,charSVG,propSVG,poseFrom,POSES,HAIR,FACE,TOPS,BOTTOMS,SHOES,PROPS,HATS,GLASSES,FACIAL,NECK};')();
const base = process.argv[2], req = m => (base ? require(path.resolve(base, 'node_modules', m)) : require(m));
const { Resvg } = req('@resvg/resvg-js');
const W = 1500, cell = 250;
let body = '', n = 0;
const place = (svg, label) => {
  const x = (n % 6) * cell + 125, y = Math.floor(n / 6) * 330 + 270;
  body += `<g transform="translate(${x} ${y}) scale(0.5)">${svg}</g><text x="${x}" y="${y + 120}" font-size="14" text-anchor="middle" font-family="sans-serif">${label}</text>`;
  n++;
};
lib.POSES.forEach(p => place(lib.charSVG(lib.newChar({ pose: lib.poseFrom(p.t) })), p.id));
lib.HAIR.forEach(h => place(lib.charSVG(lib.newChar({ hair: h.id, hairC: '#4a2f22' })), 'hair ' + h.id));
lib.TOPS.forEach(t => place(lib.charSVG(lib.newChar({ top: t.id, topC: '#ffe08a', neck: t.id === 'blazer' ? 'tie' : 'none' })), 'top ' + t.id));
lib.BOTTOMS.forEach(t => place(lib.charSVG(lib.newChar({ bottom: t.id, botC: '#141414' })), 'bottom ' + t.id));
lib.SHOES.forEach(t => place(lib.charSVG(lib.newChar({ shoes: t.id, shoeC: '#4aa8ff', bottom: 'jeans' })), 'shoes ' + t.id));
lib.FACE.forEach(t => place(lib.charSVG(lib.newChar({ face: t.id })), 'face ' + t.id));
[['glasses', lib.GLASSES], ['facial', lib.FACIAL], ['hat', lib.HATS], ['neck', lib.NECK]].forEach(([k, list]) =>
  list.forEach(t => place(lib.charSVG(lib.newChar({ [k]: t.id, hairC: '#141414', neckC: '#ff9a4d', top: 'tee' })), k + ' ' + t.id)));
lib.PROPS.forEach(p => place(lib.propSVG(Object.assign({ kind: p.id, text: p.text }, {})), 'prop ' + p.id));
place(lib.charSVG(lib.newChar({ flip: false })).replace(/^/, '<g transform="scale(-1 1)">') + '</g>', 'flipped');
const H = Math.ceil(n / 6) * 330 + 20;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#e7f3fd"/>${body}</svg>`;
fs.writeFileSync(process.argv[3].replace('.png', '.svg'), svg);
fs.writeFileSync(process.argv[3], new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('cells', n, 'size', W, H);
