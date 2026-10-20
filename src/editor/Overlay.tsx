import { useCallback, useLayoutEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { selectedItem, useEditor } from '../state/store';
import { f1 } from '../parts/draw';
import { Icon } from '../ui/icons';
import { Toolbar } from '../ui/Toolbar';
import styles from './Editor.module.css';

/** The selection box is measured from the rendered .body group, so it stays axis-aligned when a character is rotated. */
interface Box { x: number; y: number; w: number; h: number; bw: number; bh: number }
const same = (a: Box | null, b: Box | null) => (a === b) || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.bw === b.bw && a.bh === b.bh);

interface Props {
  stageRef: RefObject<SVGSVGElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  onHandleDown: (e: ReactPointerEvent<HTMLElement>, kind: 'rotate' | 'scale') => void;
}

export function Overlay({ stageRef, boardRef, onHandleDown }: Props) {
  const it = useEditor(selectedItem), pose = useEditor(s => s.pose), resetRotation = useEditor(s => s.resetRotation);
  const [box, setBox] = useState<Box | null>(null);

  const measure = useCallback(() => {
    const g = it && stageRef.current?.querySelector(`.item[data-id="${it.id}"] .body`);
    const board = boardRef.current;
    if (!g || !board) { setBox(b => (b === null ? b : null)); return; }
    const r = g.getBoundingClientRect(), b = board.getBoundingClientRect();
    const next = { x: r.left - b.left - 6, y: r.top - b.top - 6, w: r.width + 12, h: r.height + 12, bw: b.width, bh: b.height };
    setBox(prev => (same(prev, next) ? prev : next));
  }, [it, stageRef, boardRef]);

  // after every render, so the box follows drags, scaling and pose changes. setBox ignores unchanged boxes, so this cannot loop.
  useLayoutEffect(() => { measure(); });
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(board);
    return () => ro.disconnect();
  }, [boardRef, measure]);

  if (!it || !box) return <div className={styles.overlay} />;
  const { x, y, w, h } = box;
  let tx = x + w + 12;
  if (tx + 56 > box.bw) tx = Math.max(4, x - 68);
  const ty = Math.max(4, Math.min(y, box.bh - 240));
  const above = y > 52, rtop = above ? y - 40 : y + h + 40, ltop = above ? y - 28 : y + h;
  return (
    <div className={styles.overlay}>
      <div className={styles.selbox} style={{ left: f1(x), top: f1(y), width: f1(w), height: f1(h) }}>
        {/* in Pose mode the corners would sit on top of raised hands, so scaling waits until Pose is turned off */}
        {!pose && (['nw', 'ne', 'sw', 'se'] as const).map(c => (
          <i key={c} role="presentation" className={styles.corner} data-c={c} style={{ top: c[0] === 'n' ? '0' : '100%', left: c[1] === 'w' ? '0' : '100%' }}
            onPointerDown={e => onHandleDown(e, 'scale')} />
        ))}
      </div>
      <i className={styles.rotline} style={{ left: f1(x + w / 2 - 1), top: f1(ltop) }} />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer-only drag handle. The keyboard route is [ and ] (and double-click or the toolbar to reset). */}
      <i role="presentation" className={styles.rot} style={{ left: f1(x + w / 2), top: f1(rtop) }} title="Rotate. Shift snaps to 15°, double-click resets. Keys: [ and ]"
        onPointerDown={e => onHandleDown(e, 'rotate')} onDoubleClick={resetRotation}>
        <Icon name="rotate" />
      </i>
      <Toolbar item={it} left={f1(tx)} top={f1(ty)} />
    </div>
  );
}
