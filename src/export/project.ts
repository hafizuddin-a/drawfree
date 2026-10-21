/* Project files (.drawfree.json): validate untrusted input, migrate by version, build file names. Pure data code. */
import type { Aspect, Character, ColorSlot, Frame, Item, LimbId, LimbPose, Pose, Project, Prop } from '../types';
import { PART_LISTS, PART_SLOTS, PROPS, hasPart } from '../parts';
import { XML_ILLEGAL } from '../parts/draw';
import { LIMB_IDS } from '../rig/geometry';
import { newCharacter } from '../rig/renderCharacter';
import { DEFAULT_BG } from '../scenes/backgrounds';
import { hasScene } from '../scenes/scenes';

export const PROJECT_VERSION = 2;
const ASPECTS: readonly Aspect[] = ['16:9', '4:3', '1:1', '9:16'];
export const DEFAULT_NAME = 'Untitled storyboard';
const MAX_FRAMES = 200, MAX_ITEMS = 200;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const COLOR_SLOTS: readonly ColorSlot[] = ['skin', 'hairC', 'topC', 'botC', 'shoeC', 'hatC'];

/** counts of values that had to be repaired or dropped while cleaning */
export interface Fixes { fixed: number; dropped: number }
export class ProjectError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const num = (v: unknown, d: number, lo = -1e5, hi = 1e5): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
/** drops characters XML 1.0 forbids so exported SVG always parses */
const cleanText = (v: unknown, max: number): string => (typeof v === 'string' ? v : '').replace(XML_ILLEGAL, '').slice(0, max);
const rid = (): string => 'i' + Math.random().toString(36).slice(2, 9);
export const cleanName = (v: unknown): string => cleanText(v, 80).trim() || DEFAULT_NAME;
export const cleanAspect = (v: unknown): Aspect => ASPECTS.find(a => a === v) ?? '16:9';

function cleanPose(raw: unknown, base: Pose): Pose {
  const out = {} as Pose;
  LIMB_IDS.forEach((l: LimbId) => {
    const p = isObj(raw) ? raw[l] : null;
    const ok = Array.isArray(p) && typeof p[0] === 'number' && Number.isFinite(p[0]) && typeof p[1] === 'number' && Number.isFinite(p[1]);
    out[l] = ok ? [p[0] as number, p[1] as number, p[2] === -1 ? -1 : 1] as LimbPose : [...base[l]] as LimbPose;
  });
  return out;
}

function cleanItem(raw: unknown, fix: Fixes): Item | null {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : rid();
  const place = (d: { x: number; y: number; s: number }) =>
    ({ x: num(raw.x, d.x), y: num(raw.y, d.y), s: num(raw.s, d.s, 0.3, 3), r: num(raw.r, 0, -3600, 3600), flip: raw.flip === true });
  if (raw.kind === 'char') {
    const base = newCharacter(), c: Character = { ...base, ...place(base), id };
    for (const k of PART_SLOTS) {
      // files from before bodies existed have none: the posable figure, quietly
      if (k === 'body' && raw.body === undefined) { c.body = 'rig'; continue; }
      const ok = hasPart(PART_LISTS[k], raw[k]);
      if (!ok) fix.fixed++;
      c[k] = ok ? (raw[k] as string) : PART_LISTS[k][0].id;
    }
    for (const k of COLOR_SLOTS) {
      const ok = isHex(raw[k]);
      if (!ok) fix.fixed++;
      c[k] = ok ? (raw[k] as string) : base[k];
    }
    c.pose = cleanPose(raw.pose, base.pose);
    return c;
  }
  const def = raw.kind === 'prop' ? PROPS.find(p => p.id === raw.prop) : undefined;
  if (def) {
    const p: Prop = { id, kind: 'prop', prop: def.id, ...place({ x: 480, y: 300, s: 1 }) };
    if (def.text) p.text = cleanText(raw.text, 300);
    if (isHex(raw.color)) p.color = raw.color;
    return p;
  }
  return null;
}

function cleanFrame(raw: unknown, fix: Fixes): Frame | null {
  if (!isObj(raw)) return null;
  const sceneOk = hasScene(raw.scene);
  if (!sceneOk && raw.scene != null && raw.scene !== '') fix.fixed++;
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, MAX_ITEMS).map(i => {
    const c = cleanItem(i, fix);
    if (!c) fix.dropped++;
    return c;
  }).filter((i): i is Item => i !== null);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : rid(),
    bg: isHex(raw.bg) ? raw.bg : DEFAULT_BG, scene: sceneOk ? (raw.scene as string) : 'none', note: cleanText(raw.note, 2000), items
  };
}

/** Untrusted frames (an opened file or localStorage) -> clean frames. */
export function cleanFrames(raw: unknown): Fixes & { frames: Frame[] } {
  const fix: Fixes = { fixed: 0, dropped: 0 };
  const frames = (Array.isArray(raw) ? raw : []).slice(0, MAX_FRAMES).map(f => cleanFrame(f, fix)).filter((f): f is Frame => f !== null);
  return { frames, ...fix };
}

/* ---------- versions ---------- */
/* Version 2 (milestone 6) replaced the hand-drawn heads with Open Peeps parts, folded hats into the hairstyles and
   dropped neckwear (Open Peeps has none; cleanItem drops the old neck fields as unknown). */
const V2_HAIR: Record<string, string> = { none: 'no-hair-1', crop: 'short-1', quiff: 'pomp', bun: 'bun-2', curly: 'afro', long: 'long', pony: 'cornrows' };
const V2_HAT: Record<string, string> = { beanie: 'hat-beanie', cap: 'hat-hip', bucket: 'hat-hip' };
const V2_FACE: Record<string, string> = { smile: 'smile', neutral: 'blank', grin: 'smile-big', wink: 'cute', surprised: 'awe', sleepy: 'tired' };
const V2_GLASSES: Record<string, string> = { none: 'none', round: 'glasses', square: 'glasses-3', shades: 'sunglasses' };
const V2_FACIAL: Record<string, string> = { none: 'none', stache: 'moustache-1', beard: 'full', goatee: 'goatee-1' };

/** A version 1 character in the version 2 shape. Unknown ids pass through for cleanItem to repair. */
function itemV1toV2(it: unknown): unknown {
  if (!isObj(it) || it.kind !== 'char') return it;
  const { hat, ...c } = it;
  const pick = (m: Record<string, string>, v: unknown) => (typeof v === 'string' && v in m ? m[v] : v);
  const out: Obj = { ...c, hair: pick(V2_HAIR, c.hair), face: pick(V2_FACE, c.face), glasses: pick(V2_GLASSES, c.glasses), facial: pick(V2_FACIAL, c.facial) };
  if (typeof hat === 'string' && hat in V2_HAT) out.hair = V2_HAT[hat];
  return out;
}
/** frames of a version 1 project (or the vanilla shape, after fromLegacyFrames) in the version 2 shape */
export function framesV1toV2(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map(f => (isObj(f) && Array.isArray(f.items) ? { ...f, items: f.items.map(itemV1toV2) } : f));
}

/** One step per old version: MIGRATIONS[n] turns a version n file into version n + 1. */
const MIGRATIONS: Record<number, (p: Obj) => Obj> = {
  1: p => ({ ...p, version: 2, frames: framesV1toV2(p.frames) })
};
function migrateProject(p: Obj & { version: number }): Obj {
  let cur: Obj = p;
  while ((cur.version as number) < PROJECT_VERSION) {
    const step = MIGRATIONS[cur.version as number];
    if (!step) throw new ProjectError('This project file is from an unsupported version.');
    cur = step(cur);
  }
  return cur;
}
const NOT_A_PROJECT = 'That file is not a Drawfree project.';

export interface ProjectState { name: string; aspect: Aspect; frames: Frame[] }
export interface ParsedProject extends Fixes { state: ProjectState }

/** Validates and cleans an already-parsed project object. Throws ProjectError with a user-facing message. */
export function parseProjectObject(raw: unknown): ParsedProject {
  if (!isObj(raw) || typeof raw.version !== 'number' || !Array.isArray(raw.frames)) throw new ProjectError(NOT_A_PROJECT);
  if (!Number.isInteger(raw.version) || raw.version < 1) throw new ProjectError(NOT_A_PROJECT);
  if (raw.version > PROJECT_VERSION) throw new ProjectError('This project was saved by a newer version of Drawfree.');
  const p = migrateProject({ ...raw, version: raw.version });
  const r = cleanFrames(p.frames);
  if (!r.frames.length) throw new ProjectError('That project has no frames.');
  return { state: { name: cleanName(p.name), aspect: cleanAspect(p.aspect), frames: r.frames }, fixed: r.fixed, dropped: r.dropped };
}

/** Parses and cleans file text. */
export function parseProject(text: string): ParsedProject {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new ProjectError(NOT_A_PROJECT); }
  return parseProjectObject(raw);
}

export const toProject = (st: ProjectState): Project => ({
  version: PROJECT_VERSION, name: st.name || DEFAULT_NAME, frames: st.frames, aspect: cleanAspect(st.aspect), updatedAt: new Date().toISOString()
});

/** The original vanilla version stored items as { type: 'char' } / { type: 'prop', kind: <prop id> }. Convert to the current file shape. */
export function fromLegacyFrames(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return framesV1toV2(raw.map(f => {
    if (!isObj(f) || !Array.isArray(f.items)) return f;
    return {
      ...f,
      items: f.items.map((it: unknown) => {
        if (!isObj(it)) return it;
        if (it.type === 'char') { const { type: _t, ...rest } = it; return { ...rest, kind: 'char' }; }
        if (it.type === 'prop') { const { type: _t, kind, ...rest } = it; return { ...rest, kind: 'prop', prop: kind }; }
        return it;
      })
    };
  }));
}

/* ---------- file names ---------- */
export function slug(name: string): string {
  const s = String(name || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return s || 'drawfree';
}
export const projectFileName = (name: string): string => slug(name) + '.drawfree.json';
export const frameFileName = (name: string, n: number, ext: string): string => slug(name) + '-frame-' + n + '.' + ext;
