/* SVG -> PNG through an <img> and a canvas. The SVG needs explicit width and height (Safari and Firefox require it). */
export function svgToPng(svg: string, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        if (!g) { reject(new Error('This browser has no canvas support.')); return; }
        g.drawImage(img, 0, 0, w, h);
        c.toBlob(b => (b ? resolve(b) : reject(new Error('The browser could not encode the PNG.'))), 'image/png');
      } catch (e) { reject(e instanceof Error ? e : new Error('PNG export failed.')); }
    };
    img.onerror = () => reject(new Error('The browser could not draw this frame.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
