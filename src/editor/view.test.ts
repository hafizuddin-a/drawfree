// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, FRAME_H, FRAME_W, MAX_ZOOM, MIN_ZOOM, clampView, panBy, viewBox, zoomAt, zoomPercent } from './view';

/** where a frame point lands in a viewport of the given size, for a view */
const toScreen = (v: ReturnType<typeof clampView>, p: { x: number; y: number }, w = 960, h = 540) =>
  ({ x: ((p.x - (v.cx - FRAME_W / v.zoom / 2)) / (FRAME_W / v.zoom)) * w, y: ((p.y - (v.cy - FRAME_H / v.zoom / 2)) / (FRAME_H / v.zoom)) * h });

describe('view maths', () => {
  it('the default view shows the whole frame', () => {
    expect(viewBox(DEFAULT_VIEW)).toBe('0 0 960 540'); expect(zoomPercent(DEFAULT_VIEW)).toBe(100);
  });
  it('zooming in narrows the window around the centre', () => {
    expect(viewBox(zoomAt(DEFAULT_VIEW, 2, { x: 480, y: 270 }))).toBe('240 135 480 270');
  });
  it('the point under the pointer stays put while zooming', () => {
    for (const at of [{ x: 100, y: 80 }, { x: 700, y: 400 }, { x: 480, y: 270 }]) for (const f of [1.3, 2, 3.7]) {
      const v = zoomAt(DEFAULT_VIEW, f, at), before = toScreen(DEFAULT_VIEW, at), after = toScreen(v, at);
      // a corner point cannot stay put once the window hits the frame edge, so only check when the window is not clamped
      if (v.cx - FRAME_W / v.zoom / 2 > 0.01 && v.cx + FRAME_W / v.zoom / 2 < FRAME_W - 0.01 && v.cy - FRAME_H / v.zoom / 2 > 0.01 && v.cy + FRAME_H / v.zoom / 2 < FRAME_H - 0.01) {
        expect(after.x).toBeCloseTo(before.x, 5); expect(after.y).toBeCloseTo(before.y, 5);
      }
    }
  });
  it('zooms in and out again to the same view', () => {
    const at = { x: 500, y: 300 }, v = zoomAt(zoomAt(DEFAULT_VIEW, 2, at), 0.5, at);
    expect(v.zoom).toBe(1); expect(viewBox(v)).toBe('0 0 960 540');
  });
  it('limits the zoom', () => {
    expect(zoomAt(DEFAULT_VIEW, 100, { x: 480, y: 270 }).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(DEFAULT_VIEW, 0.01, { x: 480, y: 270 }).zoom).toBe(MIN_ZOOM);
    expect(clampView({ zoom: 0, cx: 0, cy: 0 }).zoom).toBe(MIN_ZOOM);
  });
  it('never shows anything outside the frame', () => {
    for (const zoom of [1, 1.5, 2, 5]) for (const [cx, cy] of [[-500, -500], [5000, 5000], [0, 270], [960, 540]]) {
      const v = clampView({ zoom, cx, cy }), hw = FRAME_W / v.zoom / 2, hh = FRAME_H / v.zoom / 2;
      expect(v.cx - hw).toBeGreaterThanOrEqual(-1e-9); expect(v.cx + hw).toBeLessThanOrEqual(FRAME_W + 1e-9);
      expect(v.cy - hh).toBeGreaterThanOrEqual(-1e-9); expect(v.cy + hh).toBeLessThanOrEqual(FRAME_H + 1e-9);
    }
  });
  it('panning moves the window and stops at the frame edges; the whole frame cannot be panned', () => {
    const z = zoomAt(DEFAULT_VIEW, 2, { x: 480, y: 270 });
    expect(viewBox(panBy(z, 100, 0))).toBe('340 135 480 270');
    expect(viewBox(panBy(z, 9999, 9999))).toBe('480 270 480 270');
    expect(viewBox(panBy(z, -9999, -9999))).toBe('0 0 480 270');
    expect(panBy(DEFAULT_VIEW, 300, 300)).toEqual(DEFAULT_VIEW);
  });
  it('survives garbage numbers', () => {
    expect(clampView({ zoom: Number.NaN, cx: Number.NaN, cy: Number.POSITIVE_INFINITY })).toEqual({ zoom: 1, cx: 480, cy: 270 });
  });
});
