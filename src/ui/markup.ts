/** Props that fill an element with an SVG string.
 *  Only pass strings built by the pure part, rig and scene functions: they escape all user text with esc().
 *  Never pass user input, file contents or anything else that was not drawn by our own code. */
export const svgMarkup = (html: string) => ({ dangerouslySetInnerHTML: { __html: html } });
