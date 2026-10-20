import { useEffect } from 'react';
import { selectedItem, useEditor } from '../state/store';

/** Global shortcuts. Typing in a field is never intercepted, except Ctrl/Cmd+S and +O. */
export function useKeyboard(handlers: { save: () => void; open: () => void }): void {
  const { save, open } = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement, tag = (el.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea';
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase(), st = useEditor.getState();
      if (mod && !e.shiftKey && !e.altKey && (k === 's' || k === 'o')) { e.preventDefault(); if (k === 's') save(); else open(); return; }
      if (typing) return;
      if (e.key === '/' && !mod) { e.preventDefault(); document.getElementById('q')?.focus(); return; }
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); st.redo(); return; }
      const it = selectedItem(st);
      if (!it) return;
      // Ctrl/Cmd+D duplicates (and stops the browser bookmarking the page)
      if (mod && k === 'd' && !e.shiftKey && !e.altKey) { e.preventDefault(); st.act('dup'); return; }
      if (mod) return;
      // Alt+] brings to front. Checked before the plain bracket keys, which rotate.
      if (e.altKey && e.code === 'BracketRight') { e.preventDefault(); st.act('front'); return; }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); st.act('del'); }
      else if (k === 'escape') st.select(null);
      else if (k === 'f') st.act('flip');
      else if (e.key === '+' || e.key === '=') st.scaleBy(1.05);
      else if (e.key === '-' || e.key === '_') st.scaleBy(1 / 1.05);
      else if (e.code === 'BracketLeft' || e.code === 'BracketRight') st.rotateBy((e.code === 'BracketRight' ? 1 : -1) * (e.shiftKey ? 15 : 5));
      else if (k.startsWith('arrow') && !el.closest?.('[data-roving],[role="tablist"],[role="dialog"]')) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        st.nudge(k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, open]);
}

