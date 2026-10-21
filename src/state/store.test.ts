import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_HISTORY } from './history';
import { NEW_BODY, charTarget, currentFrame, resetEditorStore, selectedIds, selectedItem, selectedItems, useEditor } from './store';
import { BODIES } from '../parts';
import { fk } from '../rig/ik';
import { limbsOf } from '../rig/geometry';
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
    expect(Math.round(firstChar().pose.aL[0])).toBe(-115);
  });
  it('flipBend keeps the hand where it was and flips the sign', () => {
    const c = firstChar(), before = rig(c).aR[2];
    st().flipBend(c.id, 'aR');
    const n = firstChar(), L = limbsOf(n).aR, after = fk(L.o, L.l1, L.l2, n.pose.aR[0], n.pose.aR[1])[2];
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

describe('bodies', () => {
  const kindOf = (id: string) => BODIES.find(b => b.id === id)?.kind;
  it('the seed has a posable figure and an Open Peeps body; new characters get an Open Peeps body', () => {
    expect(chars().map(c => kindOf(c.body))).toEqual(['rig', 'stand']);
    st().addChar();
    expect(chars()[2].body).toBe(NEW_BODY); expect(kindOf(NEW_BODY)).toBe('stand');
  });
  it('picking an Open Peeps body turns pose mode off; a preset pose switches back to the posable figure', () => {
    st().select(firstChar().id); st().act('pose');
    expect(st().pose).toBe(true);
    st().applyPart('body', 'sit-bike');
    expect(firstChar().body).toBe('sit-bike'); expect(st().pose).toBe(false);
    st().applyPose('wave');
    expect(firstChar().body).toBe('rig');
  });
  it('shuffle keeps the kind of body: the figure stays a figure, a waist-up body stays waist up', () => {
    st().select(firstChar().id);
    for (let i = 0; i < 5; i++) { st().shuffle(); expect(firstChar().body).toBe('rig'); }
    st().applyPart('body', 'bust-hoodie');
    for (let i = 0; i < 5; i++) { st().shuffle(); expect(kindOf(firstChar().body)).toBe('bust'); }
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
  it('the pose toggle opens the Body tab (where the preset poses are) and clears search without making history', () => {
    st().select(firstChar().id); st().setQuery('x');
    st().act('pose');
    expect(st().pose).toBe(true); expect(st().tab).toBe('body'); expect(st().q).toBe(''); expect(st().past).toHaveLength(0);
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

describe('multi-select', () => {
  const ids = () => currentFrame(st()).items.map(i => i.id);
  const [A, B, BUBBLE] = [0, 1, 2];
  it('toggling adds an item, removes it again, and promotes another item when the primary is removed', () => {
    st().select(ids()[A]);
    st().toggleSelect(ids()[B]); expect(selectedIds(st())).toEqual([ids()[A], ids()[B]]);
    st().toggleSelect(ids()[BUBBLE]); expect(selectedIds(st())).toHaveLength(3);
    st().toggleSelect(ids()[A]);                                              // the primary leaves: the next one takes over
    expect(st().sel).toBe(ids()[B]); expect(selectedIds(st())).toEqual([ids()[B], ids()[BUBBLE]]);
    st().toggleSelect(ids()[B]); st().toggleSelect(ids()[BUBBLE]); expect(st().sel).toBeNull(); expect(st().extra).toEqual([]);
  });
  it('toggling with nothing selected selects the item', () => { st().toggleSelect(ids()[B]); expect(st().sel).toBe(ids()[B]); expect(st().extra).toEqual([]); });
  it('plain select replaces a group; selectMany and selectAll set exactly what they are given', () => {
    st().selectMany([ids()[A], ids()[B]]); expect(st().extra).toEqual([ids()[B]]);
    st().select(ids()[BUBBLE]); expect(selectedIds(st())).toEqual([ids()[BUBBLE]]);
    st().selectAll(); expect(selectedIds(st())).toEqual(ids());
    st().selectMany([]); expect(st().sel).toBeNull();
  });
  it('selectedItems comes back in z-order, whatever order they were picked in', () => {
    st().selectMany([ids()[BUBBLE], ids()[A]]);
    expect(selectedItems(st()).map(i => i.id)).toEqual([ids()[A], ids()[BUBBLE]]);
  });
  it('nudge, rotate and scale act on every selected item, each as one undo step', () => {
    const [a, b, bubble] = currentFrame(st()).items;
    st().selectMany([a.id, b.id]);
    const steps = st().past.length;
    st().nudge(10, 5); st().rotateBy(15); st().scaleBy(1.1);
    const [a2, b2, bubble2] = currentFrame(st()).items;
    expect([a2.x, a2.y, a2.r]).toEqual([a.x + 10, a.y + 5, 15]); expect([b2.x, b2.y, b2.r]).toEqual([b.x + 10, b.y + 5, 15]);
    expect(a2.s).toBeCloseTo(a.s * 1.1, 5); expect(b2.s).toBeCloseTo(b.s * 1.1, 5);
    expect(bubble2).toBe(bubble);                                             // an unselected item is untouched (same object)
    expect(st().past).toHaveLength(steps + 3);
    st().undo(); st().undo(); st().undo(); expect(currentFrame(st()).items[0].x).toBe(a.x);
  });
  it('scaling a group makes no undo step once every item is at its limit', () => {
    st().selectMany([ids()[A], ids()[B]]);
    for (let i = 0; i < 80; i++) st().scaleBy(1.2);
    const steps = st().past.length; st().scaleBy(1.2); expect(st().past).toHaveLength(steps);
  });
  it('flip turns each flippable item and leaves speech bubbles alone', () => {
    const [a, , bubble] = currentFrame(st()).items;
    st().selectMany([ids()[A], ids()[BUBBLE]]); st().act('flip');
    const [a2, , bubble2] = currentFrame(st()).items;
    expect(a2.flip).toBe(!a.flip); expect(bubble2.flip).toBe(bubble.flip);
  });
  it('duplicate copies the whole group, offsets it, and selects the copies', () => {
    st().selectMany([ids()[A], ids()[B]]); st().act('dup');
    const all = currentFrame(st()).items;
    expect(all).toHaveLength(6); expect(selectedIds(st())).toEqual([all[4].id, all[5].id]);
    expect(all[4].x).toBe(all[0].x + 40); expect(all[5].x).toBe(all[1].x + 40);
    expect(new Set(all.map(i => i.id)).size).toBe(6);
  });
  it('bring to front keeps the selected items in their own order at the end', () => {
    st().selectMany([ids()[A], ids()[B]]); const [a, b, bubble, plant] = currentFrame(st()).items; st().act('front');
    expect(currentFrame(st()).items.map(i => i.id)).toEqual([bubble.id, plant.id, a.id, b.id]);
  });
  it('delete removes the whole group and clears the selection', () => {
    st().selectMany([ids()[A], ids()[B]]); st().act('del');
    expect(currentFrame(st()).items).toHaveLength(2); expect(st().sel).toBeNull(); expect(st().extra).toEqual([]);
    st().undo(); expect(currentFrame(st()).items).toHaveLength(4);
  });
  it('the picker edits every selected character at once, as one undo step', () => {
    st().selectMany([ids()[A], ids()[B]]); const steps = st().past.length;
    st().applyPart('hair', 'curly');
    const [a, b] = currentFrame(st()).items as Character[];
    expect([a.hair, b.hair]).toEqual(['curly', 'curly']); expect(st().past).toHaveLength(steps + 1);
    st().applyColor('topC', '#ff9a4d'); expect([(currentFrame(st()).items[0] as Character).topC, (currentFrame(st()).items[1] as Character).topC]).toEqual(['#ff9a4d', '#ff9a4d']);
  });
  it('pose mode works on the primary character only, and the toggle needs a selection', () => {
    st().act('pose'); expect(st().pose).toBe(false);
    st().selectMany([ids()[A], ids()[B]]); st().act('pose'); expect(st().pose).toBe(true);
  });
  it('changing frame, opening a project and undoing past a deleted item all clean up the selection', () => {
    st().selectMany([ids()[A], ids()[B]]); st().addFrame(); expect(st().extra).toEqual([]); expect(st().sel).toBeNull();
    st().selectFrame(0); st().selectAll(); st().act('dup');                   // select the four copies... then undo the duplicate
    st().undo(); expect(selectedIds(st()).every(id => ids().includes(id))).toBe(true);
    st().selectMany([ids()[A], ids()[B]]);
    st().loadProject({ name: 'x', aspect: '16:9', frames: [{ id: 'z', bg: '#ffffff', scene: 'none', note: '', items: [] }] });
    expect(st().extra).toEqual([]);
  });
  it('a marquee can be set and cleared', () => {
    st().setMarquee({ x0: 1, y0: 2, x1: 3, y1: 4 }); expect(st().marquee).toEqual({ x0: 1, y0: 2, x1: 3, y1: 4 }); st().setMarquee(null); expect(st().marquee).toBeNull();
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
