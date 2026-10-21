/* Picker config: the UI is generated from these lists. Add a part to its list and it shows up here, in search, and in thumbnails. */
import type { ColorSlot, PartInfo, PartSlot } from '../types';
import { BOTTOMS, CLOTH, FACE, FACIAL, GLASSES, HAIR, HAIRC, PROPS, SHOES, SKIN, TOPS } from '../parts';
import { POSES } from '../rig/poses';
import { BUST_BODIES, SITTING_BODIES, STANDING_BODIES } from '../parts/bodies';
import { GROUND, HEAD_DROP, TORSO_DROP } from '../rig/renderCharacter';
import { SCENES } from '../scenes/scenes';
import { BGC } from '../scenes/backgrounds';
import type { TabId } from '../state/store';

// Framed for the posable figure, which every thumbnail but a body's is drawn on: its head sits HEAD_DROP and its torso
// TORSO_DROP below the coordinates the head and top art use. Derived from those constants so the framing follows them.
// expressions, glasses and facial hair use the whole-head view too: a close-up cut the head off on every side
const HEADV = `-42 ${-266 + HEAD_DROP} 88 88`, TOPV = `-72 ${-190 + TORSO_DROP} 144 150`;

export type SectionId =
  | 'body' | 'bodySit' | 'bodyBust' | 'hair' | 'hairC' | 'face' | 'skin' | 'top' | 'topC' | 'bottom' | 'botC' | 'shoes' | 'shoeC'
  | 'glasses' | 'facial' | 'hatC' | 'pose' | 'props' | 'scene' | 'bgC';

/** `viewOf`, when given, frames each thumbnail on its own (bodies differ in size); otherwise every thumbnail uses `view` */
interface ListBase { id: SectionId; title: string; list: readonly PartInfo[]; view: string; viewOf?: (id: string) => string }
export type ListSection =
  | (ListBase & { kind: 'part'; slot: PartSlot })
  | (ListBase & { kind: 'pose' })
  | (ListBase & { kind: 'props' })
  | (ListBase & { kind: 'scene' });
export type ColorSection =
  | { id: SectionId; kind: 'color'; title: string; slot: ColorSlot; colors: readonly string[] }
  | { id: SectionId; kind: 'bg'; title: string; colors: readonly string[] };
export type Section = ListSection | ColorSection;

/** A square box around an Open Peeps body and its head once moved onto the ground line, with a little room. */
function bodyView(id: string): string {
  const b = [...STANDING_BODIES, ...SITTING_BODIES, ...BUST_BODIES].find(x => x.id === id)?.box;
  if (!b) return '-250 -290 500 500';
  const dy = GROUND - b[3], top = -262 + dy, x0 = Math.min(b[0], -45), x1 = Math.max(b[2], 45);
  const size = Math.max(x1 - x0, GROUND - top) + 16, cx = (x0 + x1) / 2, cy = (top + GROUND) / 2;
  return `${Math.round(cx - size / 2)} ${Math.round(cy - size / 2)} ${Math.round(size)} ${Math.round(size)}`;
}

export const SECS: Record<SectionId, Section> = {
  body: { id: 'body', kind: 'part', title: 'Standing', slot: 'body', list: STANDING_BODIES, view: '', viewOf: bodyView },
  bodySit: { id: 'bodySit', kind: 'part', title: 'Sitting', slot: 'body', list: SITTING_BODIES, view: '', viewOf: bodyView },
  bodyBust: { id: 'bodyBust', kind: 'part', title: 'Waist up', slot: 'body', list: BUST_BODIES, view: '', viewOf: bodyView },
  hair: { id: 'hair', kind: 'part', title: 'Hairstyles', slot: 'hair', list: HAIR, view: HEADV },
  hairC: { id: 'hairC', kind: 'color', title: 'Hair colour (light styles)', slot: 'hairC', colors: HAIRC },
  face: { id: 'face', kind: 'part', title: 'Expressions', slot: 'face', list: FACE, view: HEADV },
  skin: { id: 'skin', kind: 'color', title: 'Skin tone', slot: 'skin', colors: SKIN },
  top: { id: 'top', kind: 'part', title: 'Tops', slot: 'top', list: TOPS, view: TOPV },
  topC: { id: 'topC', kind: 'color', title: 'Top colour', slot: 'topC', colors: CLOTH },
  bottom: { id: 'bottom', kind: 'part', title: 'Bottoms', slot: 'bottom', list: BOTTOMS, view: '-72 -40 144 240' },
  botC: { id: 'botC', kind: 'color', title: 'Bottom colour', slot: 'botC', colors: CLOTH },
  shoes: { id: 'shoes', kind: 'part', title: 'Shoes', slot: 'shoes', list: SHOES, view: '-62 125 124 80' },
  shoeC: { id: 'shoeC', kind: 'color', title: 'Shoe colour', slot: 'shoeC', colors: CLOTH },
  glasses: { id: 'glasses', kind: 'part', title: 'Glasses', slot: 'glasses', list: GLASSES, view: HEADV },
  facial: { id: 'facial', kind: 'part', title: 'Facial hair', slot: 'facial', list: FACIAL, view: HEADV },
  hatC: { id: 'hatC', kind: 'color', title: 'Hat and headband colour', slot: 'hatC', colors: CLOTH },
  pose: { id: 'pose', kind: 'pose', title: 'Posable figure', list: POSES, view: '-250 -300 500 500' },
  props: { id: 'props', kind: 'props', title: 'Props', list: PROPS, view: '-125 -200 250 235' },
  scene: { id: 'scene', kind: 'scene', title: 'Scenes', list: SCENES, view: '0 0 960 540' },
  bgC: { id: 'bgC', kind: 'bg', title: 'Background colour', colors: BGC }
};

export const TABS: ReadonlyArray<{ id: TabId; label: string; secs: readonly SectionId[] }> = [
  { id: 'body', label: 'Body', secs: ['pose', 'body', 'bodySit', 'bodyBust'] },
  { id: 'hair', label: 'Hair', secs: ['hair', 'hairC', 'hatC'] },
  { id: 'face', label: 'Face', secs: ['face', 'skin'] },
  { id: 'top', label: 'Tops', secs: ['top', 'topC'] },
  { id: 'bottom', label: 'Bottoms', secs: ['bottom', 'botC'] },
  { id: 'shoes', label: 'Shoes', secs: ['shoes', 'shoeC'] },
  { id: 'extras', label: 'Extras', secs: ['glasses', 'facial'] },
  { id: 'props', label: 'Props', secs: ['props'] },
  { id: 'scene', label: 'Scene', secs: ['scene', 'bgC'] }
];

export const isListSection = (s: Section): s is ListSection => 'list' in s;
/** every section with a list of parts, for global search */
export const SEARCHABLE: readonly ListSection[] = (Object.values(SECS)).filter(isListSection);
