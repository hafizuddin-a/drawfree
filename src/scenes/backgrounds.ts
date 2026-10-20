/** pastel frame backgrounds. Character outlines are near-black, so keep these light. */
export const BGC: readonly string[] = ['#e7f3fd', '#ffffff', '#fff2d3', '#ffe6e2', '#e3f3e5', '#ece6ff', '#ffe9cf', '#dfe5ea', '#cfe3f5', '#f6f1e7'];
/** the swatches in the top bar */
export const BGS: readonly string[] = BGC.slice(0, 6);
export const DEFAULT_BG = BGC[0];

/** perceived brightness 0..1 of a #rrggbb colour */
export const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
};
