import { useRef } from 'react';
import { Overlay } from './Overlay';
import { Stage } from './Stage';
import { useStageInteractions } from './interactions';
import styles from './Editor.module.css';

/** The stage with its selection overlay. */
export function Editor() {
  const stageRef = useRef<SVGSVGElement>(null), boardRef = useRef<HTMLDivElement>(null);
  const { onStagePointerDown, onHandleDown } = useStageInteractions(stageRef);
  return (
    <main className={styles.stagecell}>
      <div ref={boardRef} className={styles.board}>
        <Stage ref={stageRef} onPointerDown={onStagePointerDown} />
        <Overlay stageRef={stageRef} boardRef={boardRef} onHandleDown={onHandleDown} />
      </div>
    </main>
  );
}
