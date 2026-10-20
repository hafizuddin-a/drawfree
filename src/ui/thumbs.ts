/* Thumbnails are the real renderer with a cropped viewBox. Results are cached by section, part and the character's look. */
import type { Character, PartInfo } from '../types';
import { charSVG, newCharacter, propSVG } from '../rig/renderCharacter';
import { POSES, poseFrom } from '../rig/poses';
import { frameBG } from '../scenes/scenes';
import type { ListSection } from './sections';

const cache = new Map<string, string>();
const MAX_CACHE = 3000;

/** the part of a character that affects thumbnails: everything except where it stands on the board */
export function lookKey(c: Character): string {
  const { id: _id, x: _x, y: _y, s: _s, r: _r, flip: _f, ...look } = c;
  return JSON.stringify(look);
}

export function thumbSVG(sec: ListSection, part: PartInfo, base: Character | null, baseKey: string, bg: string): string {
  const key = sec.kind === 'scene' ? `scene|${part.id}|${bg}` : sec.kind === 'props' ? `props|${part.id}` : `${sec.id}|${part.id}|${baseKey}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const ch = base ?? newCharacter();
  let inner: string;
  if (sec.kind === 'scene') inner = frameBG({ bg, scene: part.id });
  else if (sec.kind === 'props') inner = propSVG({ prop: part.id, text: (part as { text?: string }).text });
  else if (sec.kind === 'pose') inner = charSVG({ ...ch, pose: poseFrom((POSES.find(p => p.id === part.id) ?? POSES[0]).t) });
  else inner = charSVG({ ...ch, [sec.slot]: part.id });
  const svg = `<svg viewBox="${sec.view}" aria-hidden="true">${inner}</svg>`;
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, svg);
  return svg;
}
