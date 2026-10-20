/* jsdom has no layout, no SVG matrices, no DOMPoint and no object URLs. These stand-ins let the editor run in tests.
   Files marked `@vitest-environment node` (pure logic) skip all of it. */
import { afterEach, vi } from 'vitest';

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');

  class FakePoint {
    constructor(public x = 0, public y = 0) {}
    matrixTransform() { return { x: this.x, y: this.y }; }
  }
  Object.defineProperty(globalThis, 'DOMPoint', { value: FakePoint, configurable: true });
  const matrix = { a: 1, inverse() { return matrix; } };
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { value: () => matrix, configurable: true });
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: () => ({ x: 100, y: 80, left: 100, top: 80, width: 120, height: 300, right: 220, bottom: 380, toJSON: () => ({}) }), configurable: true, writable: true
  });
  if (!('ResizeObserver' in globalThis)) {
    Object.defineProperty(globalThis, 'ResizeObserver', { value: class { observe() {} unobserve() {} disconnect() {} }, configurable: true });
  }
  afterEach(() => { cleanup(); localStorage.clear(); });
}
afterEach(() => { vi.useRealTimers(); });
