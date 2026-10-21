/* Picker config: the UI is generated from these lists. Add a part to its list and it shows up here, in search, and in thumbnails. */
import type { ColorSlot, PartInfo, PartSlot } from '../types';
import { BOTTOMS, CLOTH, FACE, FACIAL, GLASSES, HAIR, HAIRC, PROPS, SHOES, SKIN, TOPS } from '../parts';
import { POSES } from '../rig/poses';
import { SCENES } from '../scenes/scenes';
import { BGC } from '../scenes/backgrounds';
import type { TabId } from '../state/store';

const HEADV = '-42 -266 88 88', FACEV = '-28 -246 60 60';

export type SectionId =
  | 'hair' | 'hairC' | 'face' | 'skin' | 'top' | 'topC' | 'bottom' | 'botC' | 'shoes' | 'shoeC'
  | 'glasses' | 'facial' | 'hatC' | 'pose' | 'props' | 'scene' | 'bgC';

interface ListBase { id: SectionId; title: string; list: readonly PartInfo[]; view: string }
export type ListSection =
  | (ListBase & { kind: 'part'; slot: PartSlot })
  | (ListBase & { kind: 'pose' })
  | (ListBase & { kind: 'props' })
  | (ListBase & { kind: 'scene' });
export type ColorSection =
  | { id: SectionId; kind: 'color'; title: string; slot: ColorSlot; colors: readonly string[] }
  | { id: SectionId; kind: 'bg'; title: string; colors: readonly string[] };
export type Section = ListSection | ColorSection;

export const SECS: Record<SectionId, Section> = {
  hair: { id: 'hair', kind: 'part', title: 'Hairstyles', slot: 'hair', list: HAIR, view: HEADV },
  hairC: { id: 'hairC', kind: 'color', title: 'Hair colour (light styles)', slot: 'hairC', colors: HAIRC },
  face: { id: 'face', kind: 'part', title: 'Expressions', slot: 'face', list: FACE, view: FACEV },
  skin: { id: 'skin', kind: 'color', title: 'Skin tone', slot: 'skin', colors: SKIN },
  top: { id: 'top', kind: 'part', title: 'Tops', slot: 'top', list: TOPS, view: '-72 -190 144 150' },
  topC: { id: 'topC', kind: 'color', title: 'Top colour', slot: 'topC', colors: CLOTH },
  bottom: { id: 'bottom', kind: 'part', title: 'Bottoms', slot: 'bottom', list: BOTTOMS, view: '-72 -40 144 240' },
  botC: { id: 'botC', kind: 'color', title: 'Bottom colour', slot: 'botC', colors: CLOTH },
  shoes: { id: 'shoes', kind: 'part', title: 'Shoes', slot: 'shoes', list: SHOES, view: '-62 125 124 80' },
  shoeC: { id: 'shoeC', kind: 'color', title: 'Shoe colour', slot: 'shoeC', colors: CLOTH },
  glasses: { id: 'glasses', kind: 'part', title: 'Glasses', slot: 'glasses', list: GLASSES, view: FACEV },
  facial: { id: 'facial', kind: 'part', title: 'Facial hair', slot: 'facial', list: FACIAL, view: FACEV },
  hatC: { id: 'hatC', kind: 'color', title: 'Hat and headband colour', slot: 'hatC', colors: CLOTH },
  pose: { id: 'pose', kind: 'pose', title: 'Poses', list: POSES, view: '-130 -300 270 500' },
  props: { id: 'props', kind: 'props', title: 'Props', list: PROPS, view: '-125 -200 250 235' },
  scene: { id: 'scene', kind: 'scene', title: 'Scenes', list: SCENES, view: '0 0 960 540' },
  bgC: { id: 'bgC', kind: 'bg', title: 'Background colour', colors: BGC }
};

export const TABS: ReadonlyArray<{ id: TabId; label: string; secs: readonly SectionId[] }> = [
  { id: 'hair', label: 'Hair', secs: ['hair', 'hairC', 'hatC'] },
  { id: 'face', label: 'Face', secs: ['face', 'skin'] },
  { id: 'top', label: 'Tops', secs: ['top', 'topC'] },
  { id: 'bottom', label: 'Bottoms', secs: ['bottom', 'botC'] },
  { id: 'shoes', label: 'Shoes', secs: ['shoes', 'shoeC'] },
  { id: 'extras', label: 'Extras', secs: ['glasses', 'facial'] },
  { id: 'pose', label: 'Pose', secs: ['pose'] },
  { id: 'props', label: 'Props', secs: ['props'] },
  { id: 'scene', label: 'Scene', secs: ['scene', 'bgC'] }
];

export const isListSection = (s: Section): s is ListSection => 'list' in s;
/** every section with a list of parts, for global search */
export const SEARCHABLE: readonly ListSection[] = (Object.values(SECS)).filter(isListSection);
