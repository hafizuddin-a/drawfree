import { MAX_ZOOM, MIN_ZOOM, zoomPercent } from './view';
import { useEditor } from '../state/store';
import styles from './Editor.module.css';

/** Zoom buttons for people without a wheel, a trackpad or a keyboard. The wheel (Ctrl or Cmd), a pinch, and the keys also zoom. */
export function ZoomControls() {
  const view = useEditor(s => s.view), { zoomBy, resetView } = useEditor.getState();
  return (
    <fieldset className={styles.zoom} aria-label="Zoom">
      <button type="button" aria-label="Zoom out" title="Zoom out (Ctrl or Cmd and the wheel, or the minus key)" disabled={view.zoom <= MIN_ZOOM} onClick={() => zoomBy(0.8)}>−</button>
      <button type="button" className={styles.zoomPct} aria-label={`Reset zoom, now ${zoomPercent(view)} percent`} title="Reset zoom (0)" disabled={view.zoom === 1} onClick={resetView}>{zoomPercent(view)}%</button>
      <button type="button" aria-label="Zoom in" title="Zoom in (Ctrl or Cmd and the wheel, a pinch, or the plus key)" disabled={view.zoom >= MAX_ZOOM} onClick={() => zoomBy(1.25)}>+</button>
    </fieldset>
  );
}
