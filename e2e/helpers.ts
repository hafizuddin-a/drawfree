import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const items = (page: Page) => page.locator('#stage .item');
export const body = (page: Page, i = 0) => items(page).nth(i).locator('.body');

export async function centre(l: Locator): Promise<{ x: number; y: number }> {
  await l.scrollIntoViewIfNeeded();
  const b = await box(l);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** An element's box on screen. A character's figure (or the .body around it) is measured the way the app does it
    (src/editor/measure.ts): the posable figure's pieces are clipped, and browsers measure a clipped element by all of
    its art, so it counts everything but the .cut pieces (their .bounds outline stands in). */
export async function box(l: Locator) {
  const fig = await l.evaluate(el => el.classList.contains('figure') || !!el.querySelector(':scope > .figure'));
  if (!fig) {
    const b = await l.boundingBox();
    if (!b) throw new Error('element has no box');
    return b;
  }
  return l.evaluate(el => {
    const f = el.classList.contains('figure') ? el : (el.querySelector(':scope > .figure') as Element);
    const parts = f.querySelector(':scope > .bounds') ? [...f.children].filter(k => !k.classList.contains('cut') && k.tagName.toLowerCase() !== 'defs') : [f];
    const rs = parts.map(p => p.getBoundingClientRect());
    const x = Math.min(...rs.map(r => r.left)), y = Math.min(...rs.map(r => r.top));
    return { x, y, width: Math.max(...rs.map(r => r.right)) - x, height: Math.max(...rs.map(r => r.bottom)) - y };
  });
}
/** the first character's figure */
export const figureOf = (page: Page, i = 0) => items(page).nth(i).locator('.body > .figure');

/** a mouse drag in small steps, like a hand */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + (to.x - from.x) * 0.3, from.y + (to.y - from.y) * 0.3, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** selects the first character by clicking it */
export async function selectFirstChar(page: Page): Promise<void> {
  await page.locator('#stage').scrollIntoViewIfNeeded();
  const c = await centre(body(page, 0));
  await page.mouse.click(c.x, c.y);
  await expect(page.getByRole('toolbar', { name: 'Selected item' })).toBeVisible();
}

export const transformOf = (page: Page, i = 0) => items(page).nth(i).getAttribute('transform');
export const numberIn = (s: string | null, fn: string): number => Number(new RegExp(`${fn}\\(([-\\d.]+)`).exec(s ?? '')?.[1]);
