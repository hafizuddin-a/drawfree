import { useEffect, useRef } from 'react';
import { Overlay } from './Overlay';
import { Stage } from './Stage';
import { ZoomControls } from './ZoomControls';
import { useEditor } from '../state/store';
import { useStageInteractions } from './interactions';
import styles from './Editor.module.css';

/** The stage with its selection overlay. */
export function Editor() {
  const stageRef = useRef<SVGSVGElement>(null), boardRef = useRef<HTMLDivElement>(null);
  const { onStagePointerDown, onHandleDown } = useStageInteractions(stageRef);

  // Ctrl/Cmd + wheel (and a trackpad pinch, which arrives the same way) zooms about the pointer. When zoomed in, the plain wheel pans.
  // Native listener, because React's wheel handlers are passive and cannot stop the page zooming.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const st = useEditor.getState(), m = el.getScreenCTM();
      if (!m) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        st.zoomBy(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.002)), { x: p.x, y: p.y });
      } else if (st.view.zoom > 1) {
        e.preventDefault();
        st.panBy(e.deltaX / m.a, e.deltaY / m.a);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  return (
    <main className={styles.stagecell}>
      <div ref={boardRef} className={styles.board}>
        <Stage ref={stageRef} onPointerDown={onStagePointerDown} />
        <ZoomControls />
        <Overlay stageRef={stageRef} boardRef={boardRef} onHandleDown={onHandleDown} />
      </div>
    </main>
  );
}
