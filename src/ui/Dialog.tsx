import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import styles from './Dialog.module.css';

interface Props {
  onClose: () => void;
  /** accessible name: a heading id, or a plain label */
  labelledBy?: string;
  label?: string;
  narrow?: boolean;
  /** element to focus on open; defaults to the first focusable one */
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const FOCUSABLE = 'input,button,textarea,select,[href],[tabindex]:not([tabindex="-1"])';

/** A modal dialog: focus moves in, Tab stays inside, Esc and a click on the backdrop close it, focus returns to the opener. */
export function Dialog({ onClose, labelledBy, label, narrow, initialFocus, children }: Props) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    (initialFocus?.current ?? card.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => { if (opener && opener.isConnected) opener.focus(); };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !card.current) return;
    const items = [...card.current.querySelectorAll<HTMLInputElement>(FOCUSABLE)]
      .filter(el => !el.matches(':disabled') && !el.hidden && (el.type !== 'radio' || el.checked));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className={styles.modal} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={onKeyDown}>
      <div ref={card} className={`${styles.card} ${narrow ? styles.narrow : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={label}>
        {children}
      </div>
    </div>
  );
}
export const dialogActions = styles.actions;
