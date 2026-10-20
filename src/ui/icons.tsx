import { svgMarkup } from './markup';

/* Icon paths are static strings in this file, so they are injected as markup. */
const ICONS = {
  hair: '<path d="M6 20v-8a6 6 0 0112 0v8"/><path d="M8.5 11.5c3 0 5-1.4 6.5-3.5"/>',
  face: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10v1.4M15 10v1.4"/><path d="M8.8 14.5c1.8 2 4.6 2 6.4 0"/>',
  top: '<path d="M8.5 4L3 7l2 4.2 3-1V20h8V10.2l3 1L21 7l-5.5-3a3.6 3.6 0 01-7 0z"/>',
  bottom: '<path d="M7 3h10l1.2 18h-4.4L12 12.5 10.2 21H5.8z"/>',
  shoes: '<path d="M3 17c3.2 0 4.6-3 4.6-7.5h4V12c0 2 1.8 3.2 4 3.8l5.4 1.2V20H3z"/>',
  extras: '<circle cx="7" cy="14" r="3.6"/><circle cx="17" cy="14" r="3.6"/><path d="M10.6 14h2.8M3.4 14L5 8M20.6 14L19 8"/>',
  pose: '<circle cx="12" cy="5" r="2.4"/><path d="M12 8v7M12 10.5l-5 3M12 10.5l5 3M12 15l-3.4 5.5M12 15l3.4 5.5"/>',
  props: '<path d="M4 5h16v11h-9l-4 4v-4H4z"/>',
  scene: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 5"/><circle cx="16.5" cy="8.5" r="1.6"/>',
  flip: '<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M8 7L3 12l5 5z"/><path d="M16 7l5 5-5 5z"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8"/>',
  front: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  brand: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="10.5" r="2.6"/><path d="M7.5 20c.6-3 2.3-4.6 4.5-4.6s3.9 1.6 4.5 4.6"/>'
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...svgMarkup(ICONS[name])} />;
}
