import { type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useLayoutEffect, useState } from 'react';
import { selectedItem, useEditor } from '../state/store';
import { type SelBox, boxFromCorners, handleSide } from './box';
import { f1 } from '../parts/draw';
import { Icon } from '../ui/icons';
import { Toolbar } from '../ui/Toolbar';
import styles from './Editor.module.css';

/** The selection box turns with the item. It is measured from the rendered .body group: its local bounding box, with the four corners
 *  mapped through the group's screen matrix (which includes flip, rotation, scale and the view). See box.ts. */
interface Measured extends SelBox { bw: number; bh: number }
const same = (a: Measured | null, b: Measured | null) => a === b || (!!a && !!b && (Object.keys(a) as Array<keyof Measured>).every(k => a[k] === b[k]));
const PAD = 6;

interface Props {
  stageRef: RefObject<SVGSVGElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  onHandleDown: (e: ReactPointerEvent<HTMLElement>, kind: 'rotate' | 'scale') => void;
}

export function Overlay({ stageRef, boardRef, onHandleDown }: Props) {
  useEditor(s => s.view);   // re-measure when the view moves
  useEditor(s => s.art);    // and when the Open Peeps body art arrives (the figure grows)
  const it = useEditor(selectedItem), pose = useEditor(s => s.pose), resetRotation = useEditor(s => s.resetRotation);
  const extra = useEditor(s => s.extra), marquee = useEditor(s => s.marquee);
  const group = extra.length > 0;
  const [box, setBox] = useState<Measured | null>(null);

  const measure = useCallback(() => {
    // several items selected: one upright box around all of them (their figures, not their shadows)
    if (it && extra.length && stageRef.current && boardRef.current) {
      const b = boardRef.current.getBoundingClientRect();
      const rects = [it.id, ...extra].map(id => stageRef.current?.querySelector(`.item[data-id="${id}"] .figure`)?.getBoundingClientRect()).filter((r): r is DOMRect => !!r);
      if (!rects.length) { setBox(prev => (prev === null ? prev : null)); return; }
      const l = Math.min(...rects.map(r => r.left)) - b.left, t = Math.min(...rects.map(r => r.top)) - b.top;
      const r = Math.max(...rects.map(q => q.right)) - b.left, bt = Math.max(...rects.map(q => q.bottom)) - b.top;
      const next: Measured = { ...boxFromCorners([{ x: l, y: t }, { x: r, y: t }, { x: r, y: bt }, { x: l, y: bt }], PAD), bw: b.width, bh: b.height };
      setBox(prev => (same(prev, next) ? prev : next));
      return;
    }
    const g = it && stageRef.current?.querySelector<SVGGElement>(`.item[data-id="${it.id}"] .body`);
    const board = boardRef.current, m = g?.getScreenCTM();
    if (!g || !board || !m) { setBox(b => (b === null ? b : null)); return; }
    // the figure and the pose handles, not the ground shadow (which is wider than the character and vanishes past 8 degrees of turn)
    const parts = [...g.querySelectorAll<SVGGraphicsElement>(':scope > .figure, :scope > .handles')];
    const boxes = (parts.length ? parts : [g]).map(p => p.getBBox());
    const x0 = Math.min(...boxes.map(q => q.x)), y0 = Math.min(...boxes.map(q => q.y));
    const bb = { x: x0, y: y0, width: Math.max(...boxes.map(q => q.x + q.width)) - x0, height: Math.max(...boxes.map(q => q.y + q.height)) - y0 };
    const b = board.getBoundingClientRect();
    const corner = (x: number, y: number) => { const p = new DOMPoint(x, y).matrixTransform(m); return { x: p.x - b.left, y: p.y - b.top }; };
    const next: Measured = {
      ...boxFromCorners([corner(bb.x, bb.y), corner(bb.x + bb.width, bb.y), corner(bb.x + bb.width, bb.y + bb.height), corner(bb.x, bb.y + bb.height)], PAD),
      bw: b.width, bh: b.height
    };
    setBox(prev => (same(prev, next) ? prev : next));
  }, [it, extra, stageRef, boardRef]);

  // after every render, so the box follows drags, scaling and pose changes. setBox ignores unchanged boxes, so this cannot loop.
  useLayoutEffect(() => { measure(); });
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(board);
    return () => ro.disconnect();
  }, [boardRef, measure]);

  const mq = marquee && boardRef.current ? (() => {
    const b = boardRef.current.getBoundingClientRect();
    return <div className={styles.marquee} style={{ left: Math.min(marquee.x0, marquee.x1) - b.left, top: Math.min(marquee.y0, marquee.y1) - b.top, width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }} />;
  })() : null;
  if (!it || !box) return <div className={styles.overlay}>{mq}</div>;
  // the toolbar sits beside the axis-aligned bounds of the turned box
  const { ax: x, ay: y, aw: w } = box;
  let tx = x + w + 12;
  if (tx + 56 > box.bw) tx = Math.max(4, x - 68);
  const ty = Math.max(4, Math.min(y, box.bh - 240));
  // the round rotate handle rides on the box: above it (in the box's own turned frame), else below, else beside it
  const side = handleSide(box, box.bw, box.bh);
  const handle: CSSProperties = { above: { left: '50%', top: -40 }, below: { left: '50%', top: 'calc(100% + 40px)' }, right: { left: 'calc(100% + 40px)', top: '50%' }, left: { left: -40, top: '50%' } }[side];
  const line: CSSProperties | null = side === 'above' ? { left: '50%', top: -28 } : side === 'below' ? { left: '50%', top: '100%' } : null;
  return (
    <div className={styles.overlay}>
      {mq}
      <div className={`${styles.selbox} ${group ? styles.group : ''}`} style={{ left: f1(box.cx - box.w / 2), top: f1(box.cy - box.h / 2), width: f1(box.w), height: f1(box.h), transform: `rotate(${box.angle}deg)` }}>
        {/* in Pose mode the corners would sit on top of raised hands, so scaling waits until Pose is turned off */}
        {!pose && !group && (['nw', 'ne', 'sw', 'se'] as const).map(c => (
          <i key={c} role="presentation" className={styles.corner} data-c={c} style={{ top: c[0] === 'n' ? '0' : '100%', left: c[1] === 'w' ? '0' : '100%' }}
            onPointerDown={e => onHandleDown(e, 'scale')} />
        ))}
        {!group && line && <i className={styles.rotline} style={line} />}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer-only drag handle. The keyboard route is [ and ] (and double-click or the toolbar to reset). */}
        {!group && <i role="presentation" className={styles.rot} style={handle} title="Rotate. Shift snaps to 15°, double-click resets. Keys: [ and ]"
          onPointerDown={e => onHandleDown(e, 'rotate')} onDoubleClick={resetRotation}>
          <Icon name="rotate" />
        </i>}
      </div>
      <Toolbar item={it} count={1 + extra.length} left={f1(tx)} top={f1(ty)} />
    </div>
  );
}
