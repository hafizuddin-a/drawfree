/* Head parts: hairstyles (with the head itself), expressions, facial hair and glasses, all from Open Peeps
   (CC0, imported by tools/import-peeps.ts). This file gives them friendly names, search tags and picker order. */
import type { PeepArt, PeepPart } from '../types';
import { tags } from './draw';
import { PEEP_ACCESSORIES } from './peeps/accessories.gen';
import { PEEP_FACES } from './peeps/faces.gen';
import { PEEP_FACIAL } from './peeps/facial.gen';
import { PEEP_HEADS } from './peeps/heads.gen';

type Meta = readonly [id: string, name: string, tags: string];

/** Builds a part list in `meta` order. Every imported part must be listed, so a re-import cannot drop one silently. */
function list(art: readonly PeepArt[], meta: readonly Meta[], what: string): PeepPart[] {
  const byId = new Map(art.map(a => [a.id, a] as const));
  if (meta.length !== art.length) throw new Error(`${what}: ${art.length} imported, ${meta.length} named`);
  return meta.map(([id, name, t]) => {
    const a = byId.get(id);
    if (!a) throw new Error(`${what}: no art for ${id}`);
    return { id, name, tags: tags(t), art: a };
  });
}

/* Every hairstyle and beard takes the hair colour (light hair from its white areas, dark hair from its solid ink, with an ink outline kept). Hats and headbands use the hat colour. */
export const HAIR: PeepPart[] = list(PEEP_HEADS, [
  ['short-1', 'Short side part', 'short neat side part dark'],
  ['short-2', 'Short slick', 'short slick neat dark'],
  ['short-3', 'Short curls', 'short curly dark'],
  ['short-4', 'Short swept', 'short swept quiff light blonde'],
  ['short-5', 'Short messy', 'short messy tousled dark'],
  ['pomp', 'Pompadour', 'pompadour quiff short volume dark'],
  ['flat-top', 'Flat top', 'flat top short dark'],
  ['flat-top-long', 'High top', 'high top flat tall dark'],
  ['shaved-1', 'Buzz cut', 'buzz shaved short crop dark'],
  ['shaved-2', 'Fade', 'fade shaved short dark'],
  ['shaved-3', 'Shaggy', 'shaggy messy medium dark'],
  ['twists', 'Twists', 'twists locs short dark'],
  ['twists-2', 'Short twists', 'twists curly short dark'],
  ['mohawk', 'Mohawk', 'mohawk punk light'],
  ['mohawk-2', 'Spiky', 'spiky punk light'],
  ['no-hair-1', 'Bald', 'bald none shaved'],
  ['no-hair-2', 'Thinning', 'bald thinning old'],
  ['no-hair-3', 'Bald, big ears', 'bald ears'],
  ['afro', 'Afro', 'afro curly volume dark'],
  ['long-afro', 'Big afro', 'afro big curly volume long dark'],
  ['bantu-knots', 'Bantu knots', 'bantu knots knotty dark'],
  ['buns', 'Space buns', 'buns puffs space dark'],
  ['bun', 'Bun with headband', 'bun updo headband scarf dark'],
  ['bun-2', 'Messy bun', 'bun updo messy headband dark'],
  ['gray-bun', 'Bun', 'bun updo light grey gray'],
  ['cornrows', 'Cornrows', 'cornrows braids ponytail dark'],
  ['cornrows-2', 'Braids', 'braids box cornrows long dark'],
  ['medium-1', 'Bob', 'bob medium short dark'],
  ['medium-2', 'Flicked bob', 'bob flick medium dark'],
  ['medium-3', 'Shoulder length', 'medium shoulder dark'],
  ['medium-straight', 'Straight, side part', 'straight medium side part dark'],
  ['medium-bangs', 'Bob with fringe', 'bob fringe bangs medium dark'],
  ['medium-bangs-2', 'Curly fringe', 'curly fringe bangs medium light'],
  ['medium-bangs-3', 'Fringe', 'fringe bangs medium dark'],
  ['bangs', 'Blunt bob', 'bob fringe bangs light blonde'],
  ['bangs-2', 'Blunt bob, dark', 'bob fringe bangs dark'],
  ['gray-medium', 'Swept bob', 'bob medium swept light grey gray'],
  ['gray-short', 'Short swept', 'short swept light grey gray'],
  ['long', 'Long waves', 'long wavy dark'],
  ['long-bangs', 'Long with fringe', 'long fringe bangs wavy dark'],
  ['long-curly', 'Long curls', 'long curly volume dark'],
  ['bear', 'Shaggy beard', 'shaggy beard hairy bushy light'],
  ['hat-beanie', 'Beanie', 'beanie hat knit winter'],
  ['hat-hip', 'Wide-brim hat', 'hat fedora wide brim'],
  ['hijab', 'Hijab', 'hijab headscarf scarf'],
  ['turban', 'Turban', 'turban headwrap']
], 'hair');

export const FACE: PeepPart[] = list(PEEP_FACES, [
  ['smile', 'Smile', 'happy smile'],
  ['smile-big', 'Big grin', 'grin teeth happy laugh'],
  ['smile-lol', 'Laughing', 'laugh lol tears happy'],
  ['smile-teeth-gap', 'Gap-tooth grin', 'grin teeth gap happy'],
  ['calm', 'Calm', 'calm content closed eyes'],
  ['cute', 'Wink', 'wink cute playful'],
  ['cheeky', 'Cheeky', 'cheeky playful tongue'],
  ['loving-grin-1', 'Heart eyes', 'love heart eyes grin'],
  ['loving-grin-2', 'Heart eyes, teeth', 'love heart eyes teeth'],
  ['eating-happy', 'Eating', 'eating chewing happy food'],
  ['explaining', 'Explaining', 'talking explaining speaking'],
  ['blank', 'Neutral', 'neutral blank flat'],
  ['serious', 'Serious', 'serious focused stern'],
  ['solemn', 'Sad', 'sad solemn down unhappy'],
  ['tired', 'Tired', 'tired sleepy exhausted'],
  ['eyes-closed', 'Eyes closed', 'eyes closed asleep resting'],
  ['old', 'Wise', 'old wise wrinkles'],
  ['awe', 'Amazed', 'awe amazed wow surprised'],
  ['fear', 'Scared', 'fear scared afraid'],
  ['hectic', 'Panicked', 'panic hectic stress'],
  ['concerned', 'Worried', 'worried concerned nervous'],
  ['concerned-fear', 'Shocked', 'shocked worried fear'],
  ['suspicious', 'Suspicious', 'suspicious doubt sceptical'],
  ['contempt', 'Smug', 'smug contempt'],
  ['driven', 'Determined', 'determined driven focused'],
  ['angry-with-fang', 'Annoyed', 'annoyed angry fang'],
  ['very-angry', 'Angry', 'angry mad cross'],
  ['rage', 'Furious', 'rage furious shouting'],
  ['cyclops', 'Cyclops', 'cyclops monster one eye'],
  ['monster', 'Monster', 'monster fangs halloween']
], 'face');

export const FACIAL: PeepPart[] = list(PEEP_FACIAL, [
  ['none', 'Clean shaven', 'none'],
  ['moustache-1', 'Moustache', 'moustache mustache'],
  ['moustache-2', 'Horseshoe', 'moustache horseshoe biker'],
  ['moustache-3', 'Handlebar', 'moustache handlebar curly'],
  ['moustache-4', 'Thin moustache', 'moustache pencil thin'],
  ['moustache-5', 'Bushy moustache', 'moustache bushy walrus'],
  ['moustache-6', 'Short moustache', 'moustache short'],
  ['moustache-7', 'Moustache and tuft', 'moustache tuft soul patch'],
  ['moustache-8', 'Extra-long moustache', 'moustache long curly fun'],
  ['moustache-9', 'Light moustache', 'moustache light blonde'],
  ['goatee-1', 'Goatee', 'goatee chin'],
  ['goatee-2', 'Full goatee', 'goatee circle'],
  ['chin', 'Chin strap', 'chin strap beard'],
  ['full', 'Beard', 'beard full'],
  ['full-2', 'Bushy beard', 'beard bushy full'],
  ['full-3', 'Long beard', 'beard long full'],
  ['full-4', 'Light beard', 'beard light blonde full']
], 'facial hair');

export const GLASSES: PeepPart[] = list(PEEP_ACCESSORIES, [
  ['none', 'No glasses', 'none'],
  ['glasses', 'Round glasses', 'glasses round specs'],
  ['glasses-2', 'Wire glasses', 'glasses wire thin specs'],
  ['glasses-3', 'Bold glasses', 'glasses thick bold frames'],
  ['glasses-4', 'White frames', 'glasses white frames'],
  ['glasses-5', 'Small glasses', 'glasses small round'],
  ['sunglasses', 'Sunglasses', 'sunglasses shades dark'],
  ['sunglasses-2', 'Aviators', 'sunglasses aviators shades'],
  ['eyepatch', 'Eyepatch', 'eyepatch pirate']
], 'glasses');
