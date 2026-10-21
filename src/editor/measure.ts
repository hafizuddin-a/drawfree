/* Measuring a figure. The posable figure's pieces are clipped <use>s of the whole body art, and browsers measure a
   clipped element by all of its unclipped art (getBBox and getBoundingClientRect alike), so the puppet marks them
   .cut and adds a .bounds outline of the pieces as placed (rig/puppet.ts). These measure a figure by everything else. */

/** the elements that measure true: the figure itself, or for a puppet its parts that are not .cut */
export function measurable(fig: Element): SVGGraphicsElement[] {
  if (!fig.querySelector(':scope > .bounds')) return [fig as SVGGraphicsElement];
  return [...fig.children].filter((k): k is SVGGraphicsElement => !k.classList.contains('cut') && k.tagName.toLowerCase() !== 'defs');
}

/** the figure's box in its own coordinates. getBBox leaves out an element's own transform, so the parts carry none
    (the puppet wraps its moved head in a plain group) */
export function figureBBox(fig: Element): { x: number; y: number; width: number; height: number } {
  const boxes = measurable(fig).map(p => p.getBBox());
  const x0 = Math.min(...boxes.map(q => q.x)), y0 = Math.min(...boxes.map(q => q.y));
  return { x: x0, y: y0, width: Math.max(...boxes.map(q => q.x + q.width)) - x0, height: Math.max(...boxes.map(q => q.y + q.height)) - y0 };
}

/** the figure's box on screen */
export function figureRect(fig: Element): { left: number; top: number; right: number; bottom: number } {
  const rs = measurable(fig).map(p => p.getBoundingClientRect());
  return { left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)), right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom)) };
}
