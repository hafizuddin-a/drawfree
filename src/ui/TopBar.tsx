import { currentFrame, useEditor } from '../state/store';
import { BGS } from '../scenes/backgrounds';
import { cleanName } from '../export/project';
import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Icon } from './icons';
import styles from './TopBar.module.css';

interface Props { onOpen: () => void; onSave: () => void; onExport: () => void }

export function TopBar({ onOpen, onSave, onExport }: Props) {
  const name = useEditor(s => s.name), setName = useEditor(s => s.setName), bg = useEditor(s => currentFrame(s).bg);
  const canUndo = useEditor(s => s.past.length > 0), canRedo = useEditor(s => s.future.length > 0);
  const { setBg, addChar, shuffle, undo, redo, reset } = useEditor.getState();
  // the field shows what is typed (even empty) while focused, and the cleaned name otherwise
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => { setDraft(d => (d !== null && cleanName(d) !== name ? null : d)); }, [name]);
  return (
    <header className={styles.top}>
      <div className={styles.brand}><Icon name="brand" />Drawfree</div>
      <input className={styles.pname} type="text" maxLength={80} placeholder="Untitled storyboard" aria-label="Project name" autoComplete="off"
        value={draft ?? name} onChange={e => { setDraft(e.target.value); setName(e.target.value); }} onBlur={() => setDraft(null)}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <div className={styles.bgs} role="group" aria-label="Frame background">
        {BGS.map(c => (
          <button key={c} type="button" className={bg === c ? styles.on : ''} style={{ background: c }} aria-label={`Background ${c}`} aria-pressed={bg === c} title="Background" onClick={() => setBg(c)} />
        ))}
      </div>
      <div className={styles.group}>
        <Button onClick={addChar}>+ Character</Button>
        <Button onClick={shuffle}>Shuffle look</Button>
      </div>
      <div className={styles.group}>
        <Button aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={undo}><Icon name="undo" className={styles.ico} /></Button>
        <Button aria-label="Redo" title="Redo (Shift+Ctrl/Cmd+Z)" disabled={!canRedo} onClick={redo}><Icon name="redo" className={styles.ico} /></Button>
        <Button onClick={reset}>Reset</Button>
      </div>
      <div className={styles.group}>
        <Button onClick={onOpen} title="Open a .drawfree.json project (Ctrl/Cmd+O)">Open</Button>
        <Button onClick={onSave} title="Save the project as a file (Ctrl/Cmd+S)">Save</Button>
        <Button primary onClick={onExport} title="Download this frame as PNG or SVG">Export</Button>
      </div>
    </header>
  );
}
