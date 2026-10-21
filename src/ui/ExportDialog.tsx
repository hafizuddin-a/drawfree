import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Cancelled } from '../export/board';
import { downloadBlob } from '../export/download';
import { buildBoardExport, buildFrameExport, type ExportFormat } from '../export/frame';
import { copyFrameSvg } from '../export/io';
import type { PdfLayout } from '../export/layout';
import { type ExportPrefs, type Scope, loadExportPrefs, saveExportPrefs } from '../export/prefs';
import { currentFrame, useEditor } from '../state/store';
import { Button } from './Button';
import { Dialog, dialogActions } from './Dialog';
import styles from './ExportDialog.module.css';

interface Props { onClose: () => void; onCopyFallback: (svg: string) => void }

const SIZES: ReadonlyArray<[1 | 2 | 3, string]> = [[1, '960 × 540'], [2, '1920 × 1080'], [3, '2880 × 1620']];
const LAYOUTS: ReadonlyArray<[PdfLayout, string]> = [['one', 'One frame per page'], ['two', 'Contact sheet, 2 per row'], ['three', 'Contact sheet, 3 per row']];

function Radio<T extends string | number>({ name, value, current, label, small, onPick }: { name: string; value: T; current: T; label: string; small?: string; onPick: (v: T) => void }) {
  return <label><input type="radio" name={name} value={String(value)} checked={current === value} onChange={() => onPick(value)} /> {label}{small && <> <small>{small}</small></>}</label>;
}
const Row = ({ label, children }: { label: string; children: ReactNode }) => <div className={styles.row}><span>{label}</span>{children}</div>;

export function ExportDialog({ onClose, onCopyFallback }: Props) {
  const [prefs, setPrefs] = useState<ExportPrefs>(loadExportPrefs);
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const fi = useEditor(s => s.fi), count = useEditor(s => s.frames.length);
  const abort = useRef<AbortController | null>(null);
  // closing the dialog by any route (Cancel, Esc, the backdrop) unmounts it, which stops an export in progress
  useEffect(() => () => abort.current?.abort(), []);

  const set = (patch: Partial<ExportPrefs>) => { const n = { ...prefs, ...patch }; setPrefs(n); saveExportPrefs(n); };
  const setFrame = (patch: Partial<ExportPrefs['frame']>) => set({ frame: { ...prefs.frame, ...patch } });
  const setBoard = (patch: Partial<ExportPrefs['board']>) => set({ board: { ...prefs.board, ...patch } });
  const setStrip = (patch: Partial<ExportPrefs['board']['strip']>) => setBoard({ strip: { ...prefs.board.strip, ...patch } });
  const setPdf = (patch: Partial<ExportPrefs['board']['pdf']>) => setBoard({ pdf: { ...prefs.board.pdf, ...patch } });

  const run = async () => {
    const s = useEditor.getState();
    abort.current = new AbortController();
    setBusy(true); setStatus('Preparing…');
    try {
      if (prefs.scope === 'frame') {
        const { blob, name } = await buildFrameExport(currentFrame(s), s.fi + 1, s.name, prefs.frame);
        downloadBlob(blob, name); onClose(); s.showToast(`Downloaded ${name}`);
      } else {
        const r = await buildBoardExport(s.frames, s.name, prefs.board, (d, t) => setStatus(`Rendering frame ${d} of ${t}…`), abort.current.signal);
        downloadBlob(r.blob, r.name); onClose();
        s.showToast(r.notice ? `Downloaded ${r.name}. ${r.notice}` : `Downloaded ${r.name}`, r.notice ? 7000 : undefined);
      }
    } catch (e) {
      if (e instanceof Cancelled) return;
      setStatus(e instanceof Error ? e.message : 'Export failed.');
      setBusy(false);
    }
  };

  const f = prefs.frame, b = prefs.board;
  const label = prefs.scope === 'frame' ? `Download ${f.fmt.toUpperCase()}` : b.fmt === 'pdf' ? 'Download PDF' : 'Download PNG strip';
  return (
    <Dialog onClose={onClose} labelledBy="ex-title" narrow>
      <strong id="ex-title" className={styles.title}>Export</strong>
      <fieldset className={styles.opts} disabled={busy}>
        <legend>What to export</legend>
        <Radio<Scope> name="ex-scope" value="frame" current={prefs.scope} label="This frame" small={`Frame ${fi + 1}`} onPick={v => set({ scope: v })} />
        <Radio<Scope> name="ex-scope" value="board" current={prefs.scope} label="Whole board" small={`${count} frame${count === 1 ? '' : 's'}`} onPick={v => set({ scope: v })} />
      </fieldset>

      <fieldset className={styles.body} disabled={busy}>
        {prefs.scope === 'frame' ? (
          <>
            <fieldset className={styles.opts}>
              <legend>Format</legend>
              {(['png', 'svg'] as ExportFormat[]).map(v => <Radio key={v} name="ex-fmt" value={v} current={f.fmt} label={v.toUpperCase()} onPick={x => setFrame({ fmt: x })} />)}
            </fieldset>
            <fieldset className={styles.opts} disabled={f.fmt !== 'png'}>
              <legend>PNG size</legend>
              {SIZES.map(([k, text]) => <Radio key={k} name="ex-scale" value={k} current={f.scale} label={`${k}x`} small={text} onPick={x => setFrame({ scale: x })} />)}
            </fieldset>
            <label className={styles.check}><input type="checkbox" checked={f.transparent} onChange={e => setFrame({ transparent: e.target.checked })} /> Transparent background</label>
          </>
        ) : (
          <>
            <fieldset className={styles.opts}>
              <legend>Format</legend>
              <Radio name="ex-board-fmt" value="pdf" current={b.fmt} label="PDF" onPick={x => setBoard({ fmt: x })} />
              <Radio name="ex-board-fmt" value="png" current={b.fmt} label="PNG strip" onPick={x => setBoard({ fmt: x })} />
            </fieldset>
            {b.fmt === 'png' ? (
              <>
                <Row label="Frames per row">
                  <select aria-label="Frames per row" value={b.strip.cols} onChange={e => setStrip({ cols: Number(e.target.value) as 1 | 2 | 3 | 4 })}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Row>
                <Row label="Frame width">
                  <select aria-label="Frame width" value={b.strip.frameW} onChange={e => setStrip({ frameW: Number(e.target.value) as 480 | 720 | 960 })}>
                    <option value={480}>Small, 480 px</option><option value={720}>Medium, 720 px</option><option value={960}>Large, 960 px</option>
                  </select>
                </Row>
                <label className={styles.check}><input type="checkbox" checked={b.strip.notes} onChange={e => setStrip({ notes: e.target.checked })} /> Include notes</label>
              </>
            ) : (
              <>
                <fieldset className={styles.opts}>
                  <legend>Page size</legend>
                  <Radio name="ex-page" value="a4" current={b.pdf.size} label="A4" onPick={x => setPdf({ size: x })} />
                  <Radio name="ex-page" value="letter" current={b.pdf.size} label="Letter" onPick={x => setPdf({ size: x })} />
                </fieldset>
                <fieldset className={styles.opts}>
                  <legend>Orientation</legend>
                  <Radio name="ex-orient" value="landscape" current={b.pdf.orientation} label="Landscape" onPick={x => setPdf({ orientation: x })} />
                  <Radio name="ex-orient" value="portrait" current={b.pdf.orientation} label="Portrait" onPick={x => setPdf({ orientation: x })} />
                </fieldset>
                <Row label="Layout">
                  <select aria-label="Layout" value={b.pdf.layout} onChange={e => setPdf({ layout: e.target.value as PdfLayout })}>
                    {LAYOUTS.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                  </select>
                </Row>
                <label className={styles.check}><input type="checkbox" checked={b.pdf.notes} onChange={e => setPdf({ notes: e.target.checked })} /> Include notes</label>
              </>
            )}
          </>
        )}
      </fieldset>

      <p className={styles.status} role="status">{status}</p>
      <div className={dialogActions}>
        {prefs.scope === 'frame' && f.fmt === 'svg' && <Button onClick={() => { onClose(); void copyFrameSvg(f.transparent, onCopyFallback); }}>Copy SVG</Button>}
        <Button onClick={onClose}>{busy ? 'Cancel' : 'Close'}</Button>
        <Button primary data-autofocus disabled={busy} onClick={run}>{label}</Button>
      </div>
    </Dialog>
  );
}
