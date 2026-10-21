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
    await page.keyboard.type('eyepatch');
    const thumb = page.getByRole('button', { name: 'Eyepatch' });
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

test.describe('zoom and pan', () => {
  const viewBox = (page: import('@playwright/test').Page) => page.locator('#stage').getAttribute('viewBox');
  const FULL = '0 0 960 540';

  test('the zoom buttons zoom in and out, and 0 resets', async ({ page }) => {
    expect(await viewBox(page)).toBe(FULL);
    await page.getByRole('button', { name: 'Zoom in' }).click(); await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(await viewBox(page)).not.toBe(FULL);
    await expect(page.getByRole('button', { name: /Reset zoom, now 156 percent/ })).toBeVisible();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: /Reset zoom/ }).click();
    expect(await viewBox(page)).toBe(FULL);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.locator('body').press('0');
    expect(await viewBox(page)).toBe(FULL);
  });

  test('Ctrl and the wheel zoom about the pointer', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no wheel on a phone');
    const c = await centre(page.locator('#stage'));
    await page.mouse.move(c.x, c.y);
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -400); await page.keyboard.up('Control');
    const [, , w] = (await viewBox(page))?.split(' ').map(Number) ?? [];
    expect(w).toBeLessThan(900);
  });

  test('Space and drag pan the view without moving anything', async ({ page }) => {
    await page.getByRole('button', { name: 'Zoom in' }).click(); await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());         // Space on a focused button would press it
    const before = (await viewBox(page))?.split(' ').map(Number) ?? [], t0 = await transformOf(page);
    const c = await centre(page.locator('#stage'));
    await page.keyboard.down('Space');
    await drag(page, c, { x: c.x - 80, y: c.y });
    await page.keyboard.up('Space');
    const after = (await viewBox(page))?.split(' ').map(Number) ?? [];
    expect(after[0]).toBeGreaterThan(before[0]); expect(after[2]).toBe(before[2]);                  // moved, same zoom
    expect(await transformOf(page)).toBe(t0);                                                      // no character moved
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('zoomed in, handles stay 44 px and a hand still lands on the pointer', async ({ page }) => {
    await page.getByRole('button', { name: 'Zoom in' }).click(); await page.getByRole('button', { name: 'Zoom in' }).click();
    await selectFirstChar(page);
    await page.getByRole('toolbar').getByRole('button', { name: 'Pose' }).click();
    const hand = page.locator('.jh.hitc[data-limb="aL"]');
    expect((await box(hand)).width).toBeGreaterThanOrEqual(43);
    const from = await centre(hand), to = { x: from.x - 12, y: from.y - 40 };
    await drag(page, from, to);
    const now = await centre(hand);
    expect(Math.hypot(now.x - to.x, now.y - to.y)).toBeLessThan(8);
  });

  test('the selection box follows the character after zooming', async ({ page }) => {
    // measured the way the app does it: getBoundingClientRect of the body (Playwright's boundingBox also counts the outline's stroke)
    const gap = () => page.evaluate(() => {
      const s = (document.querySelector('[class*="selbox"]') as HTMLElement).getBoundingClientRect(), g = (document.querySelector('#stage .item .body .figure') as SVGGElement).getBoundingClientRect();
      return Math.max(Math.abs(s.x - (g.x - 6)), Math.abs(s.y - (g.y - 6)), Math.abs(s.width - (g.width + 12)), Math.abs(s.height - (g.height + 12)));
    });
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await selectFirstChar(page);
    expect(await gap()).toBeLessThan(1.5);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(await gap()).toBeLessThan(1.5);                                          // the box re-measures when the view changes
    await page.keyboard.press('ArrowRight'); await page.getByRole('button', { name: 'Zoom out' }).click();
    expect(await gap()).toBeLessThan(1.5);
  });
});

test.describe('the selection box turns with the item', () => {
  /** the box's own size (unaffected by its turn), its turn in degrees, and the page rectangles of the box and the character */
  const read = (page: import('@playwright/test').Page) => page.evaluate(() => {
    const s = document.querySelector('[class*="selbox"]') as HTMLElement, g = document.querySelector('#stage .item .body .figure') as SVGGElement;
    const m = new DOMMatrix(getComputedStyle(s).transform), r = s.getBoundingClientRect(), b = g.getBoundingClientRect(), h = document.querySelector('[title^="Rotate"]')?.getBoundingClientRect();
    const board = (s.parentElement as HTMLElement).getBoundingClientRect();
    return { w: s.offsetWidth, h: s.offsetHeight, deg: (Math.atan2(m.b, m.a) * 180) / Math.PI,
      box: { x: r.x, y: r.y, r: r.right, b: r.bottom }, body: { x: b.x, y: b.y, r: b.right, b: b.bottom },
      handle: h ? { x: h.x + h.width / 2, y: h.y + h.height / 2 } : null, board: { x: board.x, y: board.y, r: board.right, b: board.bottom } };
  });

  test('it takes the item\'s turn, keeps its size, and still contains the character', async ({ page }) => {
    await selectFirstChar(page);
    const flat = await read(page);
    expect(Math.abs(flat.deg)).toBeLessThan(0.5);
    for (let i = 0; i < 8; i++) await page.keyboard.press(']');                       // 8 x 5 degrees
    const turned = await read(page);
    expect(turned.deg).toBeGreaterThan(38); expect(turned.deg).toBeLessThan(42);
    expect(Math.abs(turned.w - flat.w)).toBeLessThan(3); expect(Math.abs(turned.h - flat.h)).toBeLessThan(3);   // it does not balloon around the turned figure
    for (const k of ['x', 'y'] as const) expect(turned.box[k]).toBeLessThanOrEqual(turned.body[k] + 1);       // the turned box still contains the character
    expect(turned.box.r).toBeGreaterThanOrEqual(turned.body.r - 1); expect(turned.box.b).toBeGreaterThanOrEqual(turned.body.b - 1);
  });

  test('a mirrored character gets the same box, and turning it the other way works', async ({ page }) => {
    await selectFirstChar(page);
    const before = await read(page);
    await page.keyboard.press('f');
    const flipped = await read(page);
    expect(Math.abs(flipped.w - before.w)).toBeLessThan(3); expect(Math.abs(flipped.deg)).toBeLessThan(0.5);
    for (let i = 0; i < 6; i++) await page.keyboard.press('[');
    const turned = await read(page);
    expect(turned.deg).toBeLessThan(-26); expect(turned.deg).toBeGreaterThan(-34);
  });

  test('the rotate handle stays inside the stage and turns the item when dragged, at any angle', async ({ page }) => {
    await selectFirstChar(page);
    for (let i = 0; i < 12; i++) await page.keyboard.press(']');                      // 60 degrees
    const t = await read(page);
    expect(t.handle).not.toBeNull();
    expect(t.handle?.x).toBeGreaterThan(t.board.x); expect(t.handle?.x).toBeLessThan(t.board.r);
    expect(t.handle?.y).toBeGreaterThan(t.board.y); expect(t.handle?.y).toBeLessThan(t.board.b);
    const h = t.handle as { x: number; y: number }, c = await centre(body(page));
    await drag(page, h, { x: c.x - (h.y - c.y) * 0.5, y: c.y + (h.x - c.x) * 0.5 });       // a small further turn
    const r = numberIn(await transformOf(page), 'rotate');
    expect(r).not.toBe(60);
  });

  test('a corner handle still scales a turned item', async ({ page }) => {
    await selectFirstChar(page);
    for (let i = 0; i < 6; i++) await page.keyboard.press(']');
    const s0 = numberIn(await transformOf(page), 'scale'), corner = page.locator('[data-c="se"]'), c = await centre(corner);
    await drag(page, c, { x: c.x + 40, y: c.y + 40 });
    expect(numberIn(await transformOf(page), 'scale')).toBeGreaterThan(s0);
  });
});

test.describe('selecting several items', () => {
  const figure = (page: import('@playwright/test').Page, i: number) => items(page).nth(i).locator('.figure');

  test('Shift-click adds a second character, and dragging either one moves both as one undo step', async ({ page }) => {
    await selectFirstChar(page);
    await page.keyboard.down('Shift');
    const second = await centre(figure(page, 1)); await page.mouse.click(second.x, second.y);
    await page.keyboard.up('Shift');
    await expect(page.getByRole('toolbar', { name: '2 items selected' })).toBeVisible();
    const a0 = await box(figure(page, 0)), b0 = await box(figure(page, 1)), start = await centre(figure(page, 1));
    await drag(page, start, { x: start.x + 20, y: start.y + 30 });
    const a1 = await box(figure(page, 0)), b1 = await box(figure(page, 1));
    expect(a1.x - a0.x).toBeGreaterThan(10); expect(Math.abs((a1.x - a0.x) - (b1.x - b0.x))).toBeLessThan(2);       // both moved by the same amount
    expect(Math.abs((a1.y - a0.y) - (b1.y - b0.y))).toBeLessThan(2);
    await page.getByRole('button', { name: 'Undo' }).click();
    expect(Math.abs((await box(figure(page, 0))).x - a0.x)).toBeLessThan(2); expect(Math.abs((await box(figure(page, 1))).x - b0.x)).toBeLessThan(2);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('dragging a rectangle on the empty stage selects what it touches, and the group box surrounds them', async ({ page }) => {
    const s = await box(page.locator('#stage'));
    await page.mouse.move(s.x + 8, s.y + 8); await page.mouse.down();
    await page.mouse.move(s.x + s.width * 0.4, s.y + s.height * 0.5, { steps: 6 });
    await expect(page.locator('[class*="marquee"]')).toBeVisible();                         // it is drawn while dragging
    await page.mouse.move(s.x + s.width * 0.8, s.y + s.height * 0.9, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('[class*="marquee"]')).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: '3 items selected' })).toBeVisible();     // the two characters and the speech bubble, not the plant
    const g = await box(page.locator('[class*="selbox"][class*="group"]')), parts = [await box(figure(page, 0)), await box(figure(page, 1)), await box(figure(page, 2))];
    // Playwright's boxes include the figures' thick outline strokes, which the app (like before) does not measure: allow for them
    const slack = 14;
    for (const p of parts) { expect(p.x).toBeGreaterThanOrEqual(g.x - slack); expect(p.x + p.width).toBeLessThanOrEqual(g.x + g.width + slack); expect(p.y).toBeGreaterThanOrEqual(g.y - slack); expect(p.y + p.height).toBeLessThanOrEqual(g.y + g.height + slack); }
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();                // selecting is not an edit
  });

  test('a click on the empty stage clears the group', async ({ page }) => {
    await page.keyboard.press('Control+a');
    await expect(page.getByRole('toolbar', { name: '4 items selected' })).toBeVisible();
    const s = await box(page.locator('#stage'));
    await page.mouse.click(s.x + 6, s.y + s.height - 6);
    await expect(page.getByRole('toolbar')).toHaveCount(0);
  });

  test('Ctrl+A then Delete clears the board, and Ctrl+Z brings everything back', async ({ page }) => {
    await page.keyboard.press('Control+a'); await page.keyboard.press('Delete');
    await expect(items(page)).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(items(page)).toHaveCount(4);
  });

  test('keys act on the group: the arrows move every selected item', async ({ page }) => {
    await page.keyboard.press('Control+a');
    const before = [await box(figure(page, 0)), await box(figure(page, 1))];
    await page.keyboard.press('Shift+ArrowRight');
    const after = [await box(figure(page, 0)), await box(figure(page, 1))];
    for (const i of [0, 1]) expect(after[i].x).toBeGreaterThan(before[i].x + 2);
  });

  test('Shift-click on a selected item takes it out of the group', async ({ page }) => {
    await page.keyboard.press('Control+a');
    await page.keyboard.down('Shift');
    const c = await centre(figure(page, 1)); await page.mouse.click(c.x, c.y);
    await page.keyboard.up('Shift');
    await expect(page.getByRole('toolbar', { name: '3 items selected' })).toBeVisible();
  });
});

test.describe('adding to a selection with Shift and a marquee', () => {
  test('Shift plus a marquee around one more item keeps what was already selected', async ({ page }) => {
    await selectFirstChar(page);                                                    // character 1 (left)
    const s = await box(page.locator('#stage')), second = await box(items(page).nth(1).locator('.figure'));
    await page.keyboard.down('Shift');
    await page.mouse.move(second.x - 12, s.y + s.height - 8);                      // a corner of empty stage, below and left of character 2
    await page.mouse.down();
    await page.mouse.move(second.x + second.width + 12, second.y + second.height * 0.4, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.getByRole('toolbar', { name: '2 items selected' })).toBeVisible();   // character 1 kept, character 2 added
  });

  test('without Shift, a marquee replaces the selection', async ({ page }) => {
    await selectFirstChar(page);
    const s = await box(page.locator('#stage')), second = await box(items(page).nth(1).locator('.figure'));
    await page.mouse.move(second.x - 12, s.y + s.height - 8); await page.mouse.down();
    await page.mouse.move(second.x + second.width + 12, second.y + second.height * 0.4, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole('toolbar', { name: 'Selected item' })).toBeVisible();      // just character 2
  });
});
