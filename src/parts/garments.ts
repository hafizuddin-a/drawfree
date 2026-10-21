/* Clothes for the posable figure, all Open Peeps: each garment is the top, bottom or shoes of an Open Peeps standing
   body, cut into puppet pieces by its family's clip shapes (parts/cutout.ts). Colours come from the art's colour
   kinds, so the top, bottom and shoe colours recolour them like any Open Peeps body. */
import type { BottomPart, ShoePart, TopPart } from '../types';
import { tags } from './draw';

export const TOPS: TopPart[] = [
  { id: 'shirt', name: 'Shirt', tags: tags('shirt button collar pocket long sleeve'), fam: 'shirt', art: 'stand-shirt-3' },
  { id: 'shirt-light-buttons', name: 'Shirt, light buttons', tags: tags('shirt button collar pocket long sleeve'), fam: 'shirt', art: 'stand-shirt-4' }
];
export const BOTTOMS: BottomPart[] = [
  { id: 'trousers', name: 'Trousers', tags: tags('trousers pants long chinos'), fam: 'shirt', art: 'stand-shirt-3' }
];
export const SHOES: ShoePart[] = [
  { id: 'slip-ons', name: 'Slip-ons', tags: tags('shoes slip-ons sneakers casual'), fam: 'shirt', art: 'stand-shirt-3' }
];
