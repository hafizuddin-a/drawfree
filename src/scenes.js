/* Drawfree scenes: faint line-art backdrops drawn in the 960x540 frame space. Ground line sits at y=458. */
const BGC = ['#e7f3fd', '#ffffff', '#fff2d3', '#ffe6e2', '#e3f3e5', '#ece6ff', '#ffe9cf', '#dfe5ea', '#cfe3f5', '#f6f1e7'];
const lum = hex => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
};
const rep = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');

const SCENES = [
  { id: 'none', name: 'Plain', tags: 'plain blank none empty', draw: () => '' },
  { id: 'room', name: 'Living room', tags: 'room indoor home window sofa interior',
    draw: () => '<path d="M0 458H960M0 436H960"/>' +
      '<rect x="90" y="80" width="190" height="230" rx="6"/><path d="M185 80V310M90 195H280"/>' +
      '<path d="M66 66Q96 190 66 330M304 66Q274 190 304 330"/>' +
      '<rect x="420" y="90" width="120" height="86" rx="4"/><rect x="570" y="110" width="76" height="110" rx="4"/>' +
      '<path d="M690 236H900M712 236V200h40v36M772 236V180h30v56M830 236v-34h50v34"/>' +
      '<ellipse cx="480" cy="502" rx="270" ry="22"/><path d="M880 458V330M860 330h40l-8-44h-24z"/>' },
  { id: 'cafe', name: 'Café front', tags: 'cafe shop street store building awning outdoor',
    draw: () => '<path d="M0 458H960M0 476H960"/><path d="M110 118H850L872 188H88Z"/>' +
      rep(9, i => `<path d="M${110 + i * 92 - (i * 2.5)} 118L${88 + i * 98} 188"/>`) +
      '<rect x="150" y="224" width="250" height="186" rx="4"/><rect x="570" y="224" width="250" height="186" rx="4"/>' +
      '<rect x="432" y="212" width="106" height="246" rx="4"/><circle cx="520" cy="338" r="4"/>' +
      '<path d="M150 410H400M570 410H820"/><path d="M60 118V40h120v50"/><path d="M780 70h90v28h-90z"/>' },
  { id: 'park', name: 'Park', tags: 'park outdoor trees bench nature sun garden',
    draw: () => '<path d="M0 458H960"/><circle cx="840" cy="92" r="40"/>' +
      '<path d="M120 150q30-26 70-8q34-18 64 8M520 110q26-20 56-6q28-14 52 6"/>' +
      '<path d="M0 392Q200 336 400 388T800 372T960 396"/>' +
      '<path d="M120 458V320"/><circle cx="120" cy="272" r="74"/><path d="M830 458V330"/><circle cx="830" cy="286" r="66"/>' +
      '<path d="M350 458v-52M530 458v-52M330 406h226M338 372h210"/>' +
      rep(12, i => `<path d="M${40 + i * 80} 474l6-10M${52 + i * 80} 474l-4-12"/>`) },
  { id: 'city', name: 'City skyline', tags: 'city skyline buildings urban downtown street',
    draw: () => '<path d="M0 458H960"/>' + [[50, 210, 110], [180, 150, 92], [292, 290, 130], [452, 190, 100], [572, 310, 124], [724, 220, 110], [850, 160, 92]]
      .map(([x, h, w]) => `<rect x="${x}" y="${458 - h}" width="${w}" height="${h}"/>` +
        rep(Math.floor((h - 24) / 30), j => rep(Math.floor((w - 20) / 28), k => `<rect x="${x + 14 + k * 28}" y="${458 - h + 16 + j * 30}" width="12" height="16" rx="2"/>`))).join('') },
  { id: 'beach', name: 'Beach', tags: 'beach sea ocean sun palm summer waves',
    draw: () => '<path d="M0 300H960M0 458H960"/><path d="M660 300a60 60 0 0 1 120 0"/>' +
      rep(4, r => `<path d="M0 ${336 + r * 30} q30 -14 60 0${' t60 0'.repeat(15)}"/>`) +
      '<path d="M840 458Q850 370 816 290M816 290q-44-8-70 22M816 290q10-40 54-44M816 290q42-16 74 14M816 290q-20-34-60-30"/>' },
  { id: 'studio', name: 'Studio', tags: 'studio backdrop light stand photo set',
    draw: () => '<path d="M0 420Q480 372 960 420M0 458H960"/>' +
      '<path d="M110 458V250M70 458h80M82 250h56l-10-44h-36z"/><path d="M850 458V250M810 458h80M822 250h56l-10-44h-36z"/><ellipse cx="480" cy="470" rx="230" ry="10"/>' },
  { id: 'grid', name: 'Grid paper', tags: 'grid paper graph squares blueprint',
    draw: () => rep(23, i => `<path d="M${(i + 1) * 40} 0V540"/>`) + rep(13, i => `<path d="M0 ${(i + 1) * 40}H960"/>`) },
  { id: 'dots', name: 'Dot grid', tags: 'dots dot grid bullet journal',
    draw: () => `<path stroke-width="5" d="${rep(12, r => rep(23, c => `M${(c + 1) * 40} ${(r + 1) * 40}h.01`))}"/>` }
];
const sceneById = Object.fromEntries(SCENES.map(s => [s.id, s]));
function sceneSVG(f) {
  const s = sceneById[f.scene || 'none'];
  if (!s || s.id === 'none') return '';
  const lc = lum(f.bg) > 0.45 ? '#16384f' : '#ffffff';
  return `<g fill="none" stroke="${lc}" stroke-opacity=".4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${s.draw()}</g>`;
}
const frameBG = (f, round) => `<rect width="960" height="540"${round ? ' rx="14"' : ''} fill="${f.bg}"/>` + sceneSVG(f);
