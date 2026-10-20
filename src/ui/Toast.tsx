import { useEffect, useState } from 'react';
import { useEditor } from '../state/store';
import styles from './Toast.module.css';

export function Toast() {
  const toast = useEditor(s => s.toast);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast.id);
    const t = setTimeout(() => setShown(null), toast.ms);
    return () => clearTimeout(t);
  }, [toast]);
  return <div className={styles.toast} role="status" aria-live="polite" hidden={!toast || shown !== toast.id}>{toast?.msg}</div>;
}
