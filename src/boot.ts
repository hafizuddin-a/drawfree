import type { StoreApi } from 'zustand';
import { loadSaved, startAutosave } from './state/persist';
import type { EditorState } from './state/store';

/** Restores the last session (validated) into the store, then starts autosaving. Safe when storage is blocked. */
export function boot(store: StoreApi<EditorState>): ReturnType<typeof startAutosave> {
  const saved = loadSaved();
  if (saved) store.setState({ frames: saved.frames, fi: saved.fi, name: saved.name, aspect: saved.aspect });
  return startAutosave(store);
}
