import { type ReactNode, useEffect, useRef } from 'react';
import styles from './Dialog.module.css';

interface Props {
  onClose: () => void;
  /** accessible name: a heading id, or a plain label */
  labelledBy?: string;
  label?: string;
  narrow?: boolean;
  children: ReactNode;
}

const FOCUSABLE = 'input,button,textarea,select,[href],[tabindex]:not([tabindex="-1"])';

/** A modal dialog: focus moves in, Tab stays inside, Esc and a click on the backdrop close it, focus returns to the opener. */
export function Dialog({ onClose, labelledBy, label, narrow, children }: Props) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // focus the element marked data-autofocus, else the first focusable one
    (card.current?.querySelector<HTMLElement>('[data-autofocus]') ?? card.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
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
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop click and the dialog's key handling are conveniences; every action has a button, and Esc closes it
    <div role="presentation" className={styles.modal} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={onKeyDown}>
      <div ref={card} className={`${styles.card} ${narrow ? styles.narrow : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={label}>
        {children}
      </div>
    </div>
  );
}
export const dialogActions = styles.actions;
