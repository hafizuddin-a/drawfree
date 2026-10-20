import { useRef, useState } from 'react';
import { currentFrame, useEditor } from '../state/store';
import { buildFrameExport, type ExportFormat, type ExportOptions } from '../export/frame';
import { downloadBlob } from '../export/download';
import { loadExportPrefs, saveExportPrefs } from '../export/prefs';
import { copyFrameSvg } from '../export/io';
import { Button } from './Button';
import { Dialog, dialogActions } from './Dialog';
import styles from './ExportDialog.module.css';

interface Props { onClose: () => void; onCopyFallback: (svg: string) => void }

const SIZES: ReadonlyArray<[1 | 2 | 3, string]> = [[1, '960 × 540'], [2, '1920 × 1080'], [3, '2880 × 1620']];

export function ExportDialog({ onClose, onCopyFallback }: Props) {
  const [o, setO] = useState<ExportOptions>(loadExportPrefs);
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const go = useRef<HTMLButtonElement>(null);
  const fi = useEditor(s => s.fi);
  const change = (patch: Partial<ExportOptions>) => { const n = { ...o, ...patch }; setO(n); saveExportPrefs(n); };

  const run = async () => {
    const s = useEditor.getState();
    setBusy(true); setStatus('Preparing…');
    try {
      const { blob, name } = await buildFrameExport(currentFrame(s), s.fi + 1, s.name, o);
      downloadBlob(blob, name);
      onClose();
      s.showToast('Downloaded ' + name);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Export failed.');
      setBusy(false);
    }
  };

  return (
    <Dialog onClose={onClose} labelledBy="ex-title" narrow initialFocus={go}>
      <strong id="ex-title" className={styles.title}>Export Frame {fi + 1}</strong>
      <fieldset className={styles.opts}>
        <legend>Format</legend>
        {(['png', 'svg'] as ExportFormat[]).map(f => (
          <label key={f}><input type="radio" name="ex-fmt" value={f} checked={o.fmt === f} onChange={() => change({ fmt: f })} /> {f.toUpperCase()}</label>
        ))}
      </fieldset>
      <fieldset className={styles.opts} disabled={o.fmt !== 'png'}>
        <legend>PNG size</legend>
        {SIZES.map(([k, label]) => (
          <label key={k}><input type="radio" name="ex-scale" value={k} checked={o.scale === k} onChange={() => change({ scale: k })} /> {k}x <small>{label}</small></label>
        ))}
      </fieldset>
      <label className={styles.check}><input type="checkbox" checked={o.transparent} onChange={e => change({ transparent: e.target.checked })} /> Transparent background</label>
      <p className={styles.status} role="status">{status}</p>
      <div className={dialogActions}>
        {o.fmt === 'svg' && <Button onClick={() => { onClose(); copyFrameSvg(o.transparent, onCopyFallback); }}>Copy SVG</Button>}
        <Button onClick={onClose}>Close</Button>
        <Button primary ref={go} disabled={busy} onClick={run}>Download {o.fmt.toUpperCase()}</Button>
      </div>
    </Dialog>
  );
}
