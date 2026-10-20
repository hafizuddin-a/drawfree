import { useRef } from 'react';
import { Button } from './Button';
import { Dialog, dialogActions } from './Dialog';

/** Shown when the browser blocks the clipboard: the SVG source, selected, ready to copy by hand. */
export function CopyDialog({ svg, onClose }: { svg: string; onClose: () => void }) {
  const area = useRef<HTMLTextAreaElement>(null);
  return (
    <Dialog onClose={onClose} label="SVG source" initialFocus={area}>
      <strong>Copy blocked by the browser. Select all and copy:</strong>
      <textarea ref={area} readOnly value={svg} aria-label="SVG source" onFocus={e => e.currentTarget.select()} />
      <div className={dialogActions}><Button primary onClick={onClose}>Close</Button></div>
    </Dialog>
  );
}
