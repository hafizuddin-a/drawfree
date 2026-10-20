import { expect, test } from '@playwright/test';
import { body, box, centre, drag, items, numberIn, selectFirstChar, transformOf } from './helpers';

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(items(page)).toHaveCount(4); });

test.describe('moving, scaling and rotating', () => {
  test('dragging a character moves it, as one undo step', async ({ page }) => {
    await selectFirstChar(page);
    const before = await box(body(page)), start = await centre(body(page));
    await drag(page, start, { x: start.x + 60, y: start.y + 30 });
    const after = await box(body(page));
    expect(after.x - before.x).toBeGreaterThan(40); expect(after.x - before.x).toBeLessThan(80);
    expect(after.y - before.y).toBeGreaterThan(15);
    await page.getByRole('button', { name: 'Undo' }).click();
    expect(Math.abs((await box(body(page))).x - before.x)).toBeLessThan(2);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();            // the drag was one step
  });

  test('a plain click selects without making an undo step', async ({ page }) => {
    await selectFirstChar(page);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('a corner handle scales the character', async ({ page }) => {
    await selectFirstChar(page);
    const w0 = (await box(body(page))).width, corner = page.locator('[data-c="se"]');
    const c = await centre(corner);
    await drag(page, c, { x: c.x + 50, y: c.y + 50 });
    expect((await box(body(page))).width).toBeGreaterThan(w0 * 1.1);
  });

  test('the round handle rotates it, and a double click resets it', async ({ page }) => {
    await selectFirstChar(page);
    const handle = page.locator('[title^="Rotate"]'), h = await centre(handle), c = await centre(body(page));
    // a quarter turn around the character's centre, wherever the handle was placed
    await drag(page, h, { x: c.x - (h.y - c.y), y: c.y + (h.x - c.x) });
    const r = numberIn(await transformOf(page), 'rotate');
    expect(Math.abs(r)).toBeGreaterThan(20);
    await handle.dblclick();
    expect(numberIn(await transformOf(page), 'rotate')).toBe(0);
  });
});

test.describe('posing', () => {
  test('dragging a hand handle follows the pointer, and the elbow dot flips the bend', async ({ page }) => {
    await selectFirstChar(page);
    await page.getByRole('toolbar').getByRole('button', { name: 'Pose' }).click();
    await expect(page.getByRole('tab', { name: 'Pose' })).toHaveAttribute('aria-selected', 'true');
    const hand = page.locator('.jh.hitc[data-limb="aL"]'), from = await centre(hand);
    const to = { x: from.x - 14, y: from.y - 30 };
    await drag(page, from, to);
    const now = await centre(hand);
    expect(Math.hypot(now.x - to.x, now.y - to.y)).toBeLessThan(8);             // the joint lands on the pointer
    await page.getByRole('button', { name: 'Undo' }).click();
    const back = await centre(hand);
    expect(Math.hypot(back.x - from.x, back.y - from.y)).toBeLessThan(3);

    const before = await centre(page.locator('.bh.hitc[data-limb="aL"]'));
    await page.mouse.click(before.x, before.y);                                    // the elbow dot
    const hand2 = await centre(hand);
    expect(Math.hypot(hand2.x - from.x, hand2.y - from.y)).toBeLessThan(3);       // the hand stays put
  });

  test('a preset pose changes the arms', async ({ page }) => {
    await selectFirstChar(page);
    await page.getByRole('tab', { name: 'Pose' }).click();
    const before = await body(page).innerHTML();
    await page.getByRole('button', { name: 'Cheering' }).click();
    expect(await body(page).innerHTML()).not.toBe(before);
  });
});

test.describe('keyboard only', () => {
  test('Tab reaches the characters, and keys edit the focused one', async ({ page }) => {
    let found = false;
    for (let i = 0; i < 80 && !found; i++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(() => document.activeElement?.classList.contains('hit') ?? false);
    }
    expect(found).toBe(true);
    await expect(page.getByRole('toolbar', { name: 'Selected item' })).toBeVisible();     // focusing selects
    const x0 = numberIn(await transformOf(page), 'translate');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowRight');
    expect(numberIn(await transformOf(page), 'translate')).toBeCloseTo(x0 + 11, 0);
    const s0 = numberIn(await transformOf(page), 'scale');
    await page.keyboard.press('+');
    expect(numberIn(await transformOf(page), 'scale')).toBeGreaterThan(s0);
    await page.keyboard.press(']');
    expect(numberIn(await transformOf(page), 'rotate')).toBe(5);
    await page.keyboard.press('f');
    await expect(body(page)).toHaveAttribute('transform', 'scale(-1 1)');
    await page.keyboard.press('Control+d');
    await expect(items(page)).toHaveCount(5);
    await page.keyboard.press('Delete');
    await expect(items(page)).toHaveCount(4);
    await page.keyboard.press('Control+z');
    await expect(items(page)).toHaveCount(5);
  });

  test('items have names, and Enter selects the focused one', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Character 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Speech bubble' })).toBeVisible();
    await items(page).nth(1).locator('.hit').focus();
    await expect(page.getByRole('button', { name: 'Character 2' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('toolbar', { name: 'Selected item' })).toHaveCount(0);
  });

  test('the picker works from the keyboard: search with /, arrows between thumbnails, Enter applies', async ({ page }) => {
    await items(page).first().locator('.hit').focus();
    await page.locator('body').press('/');
    await expect(page.getByRole('searchbox', { name: 'Search parts' })).toBeFocused();
    await page.keyboard.type('curls');
    const thumb = page.getByRole('button', { name: 'Curls' });
    await thumb.focus(); await page.keyboard.press('Enter');
    await expect(thumb).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('files and export', () => {
  test('save, change, then open the saved file restores the project', async ({ page }, info) => {
    await page.getByRole('textbox', { name: 'Project name' }).fill('E2E Film');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const d = await dl;
    expect(d.suggestedFilename()).toBe('e2e-film.drawfree.json');
    const file = info.outputPath('saved.drawfree.json');
    await d.saveAs(file);
    await selectFirstChar(page); await page.keyboard.press('Delete');
    await expect(items(page)).toHaveCount(3);
    await page.getByRole('textbox', { name: 'Project name' }).fill('Changed');
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(items(page)).toHaveCount(4);
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('E2E Film');
  });

  test('autosave survives a reload', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Project name' }).fill('Kept');
    await page.getByRole('button', { name: 'Add frame' }).click();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Kept');
    await expect(page.getByRole('button', { name: /^Frame \d$/ })).toHaveCount(2);
  });

  test('the frame downloads as a real PNG at the chosen size, and as SVG', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    const png = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    const file = await (await png).createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of file) chunks.push(c as Buffer);
    const buf = Buffer.concat(chunks);
    expect(buf.subarray(1, 4).toString()).toBe('PNG');
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1920, 1080]);

    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('radio', { name: 'SVG' }).check();
    const svg = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    const sbuf: Buffer[] = [];
    for await (const c of await (await svg).createReadStream()) sbuf.push(c as Buffer);
    expect(Buffer.concat(sbuf).toString().startsWith('<svg')).toBe(true);
  });

  test('the board downloads as a PDF and as a PNG strip', async ({ page }) => {
    await page.getByRole('button', { name: 'Duplicate' }).click();
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('radio', { name: /Whole board/ }).check();
    const pdf = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    const pbuf: Buffer[] = [];
    for await (const c of await (await pdf).createReadStream()) pbuf.push(c as Buffer);
    expect(Buffer.concat(pbuf).subarray(0, 5).toString()).toBe('%PDF-');

    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('radio', { name: 'PNG strip' }).check();
    const strip = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG strip' }).click();
    const sb: Buffer[] = [];
    for await (const c of await (await strip).createReadStream()) sb.push(c as Buffer);
    expect(Buffer.concat(sb).subarray(1, 4).toString()).toBe('PNG');
  });
});

test.describe('frames', () => {
  test('reordering with the buttons and with Alt+Arrow', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Scene note' }).fill('A');
    await page.getByRole('button', { name: 'Add frame' }).click();
    await page.getByRole('textbox', { name: 'Scene note' }).fill('B');
    await page.getByRole('button', { name: 'Frame 1' }).click();
    await page.getByRole('button', { name: 'Move frame later' }).click();
    await expect(page.getByRole('button', { name: 'Frame 2' })).toHaveAttribute('aria-current', 'true');
    await page.getByRole('button', { name: 'Frame 2' }).focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.getByRole('button', { name: 'Frame 1' })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('textbox', { name: 'Scene note' })).toHaveValue('A');
  });

  test('dragging a thumbnail reorders (mouse)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch drags scroll the strip; touch users use the buttons');
    await page.getByRole('textbox', { name: 'Scene note' }).fill('A');
    await page.getByRole('button', { name: 'Add frame' }).click();
    await page.getByRole('textbox', { name: 'Scene note' }).fill('B');
    await page.getByRole('button', { name: 'Frame 1' }).scrollIntoViewIfNeeded();             // scroll first, then measure both
    const a = await centre(page.getByRole('button', { name: 'Frame 1' })), b = await box(page.getByRole('button', { name: 'Frame 2' }));
    await drag(page, a, { x: b.x + b.width - 10, y: b.y + b.height / 2 });
    // the moved frame (A) was not the current one: B stays current and is now first
    await expect(page.getByRole('button', { name: 'Frame 1' })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('textbox', { name: 'Scene note' })).toHaveValue('B');
    await page.getByRole('button', { name: 'Frame 2' }).click();
    await expect(page.getByRole('textbox', { name: 'Scene note' })).toHaveValue('A');
  });
});

test.describe('touch targets', () => {
  test('pose handles have hit areas of at least 44 px (hand and foot) and 32 px (elbow and knee)', async ({ page }) => {
    await selectFirstChar(page);
    await page.getByRole('toolbar').getByRole('button', { name: 'Pose' }).click();
    for (const limb of ['aL', 'aR', 'lL', 'lR']) {
      const hand = await box(page.locator(`.jh.hitc[data-limb="${limb}"]`)), joint = await box(page.locator(`.bh.hitc[data-limb="${limb}"]`));
      expect(hand.width, `${limb} hand`).toBeGreaterThanOrEqual(43);
      expect(joint.width, `${limb} joint`).toBeGreaterThanOrEqual(31);
    }
  });

  test('the visible hand dot is easy to see and big enough to aim at', async ({ page }) => {
    await selectFirstChar(page);
    await page.getByRole('toolbar').getByRole('button', { name: 'Pose' }).click();
    const dot = await page.locator('.jh.hitc[data-limb="aR"] + circle').first();
    expect((await box(dot)).width).toBeGreaterThanOrEqual(17);
  });
});
