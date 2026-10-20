import { type PointerEvent as ReactPointerEvent, type RefObject, forwardRef, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Character, Item } from '../types';
import { bodyTransform, itemArt, itemTransform, propDef } from '../rig/renderCharacter';
import { rig } from '../rig/poses';
import { f1 } from '../parts/draw';
import { frameBG } from '../scenes/scenes';
import { currentFrame, useEditor } from '../state/store';
import { svgMarkup } from '../ui/markup';
import { viewBox } from './view';

/* Pose handles exist only in the editor. They are sized in SCREEN pixels, not stage units: `px` is how many screen pixels one
   stage unit is (about 0.35 on a phone, 1.3 on a wide desktop), and an item's own scale shrinks them further, so both are divided out.
   Each handle has a larger invisible circle that is the real hit target: 44 px across for the hand or foot, 32 px for the elbow or knee,
   so a finger never loses a handle. */
const HAND_R = 22, JOINT_R = 16, HAND_DOT = 9, JOINT_DOT = 6;

function PoseHandles({ c, px }: { c: Character; px: number }) {
  const r = rig(c), k = 1 / (px * c.s);
  return (
    <>
      {(Object.keys(r) as Array<keyof typeof r>).map(l => {
        const [, elbow, end] = r[l];
        return (
          <g key={l}>
            <circle className="bh hitc" data-limb={l} cx={f1(elbow[0])} cy={f1(elbow[1])} r={f1(JOINT_R * k)}><title>Click to flip the bend</title></circle>
            <circle cx={f1(elbow[0])} cy={f1(elbow[1])} r={f1(JOINT_DOT * k)} style={{ fill: '#fff', stroke: 'var(--accent)', strokeWidth: f1(2.2 * k), pointerEvents: 'none' }} />
            <circle className="jh hitc" data-limb={l} cx={f1(end[0])} cy={f1(end[1])} r={f1(HAND_R * k)}><title>Drag to move</title></circle>
            <circle cx={f1(end[0])} cy={f1(end[1])} r={f1(HAND_DOT * k)} style={{ fill: 'var(--accent)', fillOpacity: 0.85, stroke: '#fff', strokeWidth: f1(2.5 * k), pointerEvents: 'none' }} />
          </g>
        );
      })}
    </>
  );
}

/** One item. Memoised on the item itself, so only the item being dragged re-renders. */
const ItemView = memo(function ItemView({ item, handles, label, selected, px }: { item: Item; handles: boolean; label: string; selected: boolean; px: number }) {
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
        {handles && isChar && <PoseHandles c={item} px={px} />}
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

/** Screen pixels per stage unit, kept current as the stage is resized or zoomed. Rounded so tiny changes do not re-render every item. */
function useStagePx(stage: RefObject<SVGSVGElement | null>): number {
  const [px, setPx] = useState(1);
  const measure = useCallback(() => {
    const a = stage.current?.getScreenCTM()?.a;
    if (typeof a === 'number' && Number.isFinite(a) && a > 0) setPx(Math.round(a * 100) / 100);   // setState ignores an unchanged value
  }, [stage]);
  useLayoutEffect(() => { measure(); });                      // after every render, so a zoom is picked up too
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage, measure]);
  return px;
}

export const Stage = forwardRef<SVGSVGElement, Props>(function Stage({ onPointerDown }, ref) {
  const svg = useRef<SVGSVGElement | null>(null);
  const attach = (el: SVGSVGElement | null) => { svg.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; };
  const items = useEditor(s => currentFrame(s).items), bgColor = useEditor(s => currentFrame(s).bg), scene = useEditor(s => currentFrame(s).scene);
  const sel = useEditor(s => s.sel), pose = useEditor(s => s.pose);
  const view = useEditor(s => s.view), px = useStagePx(svg);
  // the background is redrawn only when it changes, not on every drag
  const bg = useMemo(() => frameBG({ bg: bgColor, scene }, true), [bgColor, scene]);
  return (
    // biome-ignore lint/a11y/useSemanticElements: the stage is an SVG, which cannot be a fieldset. role=group (not img) because its items are focusable.
    <svg id="stage" ref={attach} viewBox={viewBox(view)} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Storyboard frame" onPointerDown={onPointerDown}>
      <g {...svgMarkup(bg)} />
      {items.map((it, i) => <ItemView key={it.id} item={it} handles={pose && it.id === sel} selected={it.id === sel} label={labelOf(items, i)} px={px} />)}
    </svg>
  );
});
