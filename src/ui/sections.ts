/* Picker config: the UI is generated from these lists. Add a part to its list and it shows up here, in search, and in thumbnails. */
import type { ColorSlot, PartInfo, PartSlot } from '../types';
import { CLOTH, FACE, FACIAL, GLASSES, HAIR, HAIRC, PROPS, SKIN } from '../parts';
import { BUST_BODIES, SITTING_BODIES, STANDING_BODIES } from '../parts/bodies';
import { DEFAULT_BODY, GROUND } from '../rig/renderCharacter';
import { SCENES } from '../scenes/scenes';
import { BGC } from '../scenes/backgrounds';
import type { TabId } from '../state/store';

const ALL_BODIES = [...STANDING_BODIES, ...SITTING_BODIES, ...BUST_BODIES];

// Head thumbnails (hair, expressions, glasses, facial hair) are drawn on DEFAULT_BODY, moved down onto the ground line
// like every body. The head art spans about y -266 to -178 before that move.
const HEAD_DY = GROUND - (ALL_BODIES.find(x => x.id === DEFAULT_BODY)?.box[3] ?? GROUND);
const HEADV = `-42 ${-266 + HEAD_DY} 88 88`;

export type SectionId =
  | 'body' | 'bodySit' | 'bodyBust' | 'hair' | 'hairC' | 'face' | 'skin' | 'topC' | 'botC' | 'shoeC'
  | 'glasses' | 'facial' | 'hatC' | 'props' | 'scene' | 'bgC';

/** `viewOf`, when given, frames each thumbnail on its own (bodies differ in size); otherwise every thumbnail uses `view` */
interface ListBase { id: SectionId; title: string; list: readonly PartInfo[]; view: string; viewOf?: (id: string) => string }
export type ListSection =
  | (ListBase & { kind: 'part'; slot: PartSlot })
  | (ListBase & { kind: 'props' })
  | (ListBase & { kind: 'scene' });
export type ColorSection =
  | { id: SectionId; kind: 'color'; title: string; slot: ColorSlot; colors: readonly string[] }
  | { id: SectionId; kind: 'bg'; title: string; colors: readonly string[] };
export type Section = ListSection | ColorSection;

/** A square box around an Open Peeps body and its head once moved onto the ground line, with a little room. */
function bodyView(id: string): string {
  const b = ALL_BODIES.find(x => x.id === id)?.box;
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
  hairC: { id: 'hairC', kind: 'color', title: 'Hair colour', slot: 'hairC', colors: HAIRC },
  face: { id: 'face', kind: 'part', title: 'Expressions', slot: 'face', list: FACE, view: HEADV },
  skin: { id: 'skin', kind: 'color', title: 'Skin tone', slot: 'skin', colors: SKIN },
  topC: { id: 'topC', kind: 'color', title: 'Top colour', slot: 'topC', colors: CLOTH },
  botC: { id: 'botC', kind: 'color', title: 'Bottom colour', slot: 'botC', colors: CLOTH },
  shoeC: { id: 'shoeC', kind: 'color', title: 'Shoe colour', slot: 'shoeC', colors: CLOTH },
  glasses: { id: 'glasses', kind: 'part', title: 'Glasses', slot: 'glasses', list: GLASSES, view: HEADV },
  facial: { id: 'facial', kind: 'part', title: 'Facial hair', slot: 'facial', list: FACIAL, view: HEADV },
  hatC: { id: 'hatC', kind: 'color', title: 'Hat and headband colour', slot: 'hatC', colors: CLOTH },
  props: { id: 'props', kind: 'props', title: 'Props', list: PROPS, view: '-125 -200 250 235' },
  scene: { id: 'scene', kind: 'scene', title: 'Scenes', list: SCENES, view: '0 0 960 540' },
  bgC: { id: 'bgC', kind: 'bg', title: 'Background colour', colors: BGC }
};

export const TABS: ReadonlyArray<{ id: TabId; label: string; secs: readonly SectionId[] }> = [
  { id: 'body', label: 'Body', secs: ['body', 'bodySit', 'bodyBust'] },
  { id: 'hair', label: 'Hair', secs: ['hair', 'hairC', 'hatC'] },
  { id: 'face', label: 'Face', secs: ['face', 'skin'] },
  { id: 'clothes', label: 'Clothes', secs: ['topC', 'botC', 'shoeC'] },
  { id: 'extras', label: 'Extras', secs: ['glasses', 'facial'] },
  { id: 'props', label: 'Props', secs: ['props'] },
  { id: 'scene', label: 'Scene', secs: ['scene', 'bgC'] }
];

export const isListSection = (s: Section): s is ListSection => 'list' in s;
/** every section with a list of parts, for global search */
export const SEARCHABLE: readonly ListSection[] = (Object.values(SECS)).filter(isListSection);
