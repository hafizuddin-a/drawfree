# Drawfree

Storyboards you drag, not draw. A browser tool for building storyboard frames from full-body, Notion-Faces-style line-art characters. Users swap hair, faces, outfits and shoes, flip a character to face left or right, rotate it, and pose arms and legs by dragging hands and feet. No drawing skill needed.

Stack: Vite, React 18, TypeScript (strict), Zustand. Static site on Cloudflare Workers. No accounts, free forever, no watermark.

## Commands

```
npm install
npm run dev              # Vite dev server
npm run build            # tsc --noEmit, then vite build into dist/
npm run lint             # Biome: no `any`, hook dependencies, unused code, a11y, console
npm run typecheck        # tsc --noEmit
npm test                 # Vitest + jsdom (unit, store, persistence, UI smoke)
npm run check            # tools/check.js on dist/: size budget, parts/rig/scenes stay pure
npm run ci               # what CI runs: lint, typecheck, test, build, check
npm run e2e              # Playwright: Chromium, WebKit, phone viewport (interaction + axe). Builds and serves dist itself
npm run e2e:install      # one-off: download the Chromium and WebKit browsers for Playwright
npm run sheet            # render a contact sheet of every part to art-sheet.png (use this to check art changes)
npm run deploy:staging   # build + check + wrangler deploy --env staging (drawfree-staging)
npm run deploy           # same for production (drawfree). Ask before running; staging first
npm run deploy:preview   # wrangler versions upload to staging, no traffic change (CI does this per PR)
```

Run `npm run ci` before committing. Biome suppressions (`biome-ignore`) must carry a reason; there are a handful, all deliberate (pointer-only drag handles, a roving-tabindex group, the TypeScript 7 regex). Run `npm run sheet` and look at it after any art change. jsdom has no canvas, so PNG encoding is not covered by `npm test`: check it in a real browser (see Gotchas).

## Layout

```
src/
  types.ts           the data model (Character, Prop, Frame, Project) and part types
  parts/             hair faces extras tops bottoms shoes props palettes draw.ts index.ts   (pure: no React, no DOM)
  rig/               geometry.ts ik.ts limbs.ts poses.ts renderCharacter.ts                  (pure)
  scenes/            scenes.ts backgrounds.ts                                                (pure)
  state/             store.ts (Zustand, all actions) history.ts persist.ts seed.ts
  editor/            Stage.tsx Overlay.tsx Editor.tsx interactions.ts useKeyboard.ts
  ui/                Picker Tabs Thumb(s) sections.ts TopBar FrameStrip Toolbar Dialog ExportDialog CopyDialog Toast Button icons
  export/            project.ts (files: validate, migrate, names) svg.ts png.ts download.ts frame.ts io.ts prefs.ts
                     layout.ts (pure: PNG strip and PDF layout math, text wrapping) board.ts (canvas strip, PDF glue) pdf.ts (pdf-lib, lazy)
  App.tsx main.tsx boot.ts styles/tokens.css
public/_headers      response headers (copied to dist/)
tools/               sheet.ts (contact sheet, run with tsx), check.js (post-build rules)
biome.json           lint rules (linting only; there is no formatter)
```

Hard rule: nothing in `src/parts`, `src/rig` or `src/scenes` may import React or touch the DOM. They take data in and return SVG strings out. `tools/check.js` enforces it. Biome bans `any`.

### Character model

A character is plain data from `newCharacter()`: part ids (`hair`, `face`, `top`, `bottom`, `shoes`, `glasses`, `facial`, `hat`, `neck`), colours (`skin`, `hairC`, `topC`, `botC`, `shoeC`, `hatC`, `neckC`), placement (`x`, `y`, `s` scale, `r` rotation in degrees, `flip`) and `pose`. Items are `kind: 'char'` or `kind: 'prop'` (with `prop: <id>`). The SVG is regenerated from this data on every change. Never store SVG in state. The in-memory shape is the project file shape (spec data model).

### Coordinate space and rig

- Local space: pelvis at (0,0), figure faces +x, head centre (0,-212), shoulders (±33,-150), hips (±19,-4). Every part is drawn in this space, which is why parts from different categories line up.
- Left-facing is `scale(-1 1)` on the `.body` group. Position, rotation and scale sit on the outer `.item` group.
- Each limb is two bones. `pose` holds `[upperAngle, lowerAngle, bendSign]` per limb (`aL`, `aR` arms, `lL`, `lR` legs). Angles are degrees, 0 is straight down, positive swings toward +x.
- `ik(origin, l1, l2, target, sign)` solves a limb from a hand or foot target. Arms default to sign +1, legs to -1. Presets in `POSES` are stored as targets and solved with IK.
- Draw order in `charSVG`: hair back, legs, neck, pelvis/skirt, top, neckwear, left arm, head layers, right arm.

### Adding a part

Add an entry to the right list (for example `HAIR` in `src/parts/hair.ts`) with `id`, `name`, `tags: tags('space separated words')` and the draw function(s) its type in `types.ts` asks for, using `INK` outlines (stroke 3) and the colour passed in. A new category also needs a section in `src/ui/sections.ts` (and a slot in `PART_LISTS` if it is a character slot). Thumbnails, search and the picker UI follow from that. Run `npm test` (it draws every part with every palette colour and checks the SVG parses) and `npm run sheet`.

## State and editor behaviour to preserve

- **Immutable state.** Every action builds new frames and items; never edit in place. `React.memo` on `ItemView` and cheap undo both depend on it. Past snapshots are plain references.
- **History.** `snap()` pushes one undo step. Call it once before a mutation. For drags it runs only after the pointer has moved 3px (move) or at all (other drags), so a click never makes an undo step. Typed text (note, project name) makes no step per keystroke; a bubble's text snaps once on focus.
- **Drags.** `editor/interactions.ts` keeps the drag session in a ref with `pointermove`/`pointerup` listeners on `window`. Never attach drag state to elements: the stage re-renders on every change.
- **Joint dragging** uses the inverse of the `.body` group's `getScreenCTM()`, so joints land on the pointer after flip, rotation and scale.
- The selection box turns with the item (see roadmap item 5). The Overlay re-measures in `useLayoutEffect` after every render.
- Thumbnails (picker and frame strip) are `<img>` data URLs (`svgImgSrc`), not inline SVG: far fewer DOM nodes, and their text stays out of the accessibility tree. The frame strip's order and current ring follow the live list; only the thumbnail art is deferred.
- The rotate handle sits above the (turned) selection box, else below it if that stays inside the stage, else beside it. (On phones the toolbar sits under the stage, so a handle below the box used to be hidden behind it.)
- Pose handles and hit areas exist only in the editor. `itemSVG` (export, thumbnails) emits no editor chrome. While Pose is on, the scale corners are hidden (they sat on raised hands).
- The ground shadow shows only when rotation is under 8 degrees.
- The picker and frame strip use `useDeferredValue`, so they catch up when a drag settles instead of re-rendering per pointer move. Thumbnails are cached in `ui/thumbs.ts` by section, part and the character's look.
- Dialogs use `ui/Dialog.tsx` (focus moves in, to the element marked `data-autofocus` or the first control; Tab is trapped, Esc and backdrop close, focus returns). Never use `alert`, `confirm` or `prompt`: use the toast and dialogs.
- **Markup from strings.** Art is SVG strings injected with `svgMarkup()` (`ui/markup.ts`, the only place `dangerouslySetInnerHTML` is used). Only pass strings built by the pure part, rig and scene functions, which escape user text with `esc()`. Never pass user input, file contents or anything not drawn by our own code.
- Autosave (`state/persist.ts`): key `drawfree.v1`, debounced 500 ms, flushed on `pagehide` and when hidden, never throws, warns once if storage is blocked. It reads the old prototype shape (`type`/`kind` items) and the older `inkframe.v1` key.

## Export

- **Frame**: SVG, or PNG at 1x/2x/3x, optional transparent background (`export/frame.ts`, `svg.ts`, `png.ts`).
- **Board PNG strip** (`board.ts`): every frame drawn onto one canvas in a grid (1 to 4 columns, 480/720/960 px frames) with numbered captions and optional notes. The canvas text uses Figtree, so any script works. `layout.ts` shrinks the frames when the image would pass the browser's canvas limits (16 million pixels, the Safari cap) and throws if even tiny frames cannot fit.
- **Board PDF** (`pdf.ts`): A4 or Letter, landscape or portrait, one frame per page or a 2 or 3 per row contact sheet. Frames are PNG images (2x), notes are real text. pdf-lib's built-in Helvetica covers Latin-1 only, so other characters (emoji, CJK, Arabic) become `?` and the toast says how many. Fixing that needs an embedded font (`@pdf-lib/fontkit` plus a font file, also loaded on demand).
- **pdf-lib is a dynamic import** and a separate 172 KB chunk. `tools/check.js` fails the build if it ever lands in the first-load bundle. Keep `import('pdf-lib')` inside `buildPdf`.
- All layout math is pure (`export/layout.ts`) and tested in Node. `buildPdf` takes the frame renderer as an argument, so its tests run real pdf-lib without a canvas. The canvas parts (`board.ts`, `png.ts`) are only checked in a real browser.
- The export dialog remembers its choices in localStorage (`drawfree.export`), guarded for blocked storage.

## Frames

Add, duplicate, delete, reorder, and a note per frame. Reordering (`moveFrame`) works three ways: drag a thumbnail (mouse and pen; `FrameStrip` keeps the session in a ref with window listeners, like the stage), the Move earlier and Move later buttons, and Alt+Arrow on a focused thumbnail. Touch drags are left to the strip to scroll, so touch users use the buttons. A move is one undo step, the current frame stays current, and a toast announces it. The strip compares the current frame by id, not by index, because the thumbnails are a deferred value.

## Project files

`export/project.ts` is the only door for data from outside (opened files, localStorage): `parseProject`, `parseProjectObject`, `cleanFrames`. It repairs rather than rejects: unknown part ids fall back to the section's first part, bad colours to defaults, numbers are clamped, XML-illegal characters stripped, unknown props dropped (counted, shown in a toast). Files from a newer version are refused. To change the format: bump `PROJECT_VERSION` and add `MIGRATIONS[oldVersion]`. New character fields go in `PART_LISTS`/`COLOR_SLOTS` handling in `cleanItem`. File names: `<project-name>-frame-<n>.<ext>`, `<project-name>.drawfree.json`.

## Hosting and CI

- `wrangler.jsonc`: production `drawfree` and `env.staging` `drawfree-staging`, SPA fallback, assets from `dist/`. Staging: https://drawfree-staging.hello-hafiz.workers.dev. Production: https://drawfree.hello-hafiz.workers.dev. Custom domain drawfree.fun to be connected later (dashboard: Worker, Settings, Domains & Routes).
- `public/_headers`: strict CSP (`script-src 'self'`: the build has no inline scripts; styles allow inline because the art uses `style` attributes), nosniff, referrer and permissions policies, `no-cache` on `/`, immutable cache on `/assets/*`. A new external origin (fonts, analytics, a share API) must be added to the CSP or the browser silently blocks it. Check the console on a preview URL after such a change.
- `.github/workflows/ci.yml`: every PR and push to `main` runs `npm run ci`; PRs from this repo get a preview URL (version upload to staging) commented on them. `deploy.yml`: `main` deploys to staging; production is a manual run. Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set on the repo.
- Product decisions (founder, Oct 2026): no accounts, free forever, no watermark, 16:9 only for v1 (aspect stays in the file format and is preserved, but there is no picker), no illustrator for now (Open Peeps for heads plus original art), custom domain drawfree.fun later.

## Status and roadmap

Done (as of 2026-10-21): milestone 1 (SVG and PNG export, save and open `.drawfree.json`, drag-drop open), milestone 2 (staging and production Workers, headers, CI, PR previews), milestone 3 (this port; parity with the prototype checked byte for byte on the seed export and the contact sheet), milestone 4 (frame reordering, board PNG strip and PDF export).

Next, in the spec's order:

5. **Editor polish (milestone 5), in progress.** Done: the spec's keyboard routes (table below). Remaining, in the order I would do it, with the design already worked out:
   - **Playwright and axe: DONE** (`e2e/`, `playwright.config.ts`, a CI job). 77 tests across Chromium, WebKit and a Pixel 7 viewport: drag move, scale, rotate, hand-handle IK drag, bend flip, keyboard-only editing (Tab reaches items, focus selects), save and reopen a project, autosave, real PNG/SVG/PDF/strip downloads (checks file signatures and PNG size), frame reordering by button, key and drag, plus axe on the editor, selection, pose mode, every picker tab, search, the export dialog (all three scopes) and the frame strip. Run `npm run e2e:install` once. Gotcha: `reuseExistingServer` skips the build if something already listens on port 4173, so kill stray `vite preview` processes before trusting a run.
   - **Handle size in screen pixels: DONE.** `Stage` measures `getScreenCTM().a` (px per stage unit) with a `ResizeObserver` (`useStagePx`) and `PoseHandles` sizes everything in screen pixels divided by that and by the item scale: hand and foot hit circles 44 px, elbow and knee 32 px, visible dots 18 px and 12 px. When zoom lands, re-measure on zoom changes too (the observer only sees size changes).
   - **Zoom and pan: DONE.** `editor/view.ts` (pure maths, tested in Node) holds the view as a zoom (1 to 5) and a centre; `Stage` sets its `viewBox` from `store.view`, which is not in undo history and not saved, and resets when a project is opened. Ctrl/Cmd+wheel and a trackpad pinch zoom about the pointer (native non-passive wheel listener in `Editor.tsx`); the plain wheel pans once zoomed in; Space+drag and the middle button pan; two fingers pinch (`interactions.ts`, `pinchOf`); `0` resets; with nothing selected `+`/`-` zoom and arrows pan (with an item selected they edit the item); `ZoomControls` gives on-screen buttons. The Overlay and `useStagePx` re-measure after every render, so the selection box and handle sizes follow the zoom. Caveats: Space on a focused button also presses it (blur first); the two-finger pinch is only tested with synthetic pointer events in jsdom, not on a real touch device.
   - **Rotated selection box: DONE.** `Overlay` measures the `.figure` and `.handles` groups inside `.body` (not the ground shadow, which is wider than the character and disappears past 8 degrees of turn), unions their `getBBox()`es, maps the four corners through `body.getScreenCTM()` and `box.ts` turns that into a centre, size, angle and bounds. The box is a div with `transform: rotate()`; the corners and the rotate handle are its children, so they ride along. The handle goes above the box in its own turned frame, else below, else beside (`handleSide`). The toolbar is placed from the axis-aligned bounds. Item markup is now `.body > .shadow + .figure (+ .handles)`.
   - **Multi-select.** Make `sel` a list (keep `selectedItem` for the single case so most code is unchanged): Shift-click toggles, dragging on empty stage draws a marquee that selects items it touches, Ctrl/Cmd+A selects all. Dragging any selected item moves the group; Delete, duplicate, bring to front, flip, nudge, `+`/`-` and `[`/`]` apply to every selected item (each around its own anchor). The box for a group is the axis-aligned union of the item boxes. Pose and the picker keep working on a single selected character (`charTarget`).
   - Direct joint dragging stays pointer-only; that gap is documented in the spec.

**Keyboard**: Tab reaches each item on the stage (the transparent hit area is the focus stop and carries the name, e.g. "Character 1" or "Speech bubble: <text>"); focusing selects it, Enter or Space selects too. **Shortcuts (all in `editor/useKeyboard.ts`)**: arrows nudge 1 px, Shift+arrows 10 px; `+`/`-` scale; `[` and `]` rotate 5 degrees (Shift 15); `F` flips; Delete or Backspace removes; Ctrl/Cmd+D duplicates; Alt+`]` brings to front; Esc deselects (or closes a dialog); Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo; Ctrl/Cmd+S save, Ctrl/Cmd+O open; `0` resets zoom; Ctrl/Cmd+wheel zoom, Space+drag pan (with nothing selected: `+`/`-` zoom, arrows pan); `/` focuses search; arrows in the picker move between thumbnails; Alt+arrows on a frame thumbnail reorder frames.

6. **Art upgrade.** Open Peeps heads via `tools/import-peeps.ts` and `LICENSES.md`. The raw pack lives in `assets/open-peeps/` (gitignored, local only).
7. **Hands and held props**, seated characters snap to chairs.
8. **Optional share links** (Worker, R2, D1).
Also before launch: self-host Figtree and Bricolage Grotesque (then drop the Google Fonts origins from the CSP), Lighthouse 90+ on the production URL.

## Gotchas

- Aspect ratio: v1 is 16:9 only, by the founder's decision. The `aspect` field stays in the project file and is preserved, but nothing reads it.
- Scene line colour switches by background luminance. Character outlines are always near-black, so dark backgrounds make them hard to see. Keep backgrounds light unless outlines become themeable.
- PNG export draws the SVG through an `<img>`, which cannot use the page's web fonts, so speech-bubble text falls back to the system font in PNGs until the fonts are self-hosted and embedded. The root `<svg>` needs explicit `width`/`height` for Safari and Firefox. Not yet tested in Safari or Firefox.
- The standalone page loads Figtree and Bricolage Grotesque from Google Fonts.
- In Playwright, `boundingBox()` of an SVG element includes its stroke width but `getBoundingClientRect()` (what the app measures) does not; when comparing against the selection box, measure with `getBoundingClientRect` in `page.evaluate`.
- jsdom stubs (`src/test/setup.ts`) fake `getScreenCTM`, `DOMPoint` and layout, so tests prove the logic, not the geometry. Geometry (drag lands on the pointer, selection box fits) was checked in a real browser.
- The old Claude artifact build (`dist/artifact.html`) is gone with the vanilla build. Downloads are blocked inside Claude's artifact viewer; Copy SVG (with its manual-copy dialog) is the fallback.
- TypeScript 7 rejects some regex literals the older compiler accepted; `XML_ILLEGAL` is built with `new RegExp(string)` for that reason.
- Linting is Biome, not ESLint: `typescript-eslint` does not support TypeScript 7 yet (peer range stops below 6.1). Revisit if that changes; do not force the install.
