/* SVG -> image -> PNG, through an <img> and a canvas. The SVG needs explicit width and height (Safari and Firefox require it). */

/** Decodes an SVG string into an image the canvas can draw. */
export function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The browser could not draw this frame.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      c.toBlob(b => (b ? resolve(b) : reject(new Error('The browser could not encode the PNG.'))), 'image/png');
    } catch (e) { reject(e instanceof Error ? e : new Error('PNG export failed.')); }
  });
}

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('This browser has no canvas support.');
  return { canvas, g };
}

export async function svgToPng(svg: string, w: number, h: number): Promise<Blob> {
  const img = await svgToImage(svg);
  const { canvas, g } = makeCanvas(w, h);
  g.drawImage(img, 0, 0, w, h);
  return canvasToPng(canvas);
}
