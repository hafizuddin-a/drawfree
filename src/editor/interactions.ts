/* Pointer dragging: move, scale, rotate and joint (IK) dragging.
   The stage re-renders on every change, so the drag session lives in a ref and the move and up listeners sit on window,
   never on elements. snap() runs once, after the pointer has actually moved, so a click never creates an undo step. */
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { LIMBS } from '../rig/geometry';
import { ik } from '../rig/ik';
import { RAD } from '../rig/geometry';
import { currentFrame, selectedItem, useEditor } from '../state/store';

type Drag =
  | { k: 'move'; id: string; dx: number; dy: number; x0: number; y0: number; snapped: boolean }
  | { k: 'joint'; id: string; limb: 'aL' | 'aR' | 'lL' | 'lR'; snapped: boolean }
  | { k: 'rotate'; id: string; cx: number; cy: number; a0: number; r0: number; snapped: boolean }
  | { k: 'scale'; id: string; cx: number; cy: number; d0: number; s0: number; snapped: boolean };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const toLocal = (m: DOMMatrix | null, x: number, y: number) => (m ? new DOMPoint(x, y).matrixTransform(m.inverse()) : { x, y });
const findItem = (id: string) => currentFrame(useEditor.getState()).items.find(i => i.id === id);

export function useStageInteractions(stageRef: RefObject<SVGSVGElement | null>) {
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current, stage = stageRef.current;
      if (!d || !stage) return;
      const it = findItem(d.id);
      if (!it) { drag.current = null; return; }
      if (!d.snapped) {
        if (d.k === 'move' && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 3) return;
        useEditor.getState().snap(); d.snapped = true;
      }
      const st = useEditor.getState();
      if (d.k === 'move') {
        const p = toLocal(stage.getScreenCTM(), e.clientX, e.clientY);
        st.patchItem(d.id, { x: clamp(p.x + d.dx, -40, 1000), y: clamp(p.y + d.dy, -40, 700) });
      } else if (d.k === 'joint' && it.kind === 'char') {
        // inverse of the body's screen matrix: the joint lands on the pointer after flip, rotation and scale
        const body = stage.querySelector<SVGGElement>(`.item[data-id="${it.id}"] .body`);
        if (!body) return;
        const pt = toLocal(body.getScreenCTM(), e.clientX, e.clientY), [o, l1, l2] = LIMBS[d.limb];
        st.setLimb(it.id, d.limb, ik(o, l1, l2, [pt.x, pt.y], it.pose[d.limb][2]));
      } else if (d.k === 'rotate') {
        let r = d.r0 + (Math.atan2(e.clientX - d.cx, -(e.clientY - d.cy)) - d.a0) / RAD;
        if (e.shiftKey) r = Math.round(r / 15) * 15;
        r = Math.round((((r + 540) % 360) - 180) * 10) / 10;
        if (Math.abs(r) < 3) r = 0;                      // snaps to upright when close
        st.patchItem(d.id, { r });
      } else if (d.k === 'scale') {
        st.patchItem(d.id, { s: clamp(d.s0 * Math.hypot(e.clientX - d.cx, e.clientY - d.cy) / d.d0, 0.3, 3) });
      }
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, [stageRef]);

  /** pointer down on the stage: select, flip a bend, or start a move or joint drag */
  const onStagePointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const stage = stageRef.current, t = e.target as Element, el = t.closest?.('.item');
    const st = useEditor.getState();
    if (!el || !stage) { if (st.sel) st.select(null); return; }
    const it = findItem(el.getAttribute('data-id') ?? '');
    if (!it) return;
    e.preventDefault();
    const limb = t.getAttribute('data-limb') as 'aL' | 'aR' | 'lL' | 'lR' | null;
    if (limb && t.classList.contains('bh')) { st.flipBend(it.id, limb); return; }   // elbow or knee dot: flip the bend
    if (limb && t.classList.contains('jh')) { drag.current = { k: 'joint', id: it.id, limb, snapped: false }; return; }
    st.select(it.id);
    const p = toLocal(stage.getScreenCTM(), e.clientX, e.clientY);
    drag.current = { k: 'move', id: it.id, dx: it.x - p.x, dy: it.y - p.y, x0: e.clientX, y0: e.clientY, snapped: false };
  }, [stageRef]);

  /** pointer down on a selection-box corner (scale) or the round handle (rotate) */
  const onHandleDown = useCallback((e: ReactPointerEvent<HTMLElement>, kind: 'rotate' | 'scale') => {
    const stage = stageRef.current, it = selectedItem(useEditor.getState());
    const m = stage?.getScreenCTM();
    if (!stage || !it || !m) return;
    e.preventDefault(); e.stopPropagation();
    const o = new DOMPoint(it.x, it.y).matrixTransform(m);
    drag.current = kind === 'rotate'
      ? { k: 'rotate', id: it.id, cx: o.x, cy: o.y, a0: Math.atan2(e.clientX - o.x, -(e.clientY - o.y)), r0: it.r || 0, snapped: false }
      : { k: 'scale', id: it.id, cx: o.x, cy: o.y, d0: Math.hypot(e.clientX - o.x, e.clientY - o.y) || 1, s0: it.s, snapped: false };
  }, [stageRef]);

  return { onStagePointerDown, onHandleDown };
}
