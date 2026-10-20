import type { ExportOptions } from './frame';

const KEY = 'drawfree.export';
const DEFAULTS: ExportOptions = { fmt: 'png', scale: 2, transparent: false };

/** Remembered export choices. A per-viewer convenience: storage can be blocked, so every access is guarded. */
export function loadExportPrefs(): ExportOptions {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ExportOptions>;
    return {
      fmt: d.fmt === 'svg' ? 'svg' : 'png',
      scale: d.scale === 1 || d.scale === 3 ? d.scale : 2,
      transparent: d.transparent === true
    };
  } catch { return DEFAULTS; }
}
export function saveExportPrefs(o: ExportOptions): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage blocked */ }
}
