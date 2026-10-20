/* Undo and redo as a stack of state snapshots. State is immutable, so a snapshot is just a reference to the frames array.
   Call snap() once before a mutation. For drags, call it only after the pointer has moved, so a click never makes an undo step. */
import type { StoreApi } from 'zustand';
import type { Frame } from '../types';
import type { EditorState } from './store';

interface Snapshot { frames: Frame[]; fi: number }
export interface HistorySlice {
  past: Snapshot[];
  future: Snapshot[];
  snap: () => void;
  undo: () => void;
  redo: () => void;
}
export const MAX_HISTORY = 80;

const take = (s: Snapshot): Snapshot => ({ frames: s.frames, fi: s.fi });
const stillThere = (frames: Frame[], fi: number, sel: string | null): string | null =>
  sel && frames[fi]?.items.some(i => i.id === sel) ? sel : null;

export function historyActions(set: StoreApi<EditorState>['setState'], get: StoreApi<EditorState>['getState']): Pick<HistorySlice, 'snap' | 'undo' | 'redo'> {
  const restore = (to: Snapshot, past: Snapshot[], future: Snapshot[]) => {
    const fi = Math.min(to.fi, to.frames.length - 1);
    set({ frames: to.frames, fi, past, future, sel: stillThere(to.frames, fi, get().sel) });
  };
  return {
    snap: () => {
      const s = get();
      set({ past: [...s.past, take(s)].slice(-MAX_HISTORY), future: [] });
    },
    undo: () => {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (prev) restore(prev, s.past.slice(0, -1), [...s.future, take(s)]);
    },
    redo: () => {
      const s = get();
      const next = s.future[s.future.length - 1];
      if (next) restore(next, [...s.past, take(s)], s.future.slice(0, -1));
    }
  };
}
