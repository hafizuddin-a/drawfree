import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { items, selectFirstChar } from './helpers';

/** serious and critical violations only, with enough detail to fix them */
async function violations(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join('\n  ')}`);
}

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(items(page)).toHaveCount(4); });

test('the editor has no serious or critical accessibility violations', async ({ page }) => {
  expect(await violations(page)).toEqual([]);
});
test('with a character selected and the toolbar showing', async ({ page }) => {
  await selectFirstChar(page);
  expect(await violations(page)).toEqual([]);
});
test('in pose mode', async ({ page }) => {
  await selectFirstChar(page);
  await page.getByRole('toolbar').getByRole('button', { name: 'Pose' }).click();
  expect(await violations(page)).toEqual([]);
});
for (const tab of ['Face', 'Tops', 'Extras', 'Props', 'Scene']) {
  test(`the picker, ${tab} tab`, async ({ page }) => {
    await page.getByRole('tab', { name: tab }).click();
    expect(await violations(page)).toEqual([]);
  });
}
test('the picker search results', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search parts' }).fill('b');
  expect(await violations(page)).toEqual([]);
});
test('the export dialog: frame, PDF and PNG strip', async ({ page }) => {
  await page.getByRole('button', { name: 'Export' }).click();
  expect(await violations(page)).toEqual([]);
  await page.getByRole('radio', { name: /Whole board/ }).check();
  expect(await violations(page)).toEqual([]);
  await page.getByRole('radio', { name: 'PNG strip' }).check();
  expect(await violations(page)).toEqual([]);
});
test('the frame strip with several frames', async ({ page }) => {
  await page.getByRole('button', { name: 'Duplicate' }).click();
  expect(await violations(page)).toEqual([]);
});
test('with several items selected', async ({ page }) => {
  await page.keyboard.press('Control+a');
  await expect(page.getByRole('toolbar', { name: '4 items selected' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
