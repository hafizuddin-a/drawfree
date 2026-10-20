/* Autosave to localStorage (key drawfree.v1): debounced 500 ms, flushed when the tab hides, never throws. */
import type { StoreApi } from 'zustand';
import type { Aspect, Frame } from '../types';
import { DEFAULT_NAME, cleanAspect, cleanFrames, cleanName, fromLegacyFrames, parseProjectObject, toProject } from '../export/project';
import type { EditorState } from './store';

export const KEY = 'drawfree.v1', OLD_KEY = 'inkframe.v1';
export interface Saved { name: string; aspect: Aspect; frames: Frame[]; fi: number }

/** Stored data is untrusted. A versioned object is a project plus `fi`; anything else is the original vanilla version's shape. */
export function loadSaved(): Saved | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    const fi = typeof d.fi === 'number' ? Math.max(0, d.fi | 0) : 0;
    if (typeof d.version === 'number') {
      const p = parseProjectObject(d);
      return { ...p.state, fi: Math.min(fi, p.state.frames.length - 1) };
    }
    const r = cleanFrames(fromLegacyFrames(d.frames));
    if (!r.frames.length) return null;
    return { name: cleanName(d.name ?? DEFAULT_NAME), aspect: cleanAspect(d.aspect), frames: r.frames, fi: Math.min(fi, r.frames.length - 1) };
  } catch {
    return null;
  }
}

/** Returns a controller: flush() writes pending changes now, stop() unsubscribes. */
export function startAutosave(store: StoreApi<EditorState>): { flush: () => void; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined, warned = false;
  const write = () => {
    clearTimeout(timer); timer = undefined;
    const s = store.getState();
    try { localStorage.setItem(KEY, JSON.stringify({ ...toProject(s), fi: s.fi })); }
    catch {
      if (!warned) { warned = true; s.showToast('Autosave is unavailable in this browser. Use Save to keep your work.', 5000); }
    }
  };
  const unsub = store.subscribe((s, p) => {
    if (s.frames === p.frames && s.fi === p.fi && s.name === p.name && s.aspect === p.aspect) return;
    clearTimeout(timer); timer = setTimeout(write, 500);
  });
  const flush = () => { if (timer !== undefined) write(); };
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onHide);
  const stop = () => {
    unsub(); clearTimeout(timer);
    window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide);
  };
  return { flush, stop };
}
