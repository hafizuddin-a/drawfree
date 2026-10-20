/* The editor's state container. Everything is immutable: an action builds new frames and items instead of editing in place,
   so React.memo can skip untouched characters and undo snapshots are plain references. */
import { create } from 'zustand';
import type { Aspect, Character, ColorSlot, Frame, Item, LimbId, LimbPose, PartSlot, Placement } from '../types';
import { CLOTH, FACIAL, FACE, GLASSES, HAIR, HAIRC, HATS, NECK, BOTTOMS, SHOES, SKIN, TOPS, PROPS } from '../parts';
import { LIMBS } from '../rig/geometry';
import { ik } from '../rig/ik';
import { presetPose, rig } from '../rig/poses';
import { newCharacter } from '../rig/renderCharacter';
import { DEFAULT_NAME, cleanName, type ProjectState } from '../export/project';
import { historyActions, type HistorySlice } from './history';
import { newId, seedFrames } from './seed';

export type TabId = 'hair' | 'face' | 'top' | 'bottom' | 'shoes' | 'extras' | 'pose' | 'props' | 'scene';
export type ItemAction = 'pose' | 'flip' | 'dup' | 'front' | 'del';
export interface Toast { id: number; msg: string; ms: number }

export interface EditorState extends HistorySlice {
  name: string;
  aspect: Aspect;
  frames: Frame[];
  fi: number;
  /** selected item id */
  sel: string | null;
  tab: TabId;
  q: string;
  /** pose handles are shown for the selected character */
  pose: boolean;
  toast: Toast | null;

  showToast: (msg: string, ms?: number) => void;
  select: (id: string | null) => void;
  setTab: (t: TabId) => void;
  setQuery: (q: string) => void;
  setName: (name: string) => void;

  /** no snapshot: callers snap first (drags snap once, after the pointer moves) */
  patchItem: (id: string, patch: Partial<Placement>) => void;
  setLimb: (id: string, limb: LimbId, pose: LimbPose) => void;
  flipBend: (id: string, limb: LimbId) => void;
  beginTextEdit: () => void;
  setBubbleText: (text: string) => void;
  setNote: (text: string) => void;

  applyPart: (slot: PartSlot, id: string) => void;
  applyColor: (slot: ColorSlot, color: string) => void;
  applyPose: (id: string) => void;
  addProp: (id: string) => void;
  addChar: () => void;
  shuffle: () => void;
  act: (a: ItemAction) => void;
  nudge: (dx: number, dy: number) => void;
  rotateBy: (deg: number) => void;
  resetRotation: () => void;
  setScene: (id: string) => void;
  setBg: (color: string) => void;

  selectFrame: (i: number) => void;
  addFrame: () => void;
  dupFrame: () => void;
  delFrame: () => void;

  loadProject: (p: ProjectState) => void;
  reset: () => void;
}

/* ---------- selectors and helpers ---------- */
type View = Pick<EditorState, 'frames' | 'fi' | 'sel'>;
export const currentFrame = (s: Pick<EditorState, 'frames' | 'fi'>): Frame => s.frames[s.fi];
export const selectedItem = (s: View): Item | null => (s.sel ? currentFrame(s).items.find(i => i.id === s.sel) ?? null : null);
/** the character the picker edits: the selected one, or the only one in the frame */
export function charTarget(s: View): Character | null {
  const it = selectedItem(s);
  if (it && it.kind === 'char') return it;
  const cs = currentFrame(s).items.filter((i): i is Character => i.kind === 'char');
  return cs.length === 1 ? cs[0] : null;
}

const editFrame = (s: Pick<EditorState, 'frames' | 'fi'>, fn: (f: Frame) => Frame): Frame[] =>
  s.frames.map((f, i) => (i === s.fi ? fn(f) : f));
const editItem = (s: Pick<EditorState, 'frames' | 'fi'>, id: string, fn: (it: Item) => Item): Frame[] =>
  editFrame(s, f => ({ ...f, items: f.items.map(it => (it.id === id ? fn(it) : it)) }));
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const pickId = <T extends { id: string }>(a: readonly T[]): string => pick(a).id;
const mapChar = (it: Item, fn: (c: Character) => Character): Item => (it.kind === 'char' ? fn(it) : it);

let toastSeq = 0;

export const initialState = () => ({
  name: DEFAULT_NAME, aspect: '16:9' as Aspect, frames: seedFrames(), fi: 0, sel: null as string | null,
  tab: 'hair' as TabId, q: '', pose: false, toast: null as Toast | null, past: [] as HistorySlice['past'], future: [] as HistorySlice['future']
});

export const useEditor = create<EditorState>()((set, get) => {
  const h = historyActions(set, get);
  /** the character to edit, selecting it; otherwise a hint and null */
  const needChar = (): Character | null => {
    const c = charTarget(get());
    if (!c) { get().showToast('Click a character on the board first'); return null; }
    if (get().sel !== c.id) set({ sel: c.id });
    return c;
  };
  const editChar = (fn: (c: Character) => Character) => {
    const c = needChar(); if (!c) return;
    h.snap();
    set(s => ({ frames: editItem(s, c.id, it => mapChar(it, fn)) }));
  };

  return {
    ...initialState(),
    ...h,

    showToast: (msg, ms = 2200) => set({ toast: { id: ++toastSeq, msg, ms } }),
    select: id => set(s => (s.sel === id ? s : { sel: id })),
    setTab: t => set({ tab: t, q: '' }),
    setQuery: q => set({ q }),
    setName: name => set({ name: cleanName(name) }),

    patchItem: (id, patch) => set(s => ({ frames: editItem(s, id, it => ({ ...it, ...patch })) })),
    setLimb: (id, limb, pose) => set(s => ({ frames: editItem(s, id, it => mapChar(it, c => ({ ...c, pose: { ...c.pose, [limb]: pose } }))) })),
    flipBend: (id, limb) => {
      if (!currentFrame(get()).items.some(i => i.id === id)) return;
      h.snap();
      const [o, l1, l2] = LIMBS[limb];
      set(s => ({ frames: editItem(s, id, i => mapChar(i, c => ({ ...c, pose: { ...c.pose, [limb]: ik(o, l1, l2, rig(c)[limb][2], c.pose[limb][2] === 1 ? -1 : 1) } }))) }));
    },
    beginTextEdit: () => h.snap(),
    setBubbleText: text => {
      const id = get().sel; if (!id) return;
      set(s => ({ frames: editItem(s, id, it => (it.kind === 'prop' ? { ...it, text } : it)) }));
    },
    setNote: text => set(s => ({ frames: editFrame(s, f => ({ ...f, note: text })) })),

    applyPart: (slot, id) => editChar(c => ({ ...c, [slot]: id })),
    applyColor: (slot, color) => editChar(c => ({ ...c, [slot]: color })),
    applyPose: id => editChar(c => ({ ...c, pose: presetPose(id) })),

    addProp: id => {
      h.snap();
      const def = PROPS.find(p => p.id === id) ?? PROPS[0];
      const y = ({ bubble: 118, plant: 462, chair: 462, table: 462 } as Record<string, number>)[def.id] ?? 300;
      const it: Item = { id: newId(), kind: 'prop', prop: def.id, x: 480 + Math.round((Math.random() - 0.5) * 160), y, s: 1, r: 0, flip: false };
      if (def.text) it.text = def.text;
      set(s => ({ frames: editFrame(s, f => ({ ...f, items: [...f.items, it] })), sel: it.id }));
    },
    addChar: () => {
      h.snap();
      const n = currentFrame(get()).items.filter(i => i.kind === 'char').length;
      const c = newCharacter({ id: newId(), x: 240 + (n % 4) * 160, y: 300 });
      set(s => ({ frames: editFrame(s, f => ({ ...f, items: [...f.items, c] })), sel: c.id }));
    },
    shuffle: () => {
      let c = charTarget(get());
      if (!c) {
        if (currentFrame(get()).items.some(i => i.kind === 'char')) { get().showToast('Click a character first'); return; }
        get().addChar(); c = charTarget(get());
        if (!c) return;
      } else h.snap();
      const look: Partial<Character> = {
        hair: pickId(HAIR), hairC: pick(HAIRC), face: pickId(FACE), skin: pick(SKIN), top: pickId(TOPS), topC: pick(CLOTH),
        bottom: pickId(BOTTOMS), botC: pick(CLOTH), shoes: pickId(SHOES), shoeC: pick(CLOTH), hatC: pick(CLOTH), neckC: pick(CLOTH),
        glasses: Math.random() < 0.4 ? pickId(GLASSES) : 'none', facial: Math.random() < 0.3 ? pickId(FACIAL) : 'none',
        hat: Math.random() < 0.3 ? pickId(HATS) : 'none', neck: Math.random() < 0.3 ? pickId(NECK) : 'none'
      };
      const id = c.id;
      set(s => ({ frames: editItem(s, id, it => mapChar(it, ch => ({ ...ch, ...look }))), sel: id }));
    },
    act: a => {
      const it = selectedItem(get()); if (!it) return;
      if (a === 'pose') { set(s => (s.pose ? { pose: false } : { pose: true, tab: 'pose', q: '' })); return; }
      h.snap();
      const id = it.id;
      if (a === 'flip') set(s => ({ frames: editItem(s, id, i => ({ ...i, flip: !i.flip })) }));
      else if (a === 'dup') {
        const copy: Item = { ...structuredClone(it), id: newId(), x: it.x + 40 };
        set(s => ({ frames: editFrame(s, f => ({ ...f, items: [...f.items, copy] })), sel: copy.id }));
      } else if (a === 'front') set(s => ({ frames: editFrame(s, f => ({ ...f, items: [...f.items.filter(i => i.id !== id), it] })) }));
      else if (a === 'del') set(s => ({ frames: editFrame(s, f => ({ ...f, items: f.items.filter(i => i.id !== id) })), sel: null }));
    },
    nudge: (dx, dy) => {
      const it = selectedItem(get()); if (!it) return;
      h.snap();
      set(s => ({ frames: editItem(s, it.id, i => ({ ...i, x: i.x + dx, y: i.y + dy })) }));
    },
    rotateBy: deg => {
      const it = selectedItem(get()); if (!it) return;
      h.snap();
      set(s => ({ frames: editItem(s, it.id, i => ({ ...i, r: (i.r || 0) + deg })) }));
    },
    resetRotation: () => {
      const it = selectedItem(get()); if (!it) return;
      h.snap();
      set(s => ({ frames: editItem(s, it.id, i => ({ ...i, r: 0 })) }));
    },
    setScene: id => { h.snap(); set(s => ({ frames: editFrame(s, f => ({ ...f, scene: id })) })); },
    setBg: color => { h.snap(); set(s => ({ frames: editFrame(s, f => ({ ...f, bg: color })) })); },

    selectFrame: i => set({ fi: i, sel: null }),
    addFrame: () => {
      h.snap();
      set(s => {
        const cur = currentFrame(s);
        return { frames: [...s.frames, { id: newId(), bg: cur.bg, scene: cur.scene || 'none', note: '', items: [] }], fi: s.frames.length, sel: null };
      });
    },
    dupFrame: () => {
      h.snap();
      set(s => {
        const copy: Frame = structuredClone(currentFrame(s));
        copy.id = newId(); copy.items.forEach(i => { i.id = newId(); });
        const frames = [...s.frames]; frames.splice(s.fi + 1, 0, copy);
        return { frames, fi: s.fi + 1, sel: null };
      });
    },
    delFrame: () => {
      if (get().frames.length < 2) return;
      h.snap();
      set(s => ({ frames: s.frames.filter((_, i) => i !== s.fi), fi: Math.max(0, s.fi - 1), sel: null }));
    },

    loadProject: p => {
      h.snap();
      set({ frames: p.frames, fi: 0, sel: null, name: p.name, aspect: p.aspect });
    },
    reset: () => {
      h.snap();
      set({ frames: seedFrames(), fi: 0, sel: null, name: DEFAULT_NAME, aspect: '16:9' });
    }
  };
});

/** replaces the whole store with a fresh seeded state (tests) */
export const resetEditorStore = (): void => useEditor.setState({ ...initialState() });
