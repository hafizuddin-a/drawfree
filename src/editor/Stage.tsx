import { type PointerEvent as ReactPointerEvent, forwardRef, memo, useMemo } from 'react';
import type { Item } from '../types';
import { bodyTransform, charBounds, itemFigure, itemShadow, itemTransform, propDef } from '../rig/renderCharacter';
import { frameBG } from '../scenes/scenes';
import { currentFrame, useEditor } from '../state/store';
import { svgMarkup } from '../ui/markup';
import { viewBox } from './view';

/** One item. Memoised on the item itself, so only the item being dragged re-renders. */
/** `art` bumps when the Open Peeps body art arrives, so a character drawn before it redraws. */
const ItemView = memo(function ItemView({ item, label, selected, art }: { item: Item; label: string; selected: boolean; art: number }) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `art` is a redraw signal: the drawing reads the loaded art from parts/bodies
  const shadow = useMemo(() => itemShadow(item), [item, art]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: as above
  const figure = useMemo(() => itemFigure(item), [item, art]);
  const isChar = item.kind === 'char';
  const [hx0, hy0, hx1, hy1] = isChar ? charBounds(item) : [-130, -200, 130, 40];
  return (
    <g className="item" data-id={item.id} transform={itemTransform(item)}>
      {/* The hit area is also the keyboard stop: it has no text inside, so its name never disagrees with what is drawn. Focusing selects. */}
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG rect cannot be a <button>; this is how items become reachable by keyboard */}
      <rect className="hit" x={hx0} y={hy0} width={hx1 - hx0} height={hy1 - hy0} fill="transparent"
        role="button" tabIndex={0} aria-label={label} aria-pressed={selected}
        onFocus={() => useEditor.getState().select(item.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); useEditor.getState().select(item.id); } }} />
      <g className="body" transform={bodyTransform(item)}>
        <g className="shadow" {...svgMarkup(shadow)} />
        <g className="figure" {...svgMarkup(figure)} />
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
  const sel = useEditor(s => s.sel), extra = useEditor(s => s.extra);
  const picked = new Set(sel ? [sel, ...extra] : []);
  const view = useEditor(s => s.view), art = useEditor(s => s.art);
  // the background is redrawn only when it changes, not on every drag
  const bg = useMemo(() => frameBG({ bg: bgColor, scene }, true), [bgColor, scene]);
  return (
    // biome-ignore lint/a11y/useSemanticElements: the stage is an SVG, which cannot be a fieldset. role=group (not img) because its items are focusable.
    <svg id="stage" ref={ref} viewBox={viewBox(view)} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Storyboard frame" onPointerDown={onPointerDown}>
      <g {...svgMarkup(bg)} />
      {items.map((it, i) => <ItemView key={it.id} item={it} selected={picked.has(it.id)} label={labelOf(items, i)} art={art} />)}
    </svg>
  );
});
