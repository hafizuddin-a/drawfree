import { forwardRef, memo, useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import type { Character, Item } from '../types';
import { bodyTransform, itemArt, itemTransform } from '../rig/renderCharacter';
import { rig } from '../rig/poses';
import { f1 } from '../parts/draw';
import { frameBG } from '../scenes/scenes';
import { currentFrame, useEditor } from '../state/store';

/* Pose handles exist only in the editor. They are sized against the item's scale so they stay the same size on screen,
   and each has a larger invisible circle (the real hit target) so a finger never loses it. */
function PoseHandles({ c }: { c: Character }) {
  const r = rig(c), k = 1 / c.s;
  return (
    <>
      {(Object.keys(r) as Array<keyof typeof r>).map(l => {
        const [, elbow, end] = r[l];
        return (
          <g key={l}>
            <circle className="bh hitc" data-limb={l} cx={f1(elbow[0])} cy={f1(elbow[1])} r={f1(18 * k)}><title>Click to flip the bend</title></circle>
            <circle cx={f1(elbow[0])} cy={f1(elbow[1])} r={f1(6 * k)} style={{ fill: '#fff', stroke: 'var(--accent)', strokeWidth: f1(2.2 * k), pointerEvents: 'none' }} />
            <circle className="jh hitc" data-limb={l} cx={f1(end[0])} cy={f1(end[1])} r={f1(22 * k)}><title>Drag to move</title></circle>
            <circle cx={f1(end[0])} cy={f1(end[1])} r={f1(11 * k)} style={{ fill: 'var(--accent)', fillOpacity: 0.85, stroke: '#fff', strokeWidth: f1(2.5 * k), pointerEvents: 'none' }} />
          </g>
        );
      })}
    </>
  );
}

/** One item. Memoised on the item itself, so only the item being dragged re-renders. */
const ItemView = memo(function ItemView({ item, handles }: { item: Item; handles: boolean }) {
  const art = useMemo(() => itemArt(item), [item]);
  const isChar = item.kind === 'char';
  return (
    <g className="item" data-id={item.id} transform={itemTransform(item)}>
      <rect className="hit" x={-130} y={isChar ? -290 : -200} width={260} height={isChar ? 490 : 240} fill="transparent" />
      <g className="body" transform={bodyTransform(item)}>
        <g dangerouslySetInnerHTML={{ __html: art }} />
        {handles && isChar && <PoseHandles c={item} />}
      </g>
    </g>
  );
});

interface Props { onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void }

export const Stage = forwardRef<SVGSVGElement, Props>(function Stage({ onPointerDown }, ref) {
  const frame = useEditor(currentFrame), sel = useEditor(s => s.sel), pose = useEditor(s => s.pose);
  const bg = useMemo(() => frameBG(frame, true), [frame.bg, frame.scene]);
  return (
    <svg id="stage" ref={ref} viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Storyboard frame" onPointerDown={onPointerDown}>
      <g dangerouslySetInnerHTML={{ __html: bg }} />
      {frame.items.map(it => <ItemView key={it.id} item={it} handles={pose && it.id === sel} />)}
    </svg>
  );
});
