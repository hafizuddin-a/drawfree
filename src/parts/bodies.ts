/* Bodies: the posable figure ('rig', a cutout puppet dressed by the top, bottom and shoe parts) or one of the Open Peeps
   bodies (CC0), which come dressed in a fixed pose. The Open Peeps art is about 180 KB gzipped, so it is a separate
   chunk: `loadBodyArt()` fetches it once, `bodyArt(id)` returns it when it has arrived. Names, tags and bounds are
   small and always here. */
import type { BodyPart, PeepArt } from '../types';
import type { CutoutClips } from './peeps/cutout.gen';
import { tags } from './draw';
import { PEEP_BODY_BOX } from './peeps/bodies.box.gen';

type Meta = readonly [id: string, name: string, tags: string];

const STAND: readonly Meta[] = [
  ['resting-1', 'Hand in pocket', 'standing relaxed casual pocket'],
  ['resting-2', 'Hand in pocket, dark top', 'standing relaxed casual pocket'],
  ['easing-1', 'Open shirt', 'standing casual open shirt sneakers'],
  ['easing-2', 'Open shirt, light trousers', 'standing casual open shirt sneakers'],
  ['crossed-arms-1', 'Arms crossed', 'standing arms crossed folded waiting'],
  ['crossed-arms-2', 'Arms crossed, dark top', 'standing arms crossed folded waiting'],
  ['pointing-finger-1', 'Pointing up', 'standing pointing idea point'],
  ['pointing-finger-2', 'Pointing up, dark top', 'standing pointing idea point'],
  ['robot-dance-1', 'Presenting', 'standing presenting explaining gesture'],
  ['robot-dance-2', 'Presenting, dark top', 'standing presenting explaining gesture'],
  ['robot-dance-3', 'Presenting, light trousers', 'standing presenting explaining gesture'],
  ['walking-1', 'Walking', 'walking walk stride'],
  ['walking-2', 'Walking, dark tee', 'walking walk stride'],
  ['walking-3', 'Walking, all dark', 'walking walk stride'],
  ['blazer-3', 'Blazer, hand on hip', 'standing blazer jacket office formal hip'],
  ['blazer-4', 'Blazer, dark trousers', 'standing blazer jacket office formal hip'],
  ['blazer-1', 'Blazer, prosthetic leg', 'standing blazer jacket office prosthetic amputee disability'],
  ['blazer-2', 'Blazer, prosthetic leg, dark trousers', 'standing blazer jacket office prosthetic amputee disability'],
  ['shirt-3', 'Shirt, hands in pockets', 'standing shirt button pockets'],
  ['shirt-4', 'Dark shirt, hands in pockets', 'standing shirt button pockets'],
  ['shirt-1', 'Shirt and shorts, prosthetic leg', 'standing shirt shorts prosthetic amputee disability'],
  ['shirt-2', 'Dark shirt and shorts, prosthetic leg', 'standing shirt shorts prosthetic amputee disability'],
  ['polka-dots', 'Polka-dot top', 'standing polka dots pattern']
];
const SIT: readonly Meta[] = [
  ['crossed-legs', 'Legs crossed', 'sitting seated chair legs crossed'],
  ['one-leg-up-1', 'Sitting, knee up', 'sitting floor ground relaxed knee'],
  ['one-leg-up-2', 'Sitting, knee up, dark trousers', 'sitting floor ground relaxed knee'],
  ['closed-legs-1', 'Hugging knees', 'sitting floor knees hug'],
  ['closed-legs-2', 'Hugging knees, dark jacket', 'sitting floor knees hug'],
  ['mid-1', 'Squatting', 'squat crouch squatting'],
  ['mid-2', 'Squatting, dark trousers', 'squat crouch squatting'],
  ['hands-back-1', 'Kneeling', 'kneeling knees floor'],
  ['hands-back-2', 'Kneeling, dark trousers', 'kneeling knees floor'],
  ['bike', 'Cycling', 'bike bicycle cycling ride commute'],
  ['wheelchair', 'Wheelchair', 'wheelchair sitting disability accessible']
];
const BUST: readonly Meta[] = [
  ['tee-1', 'Tee', 'waist up bust tee t-shirt casual'],
  ['tee-2', 'Dark tee', 'waist up bust tee t-shirt casual'],
  ['tee-arms-crossed', 'Tee, arms crossed', 'waist up bust tee arms crossed'],
  ['striped-tee', 'Striped tee', 'waist up bust tee stripes'],
  ['explaining', 'Striped tee, explaining', 'waist up bust tee stripes talking gesture'],
  ['sporty-tee', 'Ringer tee', 'waist up bust tee sporty'],
  ['striped-pocket-tee', 'Pocket tee, hands on hips', 'waist up bust tee pocket hips'],
  ['tee-selena', 'Logo tee', 'waist up bust tee logo print'],
  ['thunder-t-shirt', 'Lightning tee', 'waist up bust tee lightning print'],
  ['whatever', 'Shrugging', 'waist up bust shrug whatever dunno'],
  ['gym-shirt', 'Tank top', 'waist up bust tank top vest gym sleeveless'],
  ['button-shirt-1', 'Shirt', 'waist up bust shirt button collar'],
  ['button-shirt-2', 'Shirt, pointed collar', 'waist up bust shirt button collar'],
  ['blazer-black-tee', 'Blazer and tee', 'waist up bust blazer jacket office'],
  ['shirt-and-coat', 'Coat over stripes', 'waist up bust coat jacket stripes'],
  ['polka-dot-jacket', 'Polka-dot jacket, pointing', 'waist up bust jacket polka dots pointing'],
  ['fur-jacket', 'Fur-collar jacket', 'waist up bust jacket fur winter'],
  ['hoodie', 'Hoodie', 'waist up bust hoodie sweatshirt'],
  ['sweater', 'Knit sweater, arms crossed', 'waist up bust sweater knit jumper arms crossed'],
  ['sweater-dots', 'Speckled sweater', 'waist up bust sweater jumper'],
  ['polo-and-sweater', 'Sweater over polo', 'waist up bust sweater polo collar'],
  ['turtleneck', 'Turtleneck', 'waist up bust turtleneck sweater'],
  ['dress', 'Off-shoulder top', 'waist up bust dress off shoulder'],
  ['pointing-up', 'Pointing up', 'waist up bust pointing idea'],
  ['coffee', 'Holding a coffee', 'waist up bust coffee mug cup drink'],
  ['device', 'Holding a phone', 'waist up bust phone device mobile'],
  ['macbook', 'Holding a laptop', 'waist up bust laptop computer work'],
  ['paper', 'Reading a note', 'waist up bust paper note reading'],
  ['gaming', 'Gaming', 'waist up bust gaming controller game'],
  ['killer', 'Holding a knife', 'waist up bust knife villain cooking']
];

function list(kind: 'stand' | 'sit' | 'bust', meta: readonly Meta[]): BodyPart[] {
  return meta.map(([id, name, t]) => {
    const full = `${kind}-${id}`, box = PEEP_BODY_BOX[full];
    if (!box) throw new Error(`body ${full} has no bounds: re-run tools/import-peeps.ts`);
    return { id: full, name, tags: tags(t), kind, box };
  });
}

export const RIG_BODY: BodyPart = { id: 'rig', name: 'Posable figure', tags: tags('posable pose figure drag arms legs custom'), kind: 'rig' };
export const STANDING_BODIES = list('stand', STAND);
export const SITTING_BODIES = list('sit', SIT);
export const BUST_BODIES = list('bust', BUST);
/** every body; the posable figure comes first, so it is the fallback for unknown ids */
export const BODIES: readonly BodyPart[] = [RIG_BODY, ...STANDING_BODIES, ...SITTING_BODIES, ...BUST_BODIES];
if (Object.keys(PEEP_BODY_BOX).length !== BODIES.length - 1) throw new Error('an imported Open Peeps body has no name in parts/bodies.ts');

const art = new Map<string, PeepArt>();
let clips: Readonly<Record<string, CutoutClips>> = {};
let loading: Promise<void> | null = null;
let version = 0;

/** Fetches the Open Peeps body art once, with the cutout puppet's clip shapes (the posable figure is cut from the
    same art). A failed fetch (offline) can be retried. */
export function loadBodyArt(): Promise<void> {
  loading ??= Promise.all([import('./peeps/bodies.gen'), import('./peeps/cutout.gen')]).then(
    ([m, c]) => {
      for (const a of [...m.PEEP_STANDING, ...m.PEEP_SITTING, ...m.PEEP_BUSTS]) art.set(a.id, a);
      clips = c.CUTOUT_CLIPS;
      version++;
    },
    (e: unknown) => { loading = null; throw e; }
  );
  return loading;
}
/** the art for a body, or undefined until loadBodyArt() has finished */
export const bodyArt = (id: string): PeepArt | undefined => art.get(id);
/** a cutout family's clip shapes, or undefined until loadBodyArt() has finished */
export const cutoutClips = (fam: string): CutoutClips | undefined => clips[fam];
/** bumps when the art arrives, so caches keyed on it (thumbnails) refresh */
export const bodyArtVersion = (): number => version;
