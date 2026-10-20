import type { BoardOptions } from './board';
import type { ExportOptions } from './frame';

const KEY = 'drawfree.export';

export type Scope = 'frame' | 'board';
export interface ExportPrefs { scope: Scope; frame: ExportOptions; board: BoardOptions }

export const DEFAULT_PREFS: ExportPrefs = {
  scope: 'frame',
  frame: { fmt: 'png', scale: 2, transparent: false },
  board: {
    fmt: 'pdf',
    strip: { cols: 2, frameW: 720, notes: true },
    pdf: { size: 'a4', orientation: 'landscape', layout: 'one', notes: true }
  }
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const pick = <T,>(v: unknown, allowed: readonly T[], d: T): T => allowed.find(a => a === v) ?? d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

/** Reads remembered export choices, accepting only known values. A per-viewer convenience: storage can be blocked. */
export function loadExportPrefs(): ExportPrefs {
  try {
    const d = obj(JSON.parse(localStorage.getItem(KEY) ?? '{}')), f = obj(d.frame), b = obj(d.board), s = obj(b.strip), p = obj(b.pdf), D = DEFAULT_PREFS;
    return {
      scope: pick(d.scope, ['frame', 'board'] as const, D.scope),
      // the first version stored the frame options at the top level
      frame: {
        fmt: pick(f.fmt ?? d.fmt, ['png', 'svg'] as const, D.frame.fmt),
        scale: pick(f.scale ?? d.scale, [1, 2, 3] as const, D.frame.scale),
        transparent: bool(f.transparent ?? d.transparent, D.frame.transparent)
      },
      board: {
        fmt: pick(b.fmt, ['png', 'pdf'] as const, D.board.fmt),
        strip: { cols: pick(s.cols, [1, 2, 3, 4] as const, D.board.strip.cols), frameW: pick(s.frameW, [480, 720, 960] as const, D.board.strip.frameW), notes: bool(s.notes, true) },
        pdf: {
          size: pick(p.size, ['a4', 'letter'] as const, D.board.pdf.size), orientation: pick(p.orientation, ['landscape', 'portrait'] as const, D.board.pdf.orientation),
          layout: pick(p.layout, ['one', 'two', 'three'] as const, D.board.pdf.layout), notes: bool(p.notes, true)
        }
      }
    };
  } catch { return DEFAULT_PREFS; }
}
export function saveExportPrefs(o: ExportPrefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage blocked */ }
}
