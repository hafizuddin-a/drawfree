/* Selection box geometry. The box turns with the item, so it is described as a rotated rectangle (centre, size, angle) plus the
   axis-aligned bounds of that rectangle (used to place the toolbar). Pure maths, tested in Node. */
import type { Pt } from './view';

export interface SelBox {
  /** centre, in the board's pixels */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** degrees, in [-90, 90): a rectangle looks the same turned half a turn, so the angle is kept small and stable */
  angle: number;
  /** axis-aligned bounds of the rotated rectangle */
  ax: number;
  ay: number;
  aw: number;
  ah: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** The box around four mapped corners (top-left, top-right, bottom-right, bottom-left of the item's local box), grown by `pad` all round. */
export function boxFromCorners(c: readonly [Pt, Pt, Pt, Pt], pad: number): SelBox {
  const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4, cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
  let angle = (Math.atan2(c[1].y - c[0].y, c[1].x - c[0].x) * 180) / Math.PI;
  angle = r1(((angle % 180) + 180) % 180);          // round first, so 89.99999 cannot become exactly 90 after the range check
  if (angle >= 90) angle -= 180;
  const w = dist(c[0], c[1]) + 2 * pad, h = dist(c[0], c[3]) + 2 * pad;
  // the bounds of the padded rectangle: rotate its half-extents
  const rad = (angle * Math.PI) / 180, ex = (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h) / 2, ey = (Math.abs(Math.sin(rad)) * w + Math.abs(Math.cos(rad)) * h) / 2;
  return { cx: r1(cx), cy: r1(cy), w: r1(w), h: r1(h), angle, ax: r1(cx - ex), ay: r1(cy - ey), aw: r1(2 * ex), ah: r1(2 * ey) };
}

export type HandleSide = 'above' | 'below' | 'right' | 'left';

/** Where the round rotate handle goes: above the box (in the box's own turned frame), else below, else beside it, whichever first
 *  lands inside the board with room for the handle. `reach` is how far out it sits. */
export function handleSide(b: SelBox, boardW: number, boardH: number, reach = 40, margin = 22): HandleSide {
  const inside = (p: Pt) => p.x >= margin && p.x <= boardW - margin && p.y >= margin && p.y <= boardH - margin;
  return (['above', 'below', 'right', 'left'] as const).find(s => inside(handleAt(b, s, reach))) ?? 'right';
}

/** where the rotate handle's centre is on the board for a side */
export function handleAt(b: SelBox, side: HandleSide, reach = 40): Pt {
  const rad = (b.angle * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  const [ox, oy] = { above: [0, -(b.h / 2 + reach)], below: [0, b.h / 2 + reach], right: [b.w / 2 + reach, 0], left: [-(b.w / 2 + reach), 0] }[side];
  return { x: b.cx + ox * c - oy * s, y: b.cy + ox * s + oy * c };
}

/** The toolbar's top-left: beside the box's axis-aligned bounds, on the right unless it would leave the board, and
 *  on the other side when the rotate handle (a turned box can put it there) would sit under it. */
export function toolbarSpot(b: SelBox, side: HandleSide, boardW: number, boardH: number, tw = 56, th = 240, gap = 12, hr = 22): Pt {
  const y = Math.max(4, Math.min(b.ay, boardH - th));
  const right = b.ax + b.aw + gap, left = Math.max(4, b.ax - gap - tw);
  const h = handleAt(b, side);
  const covers = (x: number) => h.x + hr > x && h.x - hr < x + tw && h.y + hr > y && h.y - hr < y + th;
  let x = right + tw > boardW ? left : right;
  if (covers(x)) { const other = x === right ? left : right; if (!covers(other) && other + tw <= boardW) x = other; }
  return { x, y };
}
