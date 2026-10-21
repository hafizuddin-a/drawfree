import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Frame } from '../types';
import { itemSVG } from '../rig/renderCharacter';
import { frameBG } from '../scenes/scenes';
import { currentFrame, useEditor } from '../state/store';
import { Button } from './Button';
import { Icon } from './icons';
import { svgImgSrc } from './markup';
import styles from './FrameStrip.module.css';

/** the frame's art for a thumbnail: background, scene and items, without any editor chrome */
const frameArt = (f: Frame): string => frameBG(f) + f.items.map(itemSVG).join('');

interface ButtonProps {
  frame: Frame;
  index: number;
  on: boolean;
  /** 'before' or 'after' while this frame is the drop target of a reorder */
  drop: 'before' | 'after' | null;
  dragging: boolean;
  /** the Open Peeps art counter from the store */
  art: number;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>, index: number) => void;
  onClick: (index: number) => void;
  onMove: (from: number, to: number) => void;
}

const FrameButton = memo(function FrameButton({ frame, index, on, drop, dragging, art, onPointerDown, onClick, onMove }: ButtonProps) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `art` bumps when the Open Peeps body art arrives, so the thumbnail redraws with it
  const src = useMemo(() => svgImgSrc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">${frameArt(frame)}</svg>`), [frame, art]);
  const cls = [styles.fr, on ? styles.on : '', dragging ? styles.dragging : '', drop === 'before' ? styles.before : '', drop === 'after' ? styles.after : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} data-frame-id={frame.id} aria-label={`Frame ${index + 1}`} aria-current={on ? 'true' : undefined}
      title="Drag to reorder, or press Alt and an arrow key"
      onPointerDown={e => onPointerDown(e, index)} onClick={() => onClick(index)}
      onKeyDown={e => {
        if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        onMove(index, index + (e.key === 'ArrowLeft' ? -1 : 1));
      }}>
      <img src={src} alt="" draggable={false} />
      <span aria-hidden="true">{index + 1}</span>
    </button>
  );
});

interface Reorder { from: number; over: number }

export function FrameStrip() {
  const live = useEditor(s => s.frames), fi = useEditor(s => s.fi), note = useEditor(s => currentFrame(s).note), currentId = useEditor(s => currentFrame(s).id);
  // The order and the current-frame ring follow the live list at once. Only the thumbnail pictures lag (deferred), so a drag
  // of a character does not redraw them on every pointer move. A frame added a moment ago is shown at once, with its live art.
  const deferred = useDeferredValue(live);
  const art = new Map(deferred.map(f => [f.id, f]));
  const peepArt = useEditor(s => s.art);
  const { setNote, addFrame, dupFrame, delFrame, moveFrame, selectFrame } = useEditor.getState();
  const list = useRef<HTMLDivElement>(null);
  // the drag session lives in a ref with window listeners, like the stage's. Only what is drawn goes in state.
  const session = useRef<{ from: number; x0: number; started: boolean; over: number } | null>(null);
  const justDragged = useRef(false);
  const [reorder, setReorder] = useState<Reorder | null>(null);
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    /** the index a frame dropped at pointer x would take */
    const slotAt = (x: number): number => {
      const els = [...(list.current?.querySelectorAll<HTMLElement>('[data-frame-id]') ?? [])];
      const i = els.findIndex(el => { const r = el.getBoundingClientRect(); return x < r.left + r.width / 2; });
      return i < 0 ? els.length - 1 : i;
    };
    const onMove = (e: PointerEvent) => {
      const s = session.current;
      if (!s) return;
      if (!s.started) { if (Math.abs(e.clientX - s.x0) < 6) return; s.started = true; }
      const box = list.current?.getBoundingClientRect();
      if (box && list.current) {                                   // scroll the strip when the pointer nears its edge
        if (e.clientX < box.left + 36) list.current.scrollLeft -= 14;
        else if (e.clientX > box.right - 36) list.current.scrollLeft += 14;
      }
      const over = slotAt(e.clientX);
      if (over !== s.over || !s.started) s.over = over;
      setReorder(r => (r && r.from === s.from && r.over === over ? r : { from: s.from, over }));
    };
    const onUp = () => {
      const s = session.current;
      session.current = null;
      if (!s) return;
      setReorder(null);
      if (!s.started) return;
      justDragged.current = true;                                  // the click that follows a drag must not select
      setTimeout(() => { justDragged.current = false; });
      if (s.over !== s.from) { refocus.current = useEditor.getState().frames[s.from]?.id ?? null; moveFrame(s.from, s.over); }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, [moveFrame]);

  // keep keyboard focus on a frame that was just moved: runs after every render and does nothing unless a move asked for it
  useEffect(() => {
    if (!refocus.current) return;
    list.current?.querySelector<HTMLElement>(`[data-frame-id="${refocus.current}"]`)?.focus();
    refocus.current = null;
  });

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    // touch drags scroll the strip; touch users reorder with the buttons
    if (e.pointerType === 'touch' || (e.button !== undefined && e.button > 0) || live.length < 2) return;
    session.current = { from: index, x0: e.clientX, started: false, over: index };
  };
  const onClick = (index: number) => { if (!justDragged.current) selectFrame(index); };
  const onMoveKey = (from: number, to: number) => { refocus.current = useEditor.getState().frames[from]?.id ?? null; moveFrame(from, to); };

  return (
    <section className={styles.strip} aria-label="Frames">
      <div className={styles.head}>
        <input className={styles.note} type="text" placeholder="Scene note: action or dialogue for this frame" aria-label="Scene note" autoComplete="off"
          value={note} onChange={e => setNote(e.target.value)} />
        <fieldset className={styles.move} aria-label="Move frame">
          <Button aria-label="Move frame earlier" title="Move frame earlier" disabled={fi === 0} onClick={() => moveFrame(fi, fi - 1)}><Icon name="left" className={styles.ico} /></Button>
          <Button aria-label="Move frame later" title="Move frame later" disabled={fi >= live.length - 1} onClick={() => moveFrame(fi, fi + 1)}><Icon name="right" className={styles.ico} /></Button>
        </fieldset>
        <Button onClick={dupFrame}>Duplicate</Button>
        <Button onClick={delFrame} disabled={live.length < 2}>Delete</Button>
      </div>
      <div ref={list} className={`${styles.frames} ${reorder ? styles.reordering : ''}`}>
        {live.map((f, i) => {
          const drop = reorder && i === reorder.over && reorder.over !== reorder.from ? (reorder.over < reorder.from ? 'before' : 'after') : null;
          return <FrameButton key={f.id} frame={art.get(f.id) ?? f} art={peepArt} index={i} on={f.id === currentId} drop={drop} dragging={reorder?.from === i}
            onPointerDown={onPointerDown} onClick={onClick} onMove={onMoveKey} />;
        })}
        <button type="button" className={`${styles.fr} ${styles.add}`} aria-label="Add frame" title="Add frame" onClick={addFrame}>+</button>
      </div>
    </section>
  );
}
