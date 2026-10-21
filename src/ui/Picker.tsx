import { type KeyboardEvent, type MouseEvent, type ReactNode, memo, useDeferredValue, useMemo, useRef } from 'react';
import type { Character, PartInfo } from '../types';
import { charTarget, currentFrame, selectedItem, useEditor } from '../state/store';
import { SECS, SEARCHABLE, TABS, isListSection, type ColorSection, type ListSection, type SectionId } from './sections';
import { lookKey, thumbSrc } from './thumbs';
import { Icon } from './icons';
import { Tabs } from './Tabs';
import styles from './Picker.module.css';

interface ThumbProps { sec: SectionId; id: string; name: string; src: string; on: boolean; tabIndex: 0 | -1; onPick: (e: MouseEvent<HTMLButtonElement>) => void }
const Thumb = memo(function Thumb({ sec, id, name, src, on, tabIndex, onPick }: ThumbProps) {
  return (
    <button type="button" className={`${styles.th} ${on ? styles.on : ''}`} data-sec={sec} data-id={id} title={name} aria-label={name}
      aria-pressed={on} tabIndex={tabIndex} onClick={onPick}>
      <img src={src} alt="" draggable={false} />
    </button>
  );
});

/** Roving-tabindex grid: one tab stop, arrow keys move between thumbnails, Home and End jump. Enter applies (it is a button). */
function Grid({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || !ref.current) return;
    const btns = [...ref.current.querySelectorAll<HTMLButtonElement>('button')];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const cols = btns.filter(b => b.offsetTop === btns[0].offsetTop).length || 1;
    const to = { ArrowLeft: i - 1, ArrowRight: i + 1, ArrowUp: i - cols, ArrowDown: i + cols, Home: 0, End: btns.length - 1 }[e.key] ?? i;
    e.preventDefault();
    btns[Math.max(0, Math.min(btns.length - 1, to))].focus();
  };
  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    ref.current?.querySelectorAll<HTMLButtonElement>('button').forEach(b => { b.tabIndex = b === (e.target as Element) ? 0 : -1; });
  };
  // biome-ignore lint/a11y/useSemanticElements: a fieldset is not a dependable CSS grid container. The group delegates arrow keys from the buttons inside it (roving tabindex).
  return <div ref={ref} role="group" aria-label={label} data-roving className={`${styles.grid} ${wide ? styles.wide : ''}`} onKeyDown={onKeyDown} onFocus={onFocus}>{children}</div>;
}

function pick(e: MouseEvent<HTMLButtonElement>): void {
  const sec = SECS[e.currentTarget.dataset.sec as SectionId], id = e.currentTarget.dataset.id ?? '', st = useEditor.getState();
  if (!isListSection(sec)) return;
  if (sec.kind === 'props') st.addProp(id);
  else if (sec.kind === 'scene') st.setScene(id);
  else st.applyPart(sec.slot, id);
}

interface Ctx { base: Character | null; baseKey: string; bg: string; scene: string }

/** `items` is the whole list, or the search hits. Scenes are wide 16:9 tiles except in search results. */
function ThumbSection({ sec, ctx, items, wide }: { sec: ListSection; ctx: Ctx; items: readonly PartInfo[]; wide?: boolean }) {
  const onFlags = items.map(o => sec.kind === 'scene' ? (ctx.scene || 'none') === o.id : sec.kind === 'part' && ctx.base !== null && ctx.base[sec.slot] === o.id);
  const anyOn = onFlags.some(Boolean);
  return (
    <>
      <h3>{sec.title}</h3>
      <Grid label={sec.title} wide={wide}>
        {items.map((o, i) => (
          <Thumb key={o.id} sec={sec.id} id={o.id} name={o.name} src={thumbSrc(sec, o, ctx.base, ctx.baseKey, ctx.bg)} on={onFlags[i]}
            tabIndex={onFlags[i] || (!anyOn && i === 0) ? 0 : -1} onPick={pick} />
        ))}
      </Grid>
    </>
  );
}

function Swatches({ sec, ctx }: { sec: ColorSection; ctx: Ctx }) {
  return (
    <>
      <h3>{sec.title}</h3>
      <div className={styles.swatches}>
        {sec.colors.map(col => {
          const on = sec.kind === 'bg' ? ctx.bg === col : ctx.base !== null && ctx.base[sec.slot] === col;
          return (
            <button key={col} type="button" className={`${styles.sw} ${on ? styles.on : ''}`} style={{ background: col }}
              aria-label={`Colour ${col}`} aria-pressed={on} title={col}
              onClick={() => { const st = useEditor.getState(); if (sec.kind === 'bg') st.setBg(col); else st.applyColor(sec.slot, col); }} />
          );
        })}
      </div>
    </>
  );
}

export function Picker() {
  const q = useEditor(s => s.q), tab = useEditor(s => s.tab), setQuery = useEditor(s => s.setQuery);
  const liveBase = useEditor(charTarget), bg = useEditor(s => currentFrame(s).bg), scene = useEditor(s => currentFrame(s).scene);
  const sel = useEditor(selectedItem);
  useEditor(s => s.art);   // redraw the thumbnails once the Open Peeps body art arrives
  // the picker lags behind a drag: it only needs to catch up when the pointer settles
  const base = useDeferredValue(liveBase);
  const baseKey = useMemo(() => (base ? lookKey(base) : ''), [base]);
  const ctx: Ctx = { base, baseKey, bg, scene };

  const query = q.trim().toLowerCase();
  let body: ReactNode;
  if (query) {
    const matches = (o: PartInfo) => (o.name + ' ' + o.tags.join(' ')).toLowerCase().includes(query);
    const groups = SEARCHABLE.map(sec => ({ sec, hits: sec.list.filter(matches) })).filter(g => g.hits.length);
    body = groups.length
      ? groups.map(g => <ThumbSection key={g.sec.id} sec={g.sec} ctx={ctx} items={g.hits} />)
      : <div className={styles.empty}>Nothing matches “{q.trim()}”.</div>;
  } else {
    const cur = TABS.find(t => t.id === tab) ?? TABS[0];
    body = (
      <>
        {!base && tab !== 'props' && tab !== 'scene' && <p className={styles.hint}>Click a character on the board to dress it.</p>}
        {tab === 'body' && <p className={styles.hint}>Each body comes in its own pose. Pick the one closest to the moment; Flip turns it to face the other way.</p>}
        {tab === 'tops' && <p className={styles.hint}>Waist-up characters, cropped at the chest: good for close-ups and conversations. Colours are in the Clothes tab.</p>}
        {tab === 'props' && sel && sel.kind === 'prop' && sel.prop === 'bubble' && <BubbleText text={sel.text ?? ''} />}
        {cur.secs.map(id => {
          const sec = SECS[id];
          return isListSection(sec) ? <ThumbSection key={id} sec={sec} ctx={ctx} items={sec.list} wide={sec.kind === 'scene'} /> : <Swatches key={id} sec={sec} ctx={ctx} />;
        })}
      </>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Parts">
      <div className={styles.search}>
        <Icon name="search" />
        <input id="q" type="search" placeholder="Search parts" aria-label="Search parts" autoComplete="off" value={q} onChange={e => setQuery(e.target.value)} />
      </div>
      <Tabs />
      {/* keyed by tab: a new tab starts scrolled to the top */}
      <div key={tab} className={styles.scroll}>{body}</div>
    </aside>
  );
}

function BubbleText({ text }: { text: string }) {
  const beginTextEdit = useEditor(s => s.beginTextEdit), setBubbleText = useEditor(s => s.setBubbleText);
  return (
    <>
      <h3>Bubble text</h3>
      <input className={styles.field} type="text" value={text} aria-label="Bubble text" autoComplete="off" onFocus={beginTextEdit} onChange={e => setBubbleText(e.target.value)} />
    </>
  );
}
