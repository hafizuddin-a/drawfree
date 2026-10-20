/* Save, open and copy: the parts of file IO that touch the store and the browser. */
import { currentFrame, useEditor } from '../state/store';
import { MAX_FILE_BYTES, ProjectError, parseProject, projectFileName, toProject } from './project';
import { downloadBlob, readText } from './download';
import { frameToSVG } from './svg';

export function saveProject(): void {
  const s = useEditor.getState();
  downloadBlob(new Blob([JSON.stringify(toProject(s), null, 2)], { type: 'application/json' }), projectFileName(s.name));
  s.showToast('Project saved');
}

/** Opens a project file. One undo step brings the previous frames back. */
export async function openProjectFile(file: File | undefined): Promise<void> {
  if (!file) return;
  const st = useEditor.getState();
  if (file.size > MAX_FILE_BYTES) { st.showToast('That file is too large to be a Drawfree project.', 4000); return; }
  try {
    const r = parseProject(await readText(file));
    st.loadProject(r.state);
    const odd = r.fixed + r.dropped, name = r.state.name;
    st.showToast(odd ? `Opened “${name}”. ${odd} unknown ${odd === 1 ? 'value was' : 'values were'} replaced.` : `Opened “${name}”. Undo goes back.`, 4000);
  } catch (e) {
    st.showToast(e instanceof ProjectError ? e.message : 'Could not open that file.', 4000);
  }
}

/** Copies the current frame as SVG. If the browser blocks the clipboard, `fallback` gets the text to show for manual copying. */
export function copyFrameSvg(transparent: boolean, fallback: (svg: string) => void): void {
  const svg = frameToSVG(currentFrame(useEditor.getState()), { transparent });
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(svg).then(() => useEditor.getState().showToast('SVG copied'), () => fallback(svg));
  else fallback(svg);
}
