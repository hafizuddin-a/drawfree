import type { StoreApi } from 'zustand';
import { loadSaved, startAutosave } from './state/persist';
import { loadBodyArt } from './parts/bodies';
import type { EditorState } from './state/store';

/** Restores the last session (validated) into the store, then starts autosaving. Safe when storage is blocked. */
export function boot(store: StoreApi<EditorState>): ReturnType<typeof startAutosave> {
  const saved = loadSaved();
  if (saved) store.setState({ frames: saved.frames, fi: saved.fi, name: saved.name, aspect: saved.aspect });
  return startAutosave(store);
}

/** Fetches the Open Peeps body art (a separate chunk) and redraws once it is in. Offline, it says so; exports retry. */
export function loadArt(store: StoreApi<EditorState>): Promise<void> {
  return loadBodyArt().then(
    () => store.setState(s => ({ art: s.art + 1 })),
    () => store.getState().showToast('Could not load the Open Peeps bodies. Check your connection, then reload.', 6000)
  );
}
