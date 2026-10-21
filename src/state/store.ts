/* The editor's state container. Everything is immutable: an action builds new frames and items instead of editing in place,
   so React.memo can skip untouched characters and undo snapshots are plain references. */
import { create } from 'zustand';
import type { Aspect, Character, ColorSlot, Frame, Item, PartSlot, Placement } from '../types';
import { BODIES, CLOTH, FACIAL, FACE, GLASSES, HAIR, HAIRC, SKIN, PROPS } from '../parts';
import { canFlip, newCharacter } from '../rig/renderCharacter';
import { DEFAULT_NAME, cleanName, type ProjectState } from '../export/project';
import { DEFAULT_VIEW, type Pt, type View, clampView, panBy as panView, zoomAt } from '../editor/view';
import { historyActions, type HistorySlice } from './history';
import { newId, seedFrames } from './seed';

export type TabId = 'body' | 'hair' | 'face' | 'clothes' | 'extras' | 'props' | 'scene';
export type ItemAction = 'flip' | 'dup' | 'front' | 'del';
export interface Toast { id: number; msg: string; ms: number }

export interface EditorState extends HistorySlice {
  name: string;
  aspect: Aspect;
  frames: Frame[];
  fi: number;
  /** the primary selected item id (the last one clicked; the one the box handles work on) */
  sel: string | null;
  /** the other selected items, when several are selected. Never contains `sel`. */
  extra: string[];
  /** a marquee being dragged, in page (client) pixels */
  marquee: { x0: number; y0: number; x1: number; y1: number } | null;
  tab: TabId;
  q: string;
  toast: Toast | null;
  /** the stage's zoom and pan. Not in undo history and not saved. */
  view: View;
  /** bumps when the Open Peeps body art finishes loading, so everything drawn with it redraws */
  art: number;

  showToast: (msg: string, ms?: number) => void;
  select: (id: string | null) => void;
  /** adds the item to the selection, or removes it if it is already selected (Shift-click) */
  toggleSelect: (id: string) => void;
  /** selects exactly these items (the first becomes the primary one) */
  selectMany: (ids: string[]) => void;
  selectAll: () => void;
  setMarquee: (m: { x0: number; y0: number; x1: number; y1: number } | null) => void;
  /** moves several items at once: no snapshot, callers snap first */
  patchItems: (patches: Record<string, Partial<Placement>>) => void;
  /** zooms about a frame point (default: the centre of the view) */
  zoomBy: (factor: number, at?: Pt) => void;
  panBy: (dx: number, dy: number) => void;
  panTo: (cx: number, cy: number) => void;
  resetView: () => void;
  setTab: (t: TabId) => void;
  setQuery: (q: string) => void;
  setName: (name: string) => void;

  /** no snapshot: callers snap first (drags snap once, after the pointer moves) */
  patchItem: (id: string, patch: Partial<Placement>) => void;
  beginTextEdit: () => void;
  setBubbleText: (text: string) => void;
  setNote: (text: string) => void;

  applyPart: (slot: PartSlot, id: string) => void;
  applyColor: (slot: ColorSlot, color: string) => void;
  addProp: (id: string) => void;
  addChar: () => void;
  shuffle: () => void;
  act: (a: ItemAction) => void;
  nudge: (dx: number, dy: number) => void;
  rotateBy: (deg: number) => void;
  /** multiplies the selected item's scale, within the same limits as dragging a corner (0.3 to 3) */
  scaleBy: (factor: number) => void;
  resetRotation: () => void;
  setScene: (id: string) => void;
  setBg: (color: string) => void;

  selectFrame: (i: number) => void;
  addFrame: () => void;
  dupFrame: () => void;
  delFrame: () => void;
  /** moves a frame to a new position; the current frame stays current and the move is one undo step */
  moveFrame: (from: number, to: number) => void;

  loadProject: (p: ProjectState) => void;
  reset: () => void;
}

/* ---------- selectors and helpers ---------- */
type Selection = Pick<EditorState, 'frames' | 'fi' | 'sel' | 'extra'>;
export const currentFrame = (s: Pick<EditorState, 'frames' | 'fi'>): Frame => s.frames[s.fi];
/** every selected id, the primary one first */
export const selectedIds = (s: Pick<EditorState, 'sel' | 'extra'>): string[] => (s.sel ? [s.sel, ...s.extra] : []);
/** every selected item, in z-order */
export function selectedItems(s: Selection): Item[] {
  const ids = new Set(selectedIds(s));
  return ids.size ? currentFrame(s).items.filter(i => ids.has(i.id)) : [];
}
export const selectedItem = (s: Selection): Item | null => (s.sel ? currentFrame(s).items.find(i => i.id === s.sel) ?? null : null);
/** the character the picker edits: the selected one, or the only one in the frame */
export function charTarget(s: Selection): Character | null {
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
/** the body a new character gets */
export const NEW_BODY = 'stand-resting-1';

const initialState = () => ({
  name: DEFAULT_NAME, aspect: '16:9' as Aspect, frames: seedFrames(), fi: 0, sel: null as string | null, extra: [] as string[], marquee: null as EditorState['marquee'],
  tab: 'hair' as TabId, q: '', toast: null as Toast | null, view: DEFAULT_VIEW, art: 0, past: [] as HistorySlice['past'], future: [] as HistorySlice['future']
});

export const useEditor = create<EditorState>()((set, get) => {
  const h = historyActions(set, get);
  /** the character to edit, selecting it; otherwise a hint and null */
  const needChar = (): Character | null => {
    const c = charTarget(get());
    if (!c) { get().showToast('Click a character on the board first'); return null; }
    if (get().sel !== c.id) set({ sel: c.id, extra: [] });
    return c;
  };
  /** edits every selected character, or the one the picker targets when none is selected */
  const editChar = (fn: (c: Character) => Character) => {
    const chars = selectedItems(get()).filter((i): i is Character => i.kind === 'char');
    const targets = chars.length ? chars : (() => { const c = needChar(); return c ? [c] : []; })();
    if (!targets.length) return;
    h.snap();
    const ids = new Set(targets.map(c => c.id));
    set(s => ({ frames: editFrame(s, f => ({ ...f, items: f.items.map(it => (ids.has(it.id) ? mapChar(it, fn) : it)) })) }));
  };
  /** applies `fn` to every selected item as one undo step; `fn` may return the item unchanged. Returns false when nothing is selected. */
  const editSelected = (fn: (it: Item) => Item): boolean => {
    const ids = new Set(selectedIds(get()));
    if (!ids.size) return false;
    h.snap();
    set(s => ({ frames: editFrame(s, f => ({ ...f, items: f.items.map(it => (ids.has(it.id) ? fn(it) : it)) })) }));
    return true;
  };

  return {
    ...initialState(),
    ...h,

    showToast: (msg, ms = 2200) => set({ toast: { id: ++toastSeq, msg, ms } }),
    select: id => set(s => (s.sel === id && !s.extra.length ? s : { sel: id, extra: [] })),
    toggleSelect: id => set(s => {
      const ids = selectedIds(s);
      if (ids.includes(id)) { const rest = ids.filter(i => i !== id); return { sel: rest[0] ?? null, extra: rest.slice(1) }; }
      return s.sel ? { extra: [...s.extra, id] } : { sel: id, extra: [] };
    }),
    selectMany: ids => set({ sel: ids[0] ?? null, extra: ids.slice(1) }),
    selectAll: () => { const ids = currentFrame(get()).items.map(i => i.id); set({ sel: ids[0] ?? null, extra: ids.slice(1) }); },
    setMarquee: m => set({ marquee: m }),
    patchItems: patches => set(s => ({ frames: editFrame(s, f => ({ ...f, items: f.items.map(it => (patches[it.id] ? { ...it, ...patches[it.id] } : it)) })) })),
    zoomBy: (factor, at) => set(s => ({ view: zoomAt(s.view, factor, at ?? { x: s.view.cx, y: s.view.cy }) })),
    panBy: (dx, dy) => set(s => ({ view: panView(s.view, dx, dy) })),
    panTo: (cx, cy) => set(s => ({ view: clampView({ ...s.view, cx, cy }) })),
    resetView: () => set({ view: DEFAULT_VIEW }),
    setTab: t => set({ tab: t, q: '' }),
    setQuery: q => set({ q }),
    setName: name => set({ name: cleanName(name) }),

    patchItem: (id, patch) => set(s => ({ frames: editItem(s, id, it => ({ ...it, ...patch })) })),
    beginTextEdit: () => h.snap(),
    setBubbleText: text => {
      const id = get().sel; if (!id) return;
      set(s => ({ frames: editItem(s, id, it => (it.kind === 'prop' ? { ...it, text } : it)) }));
    },
    setNote: text => set(s => ({ frames: editFrame(s, f => ({ ...f, note: text })) })),

    applyPart: (slot, id) => editChar(c => ({ ...c, [slot]: id })),
    applyColor: (slot, color) => editChar(c => ({ ...c, [slot]: color })),

    addProp: id => {
      h.snap();
      const def = PROPS.find(p => p.id === id) ?? PROPS[0];
      const y = ({ bubble: 118, plant: 462, chair: 462, table: 462 } as Record<string, number>)[def.id] ?? 300;
      const it: Item = { id: newId(), kind: 'prop', prop: def.id, x: 480 + Math.round((Math.random() - 0.5) * 160), y, s: 1, r: 0, flip: false };
      if (def.text) it.text = def.text;
      set(s => ({ frames: editFrame(s, f => ({ ...f, items: [...f.items, it] })), sel: it.id, extra: [] }));
    },
    addChar: () => {
      h.snap();
      const n = currentFrame(get()).items.filter(i => i.kind === 'char').length;
      const c = newCharacter({ id: newId(), x: 240 + (n % 4) * 160, y: 300, body: NEW_BODY });
      set(s => ({ frames: editFrame(s, f => ({ ...f, items: [...f.items, c] })), sel: c.id, extra: [] }));
    },
    shuffle: () => {
      let c = charTarget(get());
      if (!c) {
        if (currentFrame(get()).items.some(i => i.kind === 'char')) { get().showToast('Click a character first'); return; }
        get().addChar(); c = charTarget(get());
        if (!c) return;
      } else h.snap();
      const kind = BODIES.find(b => b.id === c.body)?.kind ?? 'stand';
      const look: Partial<Character> = {
        // the body changes to another of the same kind (standing, sitting, waist up), so the scene still makes sense
        body: pickId(BODIES.filter(b => b.kind === kind)),
        hair: pickId(HAIR), hairC: pick(HAIRC), face: pickId(FACE), skin: pick(SKIN), topC: pick(CLOTH),
        botC: pick(CLOTH), shoeC: pick(CLOTH), hatC: pick(CLOTH),
        glasses: Math.random() < 0.4 ? pickId(GLASSES) : 'none', facial: Math.random() < 0.3 ? pickId(FACIAL) : 'none'
      };
      const id = c.id;
      set(s => ({ frames: editItem(s, id, it => mapChar(it, ch => ({ ...ch, ...look }))), sel: id, extra: [] }));
    },
    act: a => {
      if (!selectedItem(get())) return;
      const picked = selectedItems(get()), ids = new Set(picked.map(i => i.id));
      h.snap();
      if (a === 'flip') set(s => ({ frames: editFrame(s, f => ({ ...f, items: f.items.map(i => (ids.has(i.id) && canFlip(i) ? { ...i, flip: !i.flip } : i)) })) }));
      else if (a === 'dup') {
        const copies: Item[] = picked.map(it => ({ ...structuredClone(it), id: newId(), x: it.x + 40 }));
        set(s => ({ frames: editFrame(s, f => ({ ...f, items: [...f.items, ...copies] })), sel: copies[0].id, extra: copies.slice(1).map(c => c.id) }));
      } else if (a === 'front') set(s => ({ frames: editFrame(s, f => ({ ...f, items: [...f.items.filter(i => !ids.has(i.id)), ...picked] })) }));
      else if (a === 'del') set(s => ({ frames: editFrame(s, f => ({ ...f, items: f.items.filter(i => !ids.has(i.id)) })), sel: null, extra: [] }));
    },
    nudge: (dx, dy) => { editSelected(i => ({ ...i, x: i.x + dx, y: i.y + dy })); },
    rotateBy: deg => { editSelected(i => ({ ...i, r: (i.r || 0) + deg })); },
    scaleBy: factor => {
      const picked = selectedItems(get());
      if (!picked.some(i => Math.max(0.3, Math.min(3, i.s * factor)) !== i.s)) return;     // nothing would change: no undo step
      editSelected(i => ({ ...i, s: Math.max(0.3, Math.min(3, i.s * factor)) }));
    },
    resetRotation: () => { editSelected(i => ({ ...i, r: 0 })); },
    setScene: id => { h.snap(); set(s => ({ frames: editFrame(s, f => ({ ...f, scene: id })) })); },
    setBg: color => { h.snap(); set(s => ({ frames: editFrame(s, f => ({ ...f, bg: color })) })); },

    selectFrame: i => set({ fi: i, sel: null, extra: [] }),
    addFrame: () => {
      h.snap();
      set(s => {
        const cur = currentFrame(s);
        return { frames: [...s.frames, { id: newId(), bg: cur.bg, scene: cur.scene || 'none', note: '', items: [] }], fi: s.frames.length, sel: null, extra: [] };
      });
    },
    dupFrame: () => {
      h.snap();
      set(s => {
        const copy: Frame = structuredClone(currentFrame(s));
        copy.id = newId(); copy.items.forEach(i => { i.id = newId(); });
        const frames = [...s.frames]; frames.splice(s.fi + 1, 0, copy);
        return { frames, fi: s.fi + 1, sel: null, extra: [] };
      });
    },
    delFrame: () => {
      if (get().frames.length < 2) return;
      h.snap();
      set(s => ({ frames: s.frames.filter((_, i) => i !== s.fi), fi: Math.max(0, s.fi - 1), sel: null, extra: [] }));
    },

    moveFrame: (from, to) => {
      const n = get().frames.length;
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= n || to < 0 || to >= n || from === to) return;
      h.snap();
      set(s => {
        const currentId = currentFrame(s).id, frames = [...s.frames];
        frames.splice(to, 0, ...frames.splice(from, 1));
        return { frames, fi: frames.findIndex(f => f.id === currentId) };
      });
      get().showToast(`Frame moved to position ${to + 1}`);
    },

    loadProject: p => {
      h.snap();
      set({ frames: p.frames, fi: 0, sel: null, extra: [], name: p.name, aspect: p.aspect, view: DEFAULT_VIEW });
    },
    reset: () => {
      h.snap();
      set({ frames: seedFrames(), fi: 0, sel: null, extra: [], name: DEFAULT_NAME, aspect: '16:9' });
    }
  };
});

/** replaces the whole store with a fresh seeded state (tests) */
export const resetEditorStore = (): void => useEditor.setState({ ...initialState() });
