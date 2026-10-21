/* Thumbnails are the real renderer with a cropped viewBox, returned as image data URLs. Cached by section, part, the character's look
   and whether the Open Peeps body art has loaded yet. */
import type { Character, PartInfo } from '../types';
import { DEFAULT_BODY, charSVG, newCharacter, propSVG } from '../rig/renderCharacter';
import { bodyArtVersion } from '../parts/bodies';
import { frameBG } from '../scenes/scenes';
import { svgImgSrc } from './markup';
import type { ListSection } from './sections';

const cache = new Map<string, string>();
const MAX_CACHE = 800;

/** the part of a character that affects thumbnails: everything except where it stands on the board */
export function lookKey(c: Character): string {
  const { id: _id, x: _x, y: _y, s: _s, r: _r, flip: _f, ...look } = c;
  return JSON.stringify(look);
}

export function thumbSrc(sec: ListSection, part: PartInfo, base: Character | null, baseKey: string, bg: string): string {
  const key = sec.kind === 'scene' ? `scene|${part.id}|${bg}` : sec.kind === 'props' ? `props|${part.id}` : `${sec.id}|${part.id}|${baseKey}|${bodyArtVersion()}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // head thumbnails are drawn on one body, which their view is framed for; a body thumbnail swaps the body in
  const ch = { ...(base ?? newCharacter()), body: DEFAULT_BODY };
  let inner: string;
  if (sec.kind === 'scene') inner = frameBG({ bg, scene: part.id });
  else if (sec.kind === 'props') inner = propSVG({ prop: part.id, text: (part as { text?: string }).text });
  else inner = charSVG({ ...ch, [sec.slot]: part.id });
  const src = svgImgSrc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sec.viewOf?.(part.id) ?? sec.view}">${inner}</svg>`);
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, src);
  return src;
}
