/* PDF export of the whole board: one frame per page, or a contact sheet. Frames are PNG images, notes are real text.
   pdf-lib is loaded on demand (dynamic import), so it never counts against the first-load budget. */
import type { Frame } from '../types';
import { type PdfOptions, pdfPlan, wrapLines } from './layout';

export interface PdfResult {
  bytes: Uint8Array;
  /** characters in notes that the PDF's built-in font cannot draw (emoji, most non-Latin scripts), shown as "?" */
  replacedChars: number;
}

/** Renders one frame as PNG bytes. Injected, so the PDF code itself needs no canvas. */
export type RenderPng = (frame: Frame, index: number) => Promise<Uint8Array>;

export async function buildPdf(
  frames: readonly Frame[], projectName: string, o: PdfOptions, renderPng: RenderPng, onProgress?: (done: number, total: number) => void
): Promise<PdfResult> {
  const plan = pdfPlan(frames.length, o);
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(projectName); pdf.setCreator('Drawfree'); pdf.setProducer('Drawfree');

  // the built-in fonts cover Latin-1 only: anything else would throw, so it is replaced and counted
  const encodable = new Map<string, boolean>();
  const canDraw = (ch: string): boolean => {
    let ok = encodable.get(ch);
    if (ok === undefined) { try { font.encodeText(ch); ok = true; } catch { ok = false; } encodable.set(ch, ok); }
    return ok;
  };
  let replacedChars = 0;
  const safe = (text: string): string => {
    let out = '';
    for (const ch of text.replace(/\s+/g, ' ').trim()) {
      if (canDraw(ch)) out += ch; else { out += '?'; replacedChars++; }
    }
    return out;
  };

  const grey = rgb(0.4, 0.44, 0.48), ink = rgb(0.08, 0.08, 0.08), line = rgb(0.84, 0.87, 0.9);
  const total = plan.pages.length;
  let done = 0;
  for (const [pi, cells] of plan.pages.entries()) {
    const page = pdf.addPage([plan.pageW, plan.pageH]);
    // header: project name on the left, page number on the right
    const name = safe(projectName), hs = 9, hy = plan.pageH - 36 - 10;
    const nameLines = wrapLines(name, plan.pageW - 72 - 60, s => bold.widthOfTextAtSize(s, hs), 1);
    if (nameLines[0]) page.drawText(nameLines[0], { x: 36, y: hy, size: hs, font: bold, color: grey });
    const pn = `${pi + 1} / ${total}`;
    page.drawText(pn, { x: plan.pageW - 36 - font.widthOfTextAtSize(pn, hs), y: hy, size: hs, font, color: grey });

    for (const cell of cells) {
      const f = frames[cell.index], img = await pdf.embedPng(await renderPng(f, cell.index));
      page.drawImage(img, { x: cell.frame.x, y: cell.frame.y, width: cell.frame.w, height: cell.frame.h });
      page.drawRectangle({ x: cell.frame.x, y: cell.frame.y, width: cell.frame.w, height: cell.frame.h, borderColor: line, borderWidth: 0.75 });

      // caption: the frame number, then the note wrapped beside and under it
      const label = o.notes ? `${cell.index + 1}` : `Frame ${cell.index + 1}`, indent = bold.widthOfTextAtSize(label, plan.fontSize) + 5;
      const top = cell.caption.y + cell.caption.h - plan.fontSize;
      page.drawText(label, { x: cell.caption.x, y: top, size: plan.fontSize, font: bold, color: ink });
      if (o.notes) {
        const lines = wrapLines(safe(f.note), cell.caption.w - indent, s => font.widthOfTextAtSize(s, plan.fontSize), plan.maxLines);
        for (const [i, l] of lines.entries()) page.drawText(l, { x: cell.caption.x + indent, y: top - i * plan.lineH, size: plan.fontSize, font, color: ink });
      }
      onProgress?.(++done, frames.length);
    }
  }
  return { bytes: await pdf.save(), replacedChars };
}
