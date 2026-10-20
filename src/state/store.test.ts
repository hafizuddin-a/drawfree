import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_HISTORY } from './history';
import { charTarget, currentFrame, resetEditorStore, selectedItem, useEditor } from './store';
import { fk } from '../rig/ik';
import { LIMBS } from '../rig/geometry';
import { rig } from '../rig/poses';
import type { Character } from '../types';

const st = () => useEditor.getState();
const chars = () => currentFrame(st()).items.filter((i): i is Character => i.kind === 'char');
const firstChar = () => chars()[0];

beforeEach(() => resetEditorStore());

describe('seed and selectors', () => {
  it('starts with two characters, a bubble and a plant in a café', () => {
    const f = currentFrame(st());
    expect(f.items.map(i => i.kind === 'char' ? 'char' : (i as { prop: string }).prop)).toEqual(['char', 'char', 'bubble', 'plant']);
    expect(f.scene).toBe('cafe');
  });
  it('charTarget is the selected character, or the only character, else none', () => {
    expect(charTarget(st())).toBeNull();                         // two characters, nothing selected
    st().select(firstChar().id);
    expect(charTarget(st())?.id).toBe(firstChar().id);
    st().select(null);
    st().select(currentFrame(st()).items[2].id);                 // a prop is selected: still ambiguous
    expect(charTarget(st())).toBeNull();
    st().select(firstChar().id); st().act('del'); st().select(null);
    expect(charTarget(st())?.id).toBe(chars()[0].id);            // one character left: it is the target
  });
});

describe('history', () => {
  it('snap, undo and redo restore frames', () => {
    st().select(firstChar().id);
    st().applyPart('hair', 'curly');
    expect(firstChar().hair).toBe('curly');
    st().undo(); expect(firstChar().hair).not.toBe('curly');
    st().redo(); expect(firstChar().hair).toBe('curly');
  });
  it('a new edit clears the redo stack', () => {
    st().select(firstChar().id);
    st().applyPart('hair', 'curly'); st().undo();
    expect(st().future).toHaveLength(1);
    st().applyPart('hair', 'bun');
    expect(st().future).toHaveLength(0);
  });
  it('moving without snap leaves no history, and patchItem alone never snaps', () => {
    st().patchItem(firstChar().id, { x: 10 });
    expect(st().past).toHaveLength(0);
  });
  it('keeps at most MAX_HISTORY steps', () => {
    st().select(firstChar().id);
    for (let i = 0; i < MAX_HISTORY + 20; i++) st().nudge(1, 0);
    expect(st().past).toHaveLength(MAX_HISTORY);
  });
  it('undo drops a selection whose item no longer exists', () => {
    st().addChar();
    const id = st().sel as string;
    st().undo();
    expect(st().sel).toBeNull(); expect(selectedItem(st())).toBeNull();
    st().redo(); expect(currentFrame(st()).items.some(i => i.id === id)).toBe(true);
  });
  it('undo and redo do nothing when there is nothing to do', () => {
    const before = st().frames;
    st().undo(); st().redo();
    expect(st().frames).toBe(before);
  });
});

describe('immutability: untouched items and frames keep their identity', () => {
  it('editing one character leaves the other items and frames the same objects', () => {
    st().addFrame(); st().selectFrame(0);
    const [a, b, bubble, plant] = currentFrame(st()).items, otherFrame = st().frames[1];
    st().select(a.id); st().applyPart('hair', 'curly');
    const f = currentFrame(st());
    expect(f.items[0]).not.toBe(a);
    expect(f.items[1]).toBe(b); expect(f.items[2]).toBe(bubble); expect(f.items[3]).toBe(plant);
    expect(st().frames[1]).toBe(otherFrame);
  });
  it('past snapshots are not changed by later edits', () => {
    st().select(firstChar().id); st().applyPart('hair', 'curly');
    const snap = st().past[0].frames[0].items[0] as Character, hair = snap.hair;
    st().applyPart('hair', 'bun'); st().nudge(5, 5);
    expect(snap.hair).toBe(hair);
  });
});

describe('dressing and posing', () => {
  it('asks for a selection when two characters are on the board', () => {
    st().applyPart('hair', 'curly');
    expect(st().toast?.msg).toMatch(/Click a character/);
    expect(st().past).toHaveLength(0);
  });
  it('applies to the only character without selecting it first', () => {
    st().select(firstChar().id); st().act('del'); st().select(null);
    st().applyColor('topC', '#ff9a4d');
    expect(chars()[0].topC).toBe('#ff9a4d'); expect(st().sel).toBe(chars()[0].id);
  });
  it('applies a preset pose', () => {
    st().select(firstChar().id); st().applyPose('cheer');
    expect(Math.round(firstChar().pose.aL[0])).toBe(-148);
  });
  it('flipBend keeps the hand where it was and flips the sign', () => {
    const c = firstChar(), before = rig(c).aR[2];
    st().flipBend(c.id, 'aR');
    const n = firstChar(), after = fk(LIMBS.aR[0], LIMBS.aR[1], LIMBS.aR[2], n.pose.aR[0], n.pose.aR[1])[2];
    expect(n.pose.aR[2]).toBe(-c.pose.aR[2]);
    expect(Math.hypot(after[0] - before[0], after[1] - before[1])).toBeLessThan(0.01);
    expect(st().past).toHaveLength(1);
  });
  it('shuffle adds a character on an empty board, and asks for a click when several exist', () => {
    st().shuffle(); expect(st().toast?.msg).toMatch(/Click a character first/);
    chars().forEach(c => { st().select(c.id); st().act('del'); });
    st().shuffle(); expect(chars()).toHaveLength(1);
  });
  it('shuffle changes the look of the selected character only', () => {
    st().select(firstChar().id);
    const other = chars()[1];
    st().shuffle();
    expect(chars()[1]).toBe(other);
  });
});

describe('item actions', () => {
  it('flip, duplicate, bring to front and delete', () => {
    const a = firstChar();
    st().select(a.id);
    st().act('flip'); expect(firstChar().flip).toBe(!a.flip);
    st().act('dup');
    const items = currentFrame(st()).items;
    expect(items).toHaveLength(5); expect(items[4].x).toBe(a.x + 40); expect(items[4].id).not.toBe(a.id); expect(st().sel).toBe(items[4].id);
    st().select(a.id); st().act('front');
    expect(currentFrame(st()).items.at(-1)?.id).toBe(a.id);
    st().act('del');
    expect(currentFrame(st()).items.some(i => i.id === a.id)).toBe(false); expect(st().sel).toBeNull();
  });
  it('duplicating a character copies it deeply', () => {
    st().select(firstChar().id); st().act('dup');
    const copy = chars().at(-1) as Character;
    copy.pose.aR[0] += 1;                                        // would corrupt the original if it were shared
    expect(chars()[0].pose.aR[0]).not.toBe(copy.pose.aR[0]);
  });
  it('the pose toggle opens the Pose tab and clears search without making history', () => {
    st().select(firstChar().id); st().setQuery('x');
    st().act('pose');
    expect(st().pose).toBe(true); expect(st().tab).toBe('pose'); expect(st().q).toBe(''); expect(st().past).toHaveLength(0);
    st().act('pose'); expect(st().pose).toBe(false);
  });
  it('nudge, rotate and reset rotation', () => {
    const a = firstChar(); st().select(a.id);
    st().nudge(4, -4); expect(firstChar().x).toBe(a.x + 4); expect(firstChar().y).toBe(a.y - 4);
    st().rotateBy(5); st().rotateBy(15); expect(firstChar().r).toBe(20);
    st().resetRotation(); expect(firstChar().r).toBe(0);
  });
  it('props: add a speech bubble with default text, edit its text as one undo step', () => {
    st().addProp('bubble');
    const p = selectedItem(st());
    expect(p).toMatchObject({ kind: 'prop', prop: 'bubble', y: 118, text: 'Morning! Ready to shoot?' });
    const steps = st().past.length;
    st().beginTextEdit(); st().setBubbleText('H'); st().setBubbleText('Hi'); st().setBubbleText('Hi!');
    expect(st().past).toHaveLength(steps + 1);
    expect(selectedItem(st())).toMatchObject({ text: 'Hi!' });
    st().undo(); expect(selectedItem(st())).toMatchObject({ text: 'Morning! Ready to shoot?' });
  });
});

describe('frames', () => {
  it('a new frame copies the scene and background but not the items or note', () => {
    st().addFrame();
    expect(st().fi).toBe(1);
    expect(currentFrame(st())).toMatchObject({ scene: 'cafe', bg: '#e7f3fd', note: '', items: [] });
  });
  it('duplicating gives every item a new id and inserts after the current frame', () => {
    const ids = currentFrame(st()).items.map(i => i.id);
    st().dupFrame();
    expect(st().fi).toBe(1); expect(st().frames).toHaveLength(2);
    expect(currentFrame(st()).items.map(i => i.id).some(id => ids.includes(id))).toBe(false);
    expect(currentFrame(st()).items).toHaveLength(4);
  });
  it('delete keeps at least one frame and moves back', () => {
    st().delFrame(); expect(st().frames).toHaveLength(1);
    st().addFrame(); st().addFrame(); st().delFrame();
    expect(st().frames).toHaveLength(2); expect(st().fi).toBe(1);
  });
  it('selecting a frame clears the selection without making history', () => {
    st().addFrame(); const n = st().past.length;
    st().select(null); st().selectFrame(0);
    expect(st().past).toHaveLength(n);
  });
  it('scene, background and note', () => {
    st().setScene('park'); st().setBg('#ffe6e2'); st().setNote('Hello');
    expect(currentFrame(st())).toMatchObject({ scene: 'park', bg: '#ffe6e2', note: 'Hello' });
    expect(st().past).toHaveLength(2);                           // the note is typed text: no snapshot per keystroke
  });
});

describe('reordering frames', () => {
  const names = () => st().frames.map(f => f.note);
  const three = () => {
    st().setNote('A'); st().addFrame(); st().setNote('B'); st().addFrame(); st().setNote('C');
    st().selectFrame(0);
  };
  it('moves a frame to a new position', () => {
    three();
    st().moveFrame(0, 2); expect(names()).toEqual(['B', 'C', 'A']);
    st().moveFrame(2, 1); expect(names()).toEqual(['B', 'A', 'C']);
  });
  it('the current frame stays current wherever it moves', () => {
    three(); st().selectFrame(1);
    st().moveFrame(0, 2);                                        // B was at 1 and shifts to 0
    expect(currentFrame(st()).note).toBe('B'); expect(st().fi).toBe(0);
    st().moveFrame(0, 1); expect(currentFrame(st()).note).toBe('B'); expect(st().fi).toBe(1);
  });
  it('keeps the selected item when the current frame moves', () => {
    three(); st().selectFrame(0);
    const id = firstChar().id; st().select(id);
    st().moveFrame(0, 2);
    expect(st().sel).toBe(id); expect(st().fi).toBe(2);
  });
  it('is one undo step, and ignores moves that change nothing', () => {
    three(); const steps = st().past.length;
    st().moveFrame(1, 1); st().moveFrame(-1, 0); st().moveFrame(0, 3); st().moveFrame(0.5, 1); st().moveFrame(Number.NaN, 0);
    expect(st().past).toHaveLength(steps); expect(names()).toEqual(['A', 'B', 'C']);
    st().moveFrame(0, 1); expect(st().past).toHaveLength(steps + 1);
    st().undo(); expect(names()).toEqual(['A', 'B', 'C']);
    st().redo(); expect(names()).toEqual(['B', 'A', 'C']);
  });
  it('reuses the frame objects, so unchanged thumbnails are not redrawn', () => {
    three(); const [a, b, c] = st().frames;
    st().moveFrame(0, 2);
    expect(st().frames[0]).toBe(b); expect(st().frames[1]).toBe(c); expect(st().frames[2]).toBe(a);
  });
  it('announces the move', () => {
    three(); st().moveFrame(0, 2);
    expect(st().toast?.msg).toBe('Frame moved to position 3');
  });
});

describe('projects', () => {
  it('loading a project replaces everything and is one undo step', () => {
    const before = st().frames;
    st().loadProject({ name: 'Opened', aspect: '16:9', frames: [{ id: 'z', bg: '#ffffff', scene: 'none', note: '', items: [] }] });
    expect(st().name).toBe('Opened'); expect(st().frames).toHaveLength(1);
    st().undo(); expect(st().frames).toBe(before);
  });
  it('reset restores the seed and the default name, undoably', () => {
    st().setName('Mine'); st().reset();
    expect(st().name).toBe('Untitled storyboard'); expect(currentFrame(st()).items).toHaveLength(4);
    st().undo(); expect(st().frames).toHaveLength(1);
  });
  it('setName cleans the name', () => {
    st().setName('  A\u0000B  '); expect(st().name).toBe('AB');
    st().setName('   '); expect(st().name).toBe('Untitled storyboard');
  });
});
