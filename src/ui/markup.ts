/** Props that fill an element with an SVG string.
 *  Only pass strings built by the pure part, rig and scene functions: they escape all user text with esc().
 *  Never pass user input, file contents or anything else that was not drawn by our own code. */
/** A data URL for an <img>, from a complete SVG document string (it needs xmlns). Text inside an image is not in the
 *  page's DOM or accessibility tree, which suits thumbnails: they are pictures, named by their buttons. */
export const svgImgSrc = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const svgMarkup = (html: string) => ({ dangerouslySetInnerHTML: { __html: html } });
