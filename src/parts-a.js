/* Drawfree part library, A: helpers, rig math, head parts (hair, faces, extras)
   Coordinate space: pelvis at (0,0), figure faces +x, head centre (0,-212). */
const INK = '#141414';
const f1 = n => Math.round(n * 10) / 10;
const pl = pts => pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
const ln = (d, w = 3) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shp = (d, fill, w = 3) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const circ = (x, y, r, fill, w = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${w}"/>`;
const dot = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}"/>`;
const blob = (cs, fill) =>
  cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="${INK}"/>`).join('') +
  cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');

/* ---------- rig ---------- */
const G = {
  sh: { L: [-33, -150], R: [33, -150] },
  hip: { L: [-19, -4], R: [19, -4] },
  A1: 64, A2: 58, L1: 92, L2: 88
};
const RAD = Math.PI / 180;
function fk(o, l1, l2, a1, a2) {
  const e = [o[0] + l1 * Math.sin(a1 * RAD), o[1] + l1 * Math.cos(a1 * RAD)];
  const b = (a1 + a2) * RAD;
  return [o, e, [e[0] + l2 * Math.sin(b), e[1] + l2 * Math.cos(b)]];
}
/* two-bone IK. s = +1 or -1 picks which way the joint bends. angles in degrees, 0 = straight down, + = toward +x */
function ik(o, l1, l2, t, s) {
  const dx = t[0] - o[0], dy = t[1] - o[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1), l1 + l2 - 0.5);
  const cl = v => Math.max(-1, Math.min(1, v));
  const phi = Math.atan2(dx, dy);
  const al = Math.acos(cl((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const be = Math.acos(cl((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)));
  return [(phi - s * al) / RAD, s * (Math.PI - be) / RAD, s];
}
function pointAt(pts, dist) {
  let left = dist;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= seg) { const t = seg ? left / seg : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    left -= seg;
  }
  return pts[pts.length - 1];
}
function slice(pts, d0, d1) {
  const out = [pointAt(pts, d0)];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc > d0 && acc < d1) out.push(pts[i]);
  }
  out.push(pointAt(pts, d1));
  return out;
}
function tube(pts, w, fill) {
  const p = pl(pts);
  return `<polyline points="${p}" fill="none" stroke="${INK}" stroke-width="${w + 6}" stroke-linecap="round" stroke-linejoin="round"/>` +
         `<polyline points="${p}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function hand(pts, skin) {
  const e = pts[1], w = pts[2], ang = Math.atan2(w[0] - e[0], w[1] - e[1]) / RAD;
  return `<g transform="translate(${f1(w[0])} ${f1(w[1])}) rotate(${f1(-ang)})">` +
    shp('M-8.5,-3 C-10,4 -9,13 -5,17 C-2,20 4,19 6,15 C8.5,10 8.5,3 8.5,-3 Z', skin, 2.8) +
    shp('M7,2 C12,3 14,9 10.5,12.5 C9,10 8,6 7,2 Z', skin, 2.4) + ln('M-2,10 L-2,16', 1.8) + ln('M2.5,9 L2.5,16', 1.8) + '</g>';
}

/* ---------- palettes ---------- */
const SKIN = ['#ffffff', '#f8dcc8', '#e9b996', '#c68a62', '#8d5a3b', '#5a3a28'];
const HAIRC = ['#141414', '#4a2f22', '#9c4a2a', '#e0b95a', '#bdbdbd', '#ffffff', '#4aa8ff'];
const CLOTH = ['#ffffff', '#141414', '#4aa8ff', '#cfe8ff', '#ffe08a', '#ffc7c2', '#bfe3c0', '#d8ccff', '#ff9a4d', '#4a4a48'];

/* ---------- head, shape and ear ---------- */
const HEAD_D = 'M0,-247 C17,-247 29,-234 29,-214 C29,-208 31,-205 33,-203 C31,-201 29,-200 29,-196 C28,-180 16,-174 0,-174 C-16,-174 -29,-186 -29,-208 C-29,-232 -17,-247 0,-247 Z';
const EAR = ln('M-27,-216 C-37,-217 -37,-199 -27,-200');

/* ---------- hair: back layer sits behind the head, front layer on top ---------- */
const HAIR = [
  { id: 'none', name: 'Bald', tags: 'bald none shaved', back: () => '', front: () => '' },
  { id: 'crop', name: 'Crop cut', tags: 'short crop neat',
    back: () => '',
    front: c => shp('M-29,-216 C-37,-246 -14,-263 8,-260 C30,-258 40,-240 33,-221 C31,-229 27,-233 22,-234 C15,-229 6,-234 -2,-232 C-12,-231 -21,-226 -25,-214 Z', c) + ln('M-14,-250 Q-4,-256 8,-254', 2) + ln('M10,-252 Q22,-250 28,-241', 2) },
  { id: 'quiff', name: 'Quiff', tags: 'short volume swept',
    back: () => '',
    front: c => shp('M-29,-220 C-40,-250 -6,-270 22,-264 C42,-258 44,-240 34,-224 C30,-236 22,-241 8,-241 C-8,-241 -22,-236 -25,-220 Z', c) + ln('M-8,-250 Q8,-258 24,-252', 2.4) },
  { id: 'bun', name: 'Top bun', tags: 'bun updo tied',
    back: c => circ(-14, -264, 13, c),
    front: c => shp('M-28,-216 C-32,-244 -8,-254 10,-252 C28,-250 34,-236 31,-222 C24,-230 16,-232 4,-232 C-10,-232 -22,-228 -26,-212 Z', c) },
  { id: 'curly', name: 'Curls', tags: 'curly afro volume big',
    back: c => blob([[-26, -236, 17], [-8, -252, 17], [12, -254, 17], [30, -240, 14], [-35, -216, 13], [-31, -196, 10], [34, -222, 10]], c),
    front: c => blob([[-12, -238, 9], [4, -243, 9], [20, -240, 8]], c) },
  { id: 'long', name: 'Long', tags: 'long straight shoulder',
    back: c => shp('M-33,-226 C-48,-196 -44,-158 -34,-130 L-4,-134 L-6,-200 Z', c) + ln('M-38,-196 Q-40,-160 -32,-138', 2) + ln('M-30,-210 Q-34,-170 -26,-142', 2),
    front: c => shp('M-30,-218 C-36,-248 -6,-258 10,-254 C28,-250 36,-236 32,-218 C24,-238 8,-236 -2,-228 C-12,-222 -22,-224 -30,-218 Z', c) + ln('M-12,-246 Q4,-252 20,-247', 2) },
  { id: 'pony', name: 'Ponytail', tags: 'ponytail tied back',
    back: c => shp('M-30,-232 C-54,-238 -66,-208 -54,-172 C-50,-188 -42,-196 -32,-200 Z', c) + circ(-31, -226, 4.5, INK, 1),
    front: c => shp('M-28,-218 C-34,-246 -10,-258 8,-255 C26,-253 35,-238 31,-222 C26,-232 18,-236 6,-237 C-8,-237 -20,-232 -24,-218 Z', c) }
];

/* ---------- faces ---------- */
const eyes = () => dot(5, -214, 2.6, 3.6) + dot(22, -214, 2.6, 3.6);
const brows = (dy = 0) => ln(`M0,${-224 + dy} Q5,${-227 + dy} 10,${-225 + dy}`, 2.6) + ln(`M17,${-225 + dy} Q22,${-228 + dy} 27,${-225 + dy}`, 2.6);
const FACE = [
  { id: 'smile', name: 'Smile', tags: 'happy smile', draw: () => eyes() + brows() + ln('M10,-192 Q18,-185 26,-192') },
  { id: 'neutral', name: 'Neutral', tags: 'calm flat straight', draw: () => eyes() + brows() + ln('M12,-190 L25,-190') },
  { id: 'grin', name: 'Big grin', tags: 'laugh grin teeth happy',
    draw: () => eyes() + brows(-1) + shp('M9,-196 Q18,-181 28,-196 Z', '#fff', 2.6) + ln('M10,-192.5 L27,-192.5', 1.8) },
  { id: 'wink', name: 'Wink', tags: 'wink playful', draw: () => dot(5, -214, 2.6, 3.6) + ln('M17,-214 Q22,-219 27,-214') + brows() + ln('M10,-192 Q20,-184 27,-193') },
  { id: 'surprised', name: 'Surprised', tags: 'shock wow surprised',
    draw: () => circ(5, -214, 4.6, '#fff', 2.4) + dot(6, -214, 1.6, 1.6) + circ(22, -214, 4.6, '#fff', 2.4) + dot(23, -214, 1.6, 1.6) + brows(-4) + dot(19, -189, 4, 5) },
  { id: 'sleepy', name: 'Sleepy', tags: 'tired sleepy calm closed', draw: () => ln('M0,-214 Q5,-210 10,-214') + ln('M17,-214 Q22,-210 27,-214') + brows(1) + ln('M13,-191 Q19,-187 25,-191') }
];

/* ---------- extras ---------- */
const GLASSES = [
  { id: 'none', name: 'No glasses', tags: 'none', draw: () => '' },
  { id: 'round', name: 'Round glasses', tags: 'glasses round specs',
    draw: () => circ(5, -214, 9, 'rgba(255,255,255,.35)', 2.6) + circ(23, -214, 9, 'rgba(255,255,255,.35)', 2.6) + ln('M-4,-214 L-28,-212', 2.6) },
  { id: 'square', name: 'Square glasses', tags: 'glasses square frames',
    draw: () => shp('M-3,-221 H12 V-208 H-3 Z', 'rgba(255,255,255,.35)', 2.6) + shp('M16,-221 H31 V-208 H16 Z', 'rgba(255,255,255,.35)', 2.6) + ln('M12,-217 L16,-217', 2.6) + ln('M-3,-217 L-28,-213', 2.6) },
  { id: 'shades', name: 'Sunglasses', tags: 'sunglasses shades dark',
    draw: () => shp('M-4,-222 H12 V-210 Q8,-205 2,-207 Q-4,-208 -4,-222Z', INK, 2.6) + shp('M15,-222 H32 V-210 Q28,-205 21,-207 Q15,-208 15,-222Z', INK, 2.6) + ln('M-4,-218 L-28,-213', 2.6) }
];
const FACIAL = [
  { id: 'none', name: 'Clean shaven', tags: 'none', pre: () => '', post: () => '' },
  { id: 'stache', name: 'Moustache', tags: 'moustache mustache', pre: () => '', post: c => shp('M7,-197 C11,-204 24,-204 30,-198 C24,-193 14,-193 7,-197Z', c, 2.4) },
  { id: 'beard', name: 'Full beard', tags: 'beard bearded',
    pre: c => shp('M-28,-206 C-28,-180 -12,-166 4,-166 C20,-166 29,-180 29,-196 C23,-188 15,-185 9,-184 C1,-186 -14,-188 -28,-206 Z', c), post: () => '' },
  { id: 'goatee', name: 'Goatee', tags: 'goatee chin',
    pre: c => shp('M6,-186 C10,-182 12,-176 16,-174 C24,-176 26,-184 28,-190 C22,-186 14,-187 6,-186Z', c, 2.4), post: () => '' }
];
const HATS = [
  { id: 'none', name: 'No hat', tags: 'none', draw: () => '' },
  { id: 'beanie', name: 'Beanie', tags: 'beanie knit winter hat',
    draw: c => shp('M-33,-228 C-33,-264 -10,-276 0,-276 C14,-276 33,-262 33,-228 Z', c) +
               shp('M-35,-239 H35 V-224 H-35 Z', c) + ln('M-18,-239 V-224', 2) + ln('M-4,-239 V-224', 2) + ln('M10,-239 V-224', 2) + ln('M24,-239 V-224', 2) + circ(0, -282, 8, c) },
  { id: 'cap', name: 'Baseball cap', tags: 'cap baseball hat',
    draw: c => shp('M-31,-232 C-31,-262 -4,-268 12,-266 C30,-262 33,-244 32,-232 Z', c) + shp('M14,-236 H50 C57,-236 57,-228 50,-228 H14 Z', c) },
  { id: 'bucket', name: 'Bucket hat', tags: 'bucket hat sun',
    draw: c => shp('M-32,-230 C-32,-262 -8,-268 0,-268 C12,-268 32,-262 32,-230 Z', c) + shp('M-48,-224 C-30,-236 30,-236 48,-224 C48,-217 -48,-217 -48,-224Z', c) }
];
const NECK = [
  { id: 'none', name: 'No neckwear', tags: 'none', draw: () => '' },
  { id: 'scarf', name: 'Scarf', tags: 'scarf winter',
    draw: c => shp('M-20,-174 Q0,-160 20,-174 L23,-160 Q0,-144 -23,-160 Z', c) + shp('M6,-154 L18,-106 L3,-102 L-4,-148 Z', c) + ln('M7,-134 L16,-131', 2) + ln('M5,-122 L14,-119', 2) },
  { id: 'tie', name: 'Tie', tags: 'tie necktie office formal',
    draw: c => shp('M-5,-168 L5,-168 L8,-158 L-8,-158 Z', c, 2.4) + shp('M-7,-158 L7,-158 L9,-112 L0,-100 L-9,-112 Z', c, 2.4) },
  { id: 'chain', name: 'Pendant', tags: 'necklace pendant chain jewelry',
    draw: c => ln('M-16,-168 Q0,-122 16,-168', 2.4) + circ(0, -131, 6, c, 2.4) }
];
