import { memo, useDeferredValue, useMemo } from 'react';
import type { Frame } from '../types';
import { itemSVG } from '../rig/renderCharacter';
import { frameBG } from '../scenes/scenes';
import { currentFrame, useEditor } from '../state/store';
import { Button } from './Button';
import styles from './FrameStrip.module.css';

/** the frame's art for a thumbnail: background, scene and items, without any editor chrome */
const frameArt = (f: Frame): string => frameBG(f) + f.items.map(itemSVG).join('');

const FrameButton = memo(function FrameButton({ frame, index, on }: { frame: Frame; index: number; on: boolean }) {
  const html = useMemo(() => `<svg viewBox="0 0 960 540" aria-hidden="true">${frameArt(frame)}</svg>`, [frame]);
  const selectFrame = useEditor(s => s.selectFrame);
  return (
    <button type="button" className={`${styles.fr} ${on ? styles.on : ''}`} aria-label={`Frame ${index + 1}`} aria-current={on ? 'true' : undefined}
      onClick={() => selectFrame(index)}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <span aria-hidden="true">{index + 1}</span>
    </button>
  );
});

export function FrameStrip() {
  const live = useEditor(s => s.frames), fi = useEditor(s => s.fi), note = useEditor(s => currentFrame(s).note);
  // thumbnails catch up when a drag settles instead of re-drawing on every pointer move
  const frames = useDeferredValue(live);
  const { setNote, addFrame, dupFrame, delFrame } = useEditor.getState();
  return (
    <section className={styles.strip} aria-label="Frames">
      <div className={styles.head}>
        <input className={styles.note} type="text" placeholder="Scene note: action or dialogue for this frame" aria-label="Scene note" autoComplete="off"
          value={note} onChange={e => setNote(e.target.value)} />
        <Button onClick={dupFrame}>Duplicate</Button>
        <Button onClick={delFrame} disabled={live.length < 2}>Delete</Button>
      </div>
      <div className={styles.frames}>
        {frames.map((f, i) => <FrameButton key={f.id} frame={f} index={i} on={i === fi} />)}
        <button type="button" className={`${styles.fr} ${styles.add}`} aria-label="Add frame" title="Add frame" onClick={addFrame}>+</button>
      </div>
    </section>
  );
}
