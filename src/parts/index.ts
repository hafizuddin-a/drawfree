/* Part registry: every list in one place, with id lookups that fall back to the section's first part. */
import type { PartSlot, PartInfo } from '../types';
import { HAIR } from './hair';
import { FACE } from './faces';
import { GLASSES, FACIAL, HATS, NECK } from './extras';
import { TOPS } from './tops';
import { BOTTOMS } from './bottoms';
import { SHOES } from './shoes';
import { PROPS } from './props';

export { HAIR, FACE, GLASSES, FACIAL, HATS, NECK, TOPS, BOTTOMS, SHOES, PROPS };
export { SKIN, HAIRC, CLOTH } from './palettes';

/** the character part lists by slot, for validation and generic code */
export const PART_LISTS: { readonly [K in PartSlot]: readonly PartInfo[] } = {
  hair: HAIR, face: FACE, top: TOPS, bottom: BOTTOMS, shoes: SHOES, glasses: GLASSES, facial: FACIAL, hat: HATS, neck: NECK
};
export const PART_SLOTS = Object.keys(PART_LISTS) as PartSlot[];

export type Lookup<T extends PartInfo> = (id: string) => T;
/** id -> part, falling back to the first part of the list when the id is unknown */
export function lookup<T extends PartInfo>(list: readonly T[]): Lookup<T> {
  const m = new Map(list.map(p => [p.id, p] as const));
  return id => m.get(id) ?? list[0];
}
export const hasPart = (list: readonly PartInfo[], id: unknown): id is string => typeof id === 'string' && list.some(p => p.id === id);
