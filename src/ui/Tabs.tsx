import { useEditor } from '../state/store';
import { TABS } from './sections';
import { Icon, type IconName } from './icons';
import styles from './Picker.module.css';

export function Tabs() {
  const tab = useEditor(s => s.tab), q = useEditor(s => s.q), setTab = useEditor(s => s.setTab);
  return (
    <nav className={styles.tabs} role="tablist" aria-label="Part categories">
      {TABS.map(t => {
        const on = t.id === tab && !q;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} aria-label={t.label} title={t.label}
            className={`${styles.tab} ${on ? styles.on : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.id as IconName} />
          </button>
        );
      })}
    </nav>
  );
}
