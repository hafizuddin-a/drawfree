import { canFlip, isPosable } from '../rig/renderCharacter';
import type { Item } from '../types';
import { useEditor, type ItemAction } from '../state/store';
import { Icon, type IconName } from './icons';
import styles from '../editor/Editor.module.css';

interface Props { item: Item; /** how many items are selected */ count: number; left: number; top: number }

/** The floating vertical toolbar beside the selection box. */
export function Toolbar({ item, count, left, top }: Props) {
  const act = useEditor(s => s.act), pose = useEditor(s => s.pose);
  const btn = (a: ItemAction, icon: IconName, label: string, title: string, pressed?: boolean) => (
    <button key={a} type="button" aria-label={label} title={title} aria-pressed={pressed} className={pressed ? styles.on : undefined} onClick={() => act(a)}>
      <Icon name={icon} />
    </button>
  );
  return (
    <div className={styles.tb} style={{ left, top }} role="toolbar" aria-label={count > 1 ? `${count} items selected` : 'Selected item'} aria-orientation="vertical">
      {item.kind === 'char' && count === 1 && isPosable(item) && btn('pose', 'pose', 'Pose', 'Pose: drag hands and feet', pose)}
      {(canFlip(item) || count > 1) && btn('flip', 'flip', 'Flip', 'Flip to face the other way (F)')}
      {btn('dup', 'dup', 'Duplicate', 'Duplicate')}
      {btn('front', 'front', 'Bring to front', 'Bring to front')}
      {btn('del', 'del', 'Delete', 'Delete')}
    </div>
  );
}
