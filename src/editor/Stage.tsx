import { forwardRef, memo, useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import type { Character, Item } from '../types';
import { bodyTransform, itemArt, itemTransform, propDef } from '../rig/renderCharacter';
import { rig } from '../rig/poses';
import { f1 } from '../parts/draw';
import { frameBG } from '../scenes/scenes';
import { currentFrame, useEditor } from '../state/store';
import { svgMarkup } from '../ui/markup';

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
const ItemView = memo(function ItemView({ item, handles, label, selected }: { item: Item; handles: boolean; label: string; selected: boolean }) {
  const art = useMemo(() => itemArt(item), [item]);
  const isChar = item.kind === 'char';
  return (
    <g className="item" data-id={item.id} transform={itemTransform(item)}>
      {/* The hit area is also the keyboard stop: it has no text inside, so its name never disagrees with what is drawn. Focusing selects. */}
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG rect cannot be a <button>; this is how items become reachable by keyboard */}
      <rect className="hit" x={-130} y={isChar ? -290 : -200} width={260} height={isChar ? 490 : 240} fill="transparent"
        role="button" tabIndex={0} aria-label={label} aria-pressed={selected}
        onFocus={() => useEditor.getState().select(item.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); useEditor.getState().select(item.id); } }} />
      <g className="body" transform={bodyTransform(item)}>
        <g {...svgMarkup(art)} />
        {handles && isChar && <PoseHandles c={item} />}
      </g>
    </g>
  );
});

/** a spoken name for an item: "Character 2", "Speech bubble" */
function labelOf(items: readonly Item[], i: number): string {
  const it = items[i];
  if (it.kind === 'prop') return it.text ? `${propDef(it.prop).name}: ${it.text}` : propDef(it.prop).name;
  return `Character ${items.slice(0, i + 1).filter(x => x.kind === 'char').length}`;
}

interface Props { onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void }

export const Stage = forwardRef<SVGSVGElement, Props>(function Stage({ onPointerDown }, ref) {
  const items = useEditor(s => currentFrame(s).items), bgColor = useEditor(s => currentFrame(s).bg), scene = useEditor(s => currentFrame(s).scene);
  const sel = useEditor(s => s.sel), pose = useEditor(s => s.pose);
  // the background is redrawn only when it changes, not on every drag
  const bg = useMemo(() => frameBG({ bg: bgColor, scene }, true), [bgColor, scene]);
  return (
    // biome-ignore lint/a11y/useSemanticElements: the stage is an SVG, which cannot be a fieldset. role=group (not img) because its items are focusable.
    <svg id="stage" ref={ref} viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Storyboard frame" onPointerDown={onPointerDown}>
      <g {...svgMarkup(bg)} />
      {items.map((it, i) => <ItemView key={it.id} item={it} handles={pose && it.id === sel} selected={it.id === sel} label={labelOf(items, i)} />)}
    </svg>
  );
});
