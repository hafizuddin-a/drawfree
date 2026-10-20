/* The stage's zoom and pan, as pure maths. The view is a window onto the 960 x 540 frame: a zoom (1 = the whole frame) and the
   frame point at its centre. It lives in the store but is not part of undo history and is not saved with the project. */
export const FRAME_W = 960, FRAME_H = 540;
export const MIN_ZOOM = 1, MAX_ZOOM = 5;

export interface View { zoom: number; cx: number; cy: number }
export interface Pt { x: number; y: number }
export const DEFAULT_VIEW: View = { zoom: 1, cx: FRAME_W / 2, cy: FRAME_H / 2 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** keeps the zoom in range and the visible window inside the frame */
export function clampView(v: View): View {
  const zoom = clamp(Number.isFinite(v.zoom) ? v.zoom : 1, MIN_ZOOM, MAX_ZOOM);
  const hw = FRAME_W / zoom / 2, hh = FRAME_H / zoom / 2;
  return { zoom, cx: clamp(Number.isFinite(v.cx) ? v.cx : FRAME_W / 2, hw, FRAME_W - hw), cy: clamp(Number.isFinite(v.cy) ? v.cy : FRAME_H / 2, hh, FRAME_H - hh) };
}

/** the SVG viewBox attribute for a view */
export function viewBox(v: View): string {
  const w = FRAME_W / v.zoom, h = FRAME_H / v.zoom;
  return `${r2(v.cx - w / 2)} ${r2(v.cy - h / 2)} ${r2(w)} ${r2(h)}`;
}

/** zooms by `factor` while the frame point `at` stays where it is on screen (so zooming follows the pointer) */
export function zoomAt(v: View, factor: number, at: Pt): View {
  const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM), k = v.zoom / zoom;
  return clampView({ zoom, cx: at.x - (at.x - v.cx) * k, cy: at.y - (at.y - v.cy) * k });
}

/** moves the view by a distance in frame units */
export const panBy = (v: View, dx: number, dy: number): View => clampView({ ...v, cx: v.cx + dx, cy: v.cy + dy });

export const isDefault = (v: View): boolean => v.zoom === 1;
export const zoomPercent = (v: View): number => Math.round(v.zoom * 100);
