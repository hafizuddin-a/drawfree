/* SVG drawing primitives shared by every part. Pure string builders: no DOM, no React. */
import type { Vec } from '../types';

export const INK = '#141414';
/** outline weight: matched to the Open Peeps ink at the rig's scale (their strokes are about 2 units wide) */
export const W = 2.3;
export const f1 = (n: number): number => Math.round(n * 10) / 10;
export const pl = (pts: readonly Vec[]): string => pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
export const ln = (d: string, w = W): string =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const shp = (d: string, fill: string, w = W): string =>
  `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
export const circ = (x: number, y: number, r: number, fill: string, w = W): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${w}"/>`;
export const dot = (x: number, y: number, rx: number, ry: number): string =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}"/>`;
export const blob = (cs: ReadonlyArray<readonly [number, number, number]>, fill: string): string =>
  cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + W}" fill="${INK}"/>`).join('') +
  cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');

/** characters XML 1.0 forbids: control codes and lone surrogates */
// biome-ignore lint/complexity/useRegexLiterals: TypeScript 7 rejects this class as a regex literal
export const XML_ILLEGAL = new RegExp('[^\\t\\n\\r\\u0020-\\uD7FF\\uE000-\\uFFFD\\u{10000}-\\u{10FFFF}]', 'gu');

/** Escapes text for SVG and drops characters XML 1.0 forbids, so exported files always parse. */
export const esc = (s: string): string =>
  String(s)
    .replace(XML_ILLEGAL, '')
    .replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m] ?? m);

/** 'a b c' -> ['a', 'b', 'c']. Keeps the tag lists in the part files readable. */
export const tags = (s: string): string[] => s.split(' ');
