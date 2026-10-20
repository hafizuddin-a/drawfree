import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from './editor/Editor';
import { useKeyboard } from './editor/useKeyboard';
import { openProjectFile, saveProject } from './export/io';
import { CopyDialog } from './ui/CopyDialog';
import { ExportDialog } from './ui/ExportDialog';
import { FrameStrip } from './ui/FrameStrip';
import { Picker } from './ui/Picker';
import { Toast } from './ui/Toast';
import { TopBar } from './ui/TopBar';
import styles from './App.module.css';

const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...(e.dataTransfer.types ?? [])].includes('Files');

export function App() {
  const [dialog, setDialog] = useState<'export' | null>(null), [copySvg, setCopySvg] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const openPicker = useCallback(() => file.current?.click(), []);
  useKeyboard({ save: saveProject, open: openPicker });

  // drag a .drawfree.json file anywhere onto the page to open it
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDropping(true); } };
    const leave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDropping(false); } };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; setDropping(false);
      void openProjectFile(e.dataTransfer?.files[0]);
    };
    window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over); window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  }, []);

  return (
    <>
      <div className={styles.app}>
        <TopBar onOpen={openPicker} onSave={saveProject} onExport={() => setDialog('export')} />
        <Picker />
        <Editor />
        <FrameStrip />
      </div>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={e => { void openProjectFile(e.target.files?.[0]); e.target.value = ''; }} />
      <Toast />
      {dropping && <div className={styles.dropnote} aria-hidden="true">Drop a .drawfree.json file to open it</div>}
      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} onCopyFallback={svg => setCopySvg(svg)} />}
      {copySvg !== null && <CopyDialog svg={copySvg} onClose={() => setCopySvg(null)} />}
    </>
  );
}
