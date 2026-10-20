/* Drawfree part library, B: tops, bottoms, shoes, poses, props and the character renderer */

const torsoPath = h => `M-33,-167 C-20,-171 20,-171 33,-167 C43,-164 43,-150 41,-138 L32,-60 L33,${h} L-33,${h} L-32,-60 L-41,-138 C-43,-150 -43,-164 -33,-167 Z`;
const TOPS = [
  { id: 'tee', name: 'T-shirt', tags: 'tee shirt short sleeve casual', sleeve: 32, sw: 20,
    draw: c => shp(torsoPath(-14), c) + ln('M-13,-168 Q0,-153 13,-168') + ln('M-27,-62 Q-19,-50 -23,-34', 1.8) + ln('M27,-58 Q19,-46 25,-32', 1.8) },
  { id: 'hoodie', name: 'Hoodie', tags: 'hoodie sweatshirt hood long sleeve', sleeve: 112, sw: 23,
    draw: c => shp(torsoPath(-4), c) + shp('M-26,-171 Q0,-134 26,-171 Q0,-179 -26,-171Z', c) +
               ln('M-20,-52 L20,-52 L25,-26 L-25,-26 Z') + ln('M-6,-146 L-7,-122', 2.4) + ln('M6,-146 L7,-122', 2.4) },
  { id: 'blazer', name: 'Blazer', tags: 'blazer jacket formal office suit', sleeve: 110, sw: 20,
    draw: c => shp(torsoPath(-2), c) + shp('M-11,-168 L0,-92 L11,-168 Z', '#ffffff') +
               shp('M-11,-168 L-27,-128 L-9,-104 L0,-92 L-5,-132 Z', c) + shp('M11,-168 L27,-128 L9,-104 L0,-92 L5,-132 Z', c) +
               circ(0, -70, 2.6, INK, 1) + ln('M-24,-30 H-12', 2.4) + ln('M12,-30 H24', 2.4) },
  { id: 'tank', name: 'Tank top', tags: 'tank top sleeveless summer vest', sleeve: 0, sw: 0,
    draw: (c, skin) => shp(torsoPath(-4), skin) + shp('M-24,-168 L-14,-168 Q0,-150 14,-168 L24,-168 L27,-140 L29,-60 L30,-10 L-30,-10 L-29,-60 L-27,-140 Z', c) },
  { id: 'sweater', name: 'Turtleneck', tags: 'sweater turtleneck knit jumper long sleeve', sleeve: 112, sw: 20,
    draw: c => shp(torsoPath(-8), c) + shp('M-14,-176 Q-14,-182 -7,-182 H7 Q14,-182 14,-176 V-166 Q14,-162 7,-162 H-7 Q-14,-162 -14,-166 Z', c) +
               ln('M-29.5,-20 L29.5,-20', 2.4) + ln('M-6,-181 V-163', 1.8) + ln('M6,-181 V-163', 1.8) },
  { id: 'jacket', name: 'Bomber jacket', tags: 'jacket bomber zip coat long sleeve', sleeve: 112, sw: 22,
    draw: c => shp(torsoPath(-2), c) + shp('M-12,-168 L-22,-158 L-8,-150 Z', c) + shp('M12,-168 L22,-158 L8,-150 Z', c) +
               ln('M0,-150 L0,-2') + ln('M-22,-46 H-10', 2.4) + ln('M10,-46 H22', 2.4) + ln('M-29.5,-14 H29.5', 2.4) }
];

const block = c => shp('M-35,-28 L35,-28 L36,10 Q0,18 -36,10 Z', c);
const BOTTOMS = [
  { id: 'jeans', name: 'Jeans', tags: 'jeans trousers pants long denim', leg: 172, lw: 27, stitch: 1,
    pelvis: c => block(c) + ln('M0,-28 L0,0', 2.2) + ln('M-30,-26 Q-26,-15 -12,-13', 2) + ln('M30,-26 Q26,-15 12,-13', 2) },
  { id: 'shorts', name: 'Shorts', tags: 'shorts short summer', leg: 64, lw: 29,
    pelvis: c => block(c) },
  { id: 'skirt', name: 'Skirt', tags: 'skirt mini pleated', leg: 0, lw: 0,
    pelvis: c => shp('M-35,-28 L35,-28 L50,62 Q0,73 -50,62 Z', c) + ln('M-10,-24 L-14,64', 2.2) + ln('M10,-24 L14,64', 2.2) },
  { id: 'wide', name: 'Wide trousers', tags: 'wide trousers pants loose baggy', leg: 172, lw: 35,
    pelvis: c => block(c) + ln('M0,-28 L0,0', 2.2) + ln('M-30,-26 Q-26,-15 -12,-13', 2) + ln('M30,-26 Q26,-15 12,-13', 2) }
];

const SOLE = '<path d="M-12,9 H28 V15 H-12 Z" fill="#fff" stroke="#141414" stroke-width="2.6" stroke-linejoin="round"/>';
const SHOES = [
  { id: 'sneaker', name: 'Sneakers', tags: 'sneakers trainers shoes casual', boot: 0,
    draw: c => shp('M-11,-9 L9,-9 C14,-9 18,-4 26,1 C31,4 31,12 27,14 L-12,14 Z', c) + SOLE + ln('M2,-4 L8,-2', 2) + ln('M6,-1 L12,1', 2) },
  { id: 'boot', name: 'Boots', tags: 'boots tall shoes', boot: 46,
    draw: c => shp('M-12,-12 H11 V-2 C20,0 29,5 29,12 V15 H-12 Z', c) + SOLE },
  { id: 'sandal', name: 'Sandals', tags: 'sandals summer open', boot: 0,
    draw: (c, skin) => shp('M-9,-8 L9,-8 C14,-6 20,0 26,8 L26,12 L-9,12 Z', skin) + ln('M-9,-2 L10,2', 2) + ln('M-9,4 L12,7', 2) + shp('M-10,10 H27 V15 H-10 Z', c, 2.6) },
  { id: 'bare', name: 'Barefoot', tags: 'bare barefoot none', boot: 0,
    draw: (c, skin) => shp('M-9,-8 L9,-8 C14,-6 20,0 26,8 L26,13 L-9,13 Z', skin) }
];

/* ---------- poses: hand and foot targets solved with IK ---------- */
const T_IDLE = { aL: [[-34, -30], 1], aR: [[34, -30], 1], lL: [[-20, 174], -1], lR: [[20, 174], -1] };
const withT = o => Object.assign({}, T_IDLE, o);
const POSES = [
  { id: 'idle', name: 'Standing', tags: 'stand idle neutral', t: T_IDLE },
  { id: 'wave', name: 'Waving', tags: 'wave hello greeting', t: withT({ aR: [[62, -262], 1] }) },
  { id: 'cheer', name: 'Cheering', tags: 'cheer arms up celebrate', t: withT({ aL: [[-62, -262], -1], aR: [[62, -262], 1] }) },
  { id: 'hips', name: 'Hands on hips', tags: 'hips confident akimbo', t: withT({ aL: [[-26, -56], 1], aR: [[26, -56], -1] }) },
  { id: 'crossed', name: 'Arms crossed', tags: 'crossed arms folded', t: withT({ aL: [[22, -112], 1], aR: [[-24, -104], -1] }) },
  { id: 'walk', name: 'Walking', tags: 'walk step stride', t: { aL: [[30, -68], 1], aR: [[8, -72], 1], lL: [[-50, 168], -1], lR: [[46, 170], -1] } },
  { id: 'point', name: 'Pointing', tags: 'point direct show', t: withT({ aR: [[140, -156], 1] }) },
  { id: 'sit', name: 'Sitting', tags: 'sit seated chair', t: { aL: [[22, -44], 1], aR: [[50, -40], 1], lL: [[60, 84], -1], lR: [[76, 86], -1] } }
];
function poseFrom(t) {
  return {
    aL: ik(G.sh.L, G.A1, G.A2, t.aL[0], t.aL[1]), aR: ik(G.sh.R, G.A1, G.A2, t.aR[0], t.aR[1]),
    lL: ik(G.hip.L, G.L1, G.L2, t.lL[0], t.lL[1]), lR: ik(G.hip.R, G.L1, G.L2, t.lR[0], t.lR[1])
  };
}
const LIMBS = { aL: [G.sh.L, G.A1, G.A2], aR: [G.sh.R, G.A1, G.A2], lL: [G.hip.L, G.L1, G.L2], lR: [G.hip.R, G.L1, G.L2] };
function rig(c) {
  const o = {};
  for (const k in LIMBS) o[k] = fk(LIMBS[k][0], LIMBS[k][1], LIMBS[k][2], c.pose[k][0], c.pose[k][1]);
  return o;
}
const byId = list => Object.fromEntries(list.map(i => [i.id, i]));
const BY = { hair: byId(HAIR), face: byId(FACE), glasses: byId(GLASSES), facial: byId(FACIAL), hat: byId(HATS), neck: byId(NECK),
             top: byId(TOPS), bottom: byId(BOTTOMS), shoes: byId(SHOES) };

function newChar(o = {}) {
  return Object.assign({
    type: 'char', x: 480, y: 300, s: 0.8, flip: false,
    skin: '#ffffff', hair: 'crop', hairC: '#141414', face: 'smile',
    top: 'tee', topC: '#ffffff', bottom: 'jeans', botC: '#cfe8ff', shoes: 'sneaker', shoeC: '#ffffff',
    glasses: 'none', facial: 'none', hat: 'none', hatC: '#ffe08a', neck: 'none', neckC: '#ff9a4d',
    pose: poseFrom(T_IDLE)
  }, o);
}

/* ---------- character renderer (local space, faces +x) ---------- */
function charSVG(c) {
  const hair = BY.hair[c.hair] || HAIR[0], face = BY.face[c.face] || FACE[0], gl = BY.glasses[c.glasses] || GLASSES[0];
  const fa = BY.facial[c.facial] || FACIAL[0], hat = BY.hat[c.hat] || HATS[0], nk = BY.neck[c.neck] || NECK[0];
  const top = BY.top[c.top] || TOPS[0], bot = BY.bottom[c.bottom] || BOTTOMS[0], shoe = BY.shoes[c.shoes] || SHOES[0];
  const r = rig(c);
  const arm = k => {
    const pts = r[k];
    let s = tube(pts, 18, c.skin);
    if (top.sleeve > 0) s += tube(slice(pts, 0, top.sleeve), top.sw + 3, c.topC);
    return s + hand(pts, c.skin);
  };
  const leg = k => {
    const pts = r[k];
    let s = tube(pts, 26, c.skin);
    if (bot.leg > 0) s += tube(slice(pts, 0, bot.leg), bot.lw + 3, c.botC);
    if (bot.leg > 100 && bot.stitch) s += `<polyline points="${pl(slice(pts, 8, bot.leg - 6))}" fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="3 4" stroke-linecap="round"/>`;
    if (shoe.boot > 0) s += tube(slice(pts, 176 - shoe.boot, 176), Math.max(bot.lw + 3, 29) + 2, c.shoeC);
    const a = pts[2], rot = Math.max(-45, Math.min(45, -(c.pose[k][0] + c.pose[k][1]) * 0.5));
    return s + `<g transform="translate(${f1(a[0])} ${f1(a[1])}) rotate(${f1(rot)})">${shoe.draw(c.shoeC, c.skin)}</g>`;
  };
  const head =
    shp(HEAD_D, c.skin) + EAR + fa.pre(c.hairC) + face.draw() + gl.draw() + fa.post(c.hairC) +
    (c.hat === 'none' ? hair.front(c.hairC) : '') + hat.draw(c.hatC);
  return hair.back(c.hairC) + leg('lL') + leg('lR') +
    shp('M-9,-182 V-160 H9 V-182 Z', c.skin) + bot.pelvis(c.botC) + top.draw(c.topC, c.skin) + nk.draw(c.neckC) +
    arm('aL') + head + arm('aR');
}

/* ---------- props ---------- */
const wrapText = (t, n) => {
  const out = []; let cur = '';
  String(t || '').split(/\s+/).forEach(w => {
    if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  });
  if (cur) out.push(cur);
  return out.slice(0, 5);
};
const esc = s => String(s).replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const PROPS = [
  { id: 'bubble', name: 'Speech bubble', tags: 'speech bubble dialogue talk text caption', noFlip: true, text: 'Morning! Ready to shoot?',
    draw: p => {
      const lines = wrapText(p.text, 17), h = Math.max(64, 28 + lines.length * 24);
      const y0 = -h + (h - lines.length * 24) / 2 + 18;
      return shp(`M-100,${-h} H100 Q112,${-h} 112,${-h + 12} V-12 Q112,0 100,0 H-8 L-36,26 L-32,0 H-100 Q-112,0 -112,-12 V${-h + 12} Q-112,${-h} -100,${-h}Z`, '#fff') +
        lines.map((l, i) => `<text x="0" y="${y0 + i * 24}" text-anchor="middle" font-family="Figtree,system-ui,sans-serif" font-size="18" font-weight="600" fill="${INK}">${esc(l)}</text>`).join('');
    } },
  { id: 'plant', name: 'Potted plant', tags: 'plant pot leaves green decor',
    draw: () => shp('M0,-48 C-10,-92 -40,-102 -54,-132 C-20,-132 0,-102 0,-48Z', '#bfe3c0') +
                shp('M0,-48 C10,-100 30,-122 50,-152 C62,-112 30,-80 0,-48Z', '#bfe3c0') +
                shp('M0,-48 C-4,-110 4,-150 0,-178 C18,-150 14,-100 0,-48Z', '#bfe3c0') +
                shp('M-28,-50 H28 L21,0 H-21 Z', '#ffc7c2') + ln('M-30,-50 H30', 4) },
  { id: 'chair', name: 'Chair', tags: 'chair seat furniture',
    draw: () => shp('M-32,-52 H-24 V0 H-32Z', '#fff') + shp('M26,-52 H34 V0 H26Z', '#fff') +
                shp('M-38,-136 H-28 V-62 H-38Z', '#fff') + shp('M-38,-66 H40 V-52 H-38 Z', '#ffe08a') },
  { id: 'table', name: 'Table', tags: 'table desk furniture coffee',
    draw: () => shp('M-62,-72 H-54 V0 H-62Z', '#fff') + shp('M54,-72 H62 V0 H54Z', '#fff') + shp('M-74,-84 H74 V-70 H-74 Z', '#cfe8ff') +
                shp('M-8,-116 H12 V-84 H-8Z', '#fff') + ln('M12,-108 Q22,-108 22,-98 Q22,-92 12,-92', 2.6) }
];
BY.prop = byId(PROPS);
function propSVG(p) { return (BY.prop[p.kind] || PROPS[0]).draw(p); }
