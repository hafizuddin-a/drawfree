import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const items = (page: Page) => page.locator('#stage .item');
export const body = (page: Page, i = 0) => items(page).nth(i).locator('.body');

export async function centre(l: Locator): Promise<{ x: number; y: number }> {
  await l.scrollIntoViewIfNeeded();
  const b = await l.boundingBox();
  if (!b) throw new Error('element has no box');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

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
