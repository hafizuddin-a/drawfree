# Drawfree

Storyboards you drag, not draw. A browser tool for building storyboard frames from full-body, Notion-Faces-style line-art characters. Users swap hair, faces, outfits and shoes, flip a character to face left or right, rotate it, and pose arms and legs by dragging hands and feet. No drawing skill needed.

Long-term goal: the product in the reference image (picker panel with part categories and search, canvas with selection box and floating toolbar). This repo is the working prototype of that.

## Commands

```
npm install
npm run build     # bundles src/ into dist/index.html (standalone) and dist/artifact.html (Claude artifact fragment)
npm run dev       # build + serve dist locally
npm run smoke     # build + jsdom smoke test (picking, flip, undo, pose, rotate, scenes, export dialog, save/open, blocked storage)
npm test          # project-file unit tests (tools/project-test.js), then build + smoke
npm run sheet     # render a contact sheet of every part to art-sheet.png (use this to check art changes)
npm run check     # build + tools/check.js (inline script compiles, dist files present). Stand-in for tsc until the TypeScript port
npm run ci        # what CI runs: unit tests, build, check, smoke
npm run deploy:staging   # build + check + wrangler deploy --env staging (drawfree-staging)
npm run deploy    # same for production (drawfree). Ask before running; staging first
npm run preview   # wrangler versions upload to staging, no traffic change (CI uses this per PR)
```

The smoke test and contact sheet are how art and logic were checked, so run both after changing parts or the editor. jsdom has no canvas, so PNG encoding is not covered by `npm test`: check it in a real browser (see Gotchas).

## Architecture (vanilla JS, no framework, no runtime dependencies)

`build.js` concatenates the JS files in this order (parts-a, parts-b, scenes, project, app-a, io, app-b) into one script, so they share one global scope:

| File | Role |
| --- | --- |
| `src/parts-a.js` | Drawing helpers (`shp`, `ln`, `tube`, `hand`), rig math (`G`, `fk`, `ik`, `slice`), palettes, and the head parts: `HAIR`, `FACE`, `GLASSES`, `FACIAL`, `HATS`, `NECK` |
| `src/parts-b.js` | `TOPS`, `BOTTOMS`, `SHOES`, `POSES`, `PROPS`, `newChar()`, `charSVG()` (the character renderer), `propSVG()` |
| `src/scenes.js` | Line-art backdrops (`SCENES`), `BGC` colours, `sceneSVG`, `frameBG` |
| `src/project.js` | Pure data code, no DOM: `toProject`/`parseProject` (editor state <-> `.drawfree.json`), `cleanFrames` (validates untrusted data), `MIGRATIONS`, `slug` and file names |
| `src/app-a.js` | State `S`, config `SECS`/`TABS` (the picker UI is generated from these), rendering, history (`snap`/`doUndo`), localStorage |
| `src/io.js` | `exportSVG`, SVG to PNG, downloads, save and open project, drag-and-drop open, export dialog, dialog focus handling |
| `src/app-b.js` | Actions, panel and toolbar events, pointer dragging (move, scale, rotate, joints), keyboard, boot |
| `src/index.html`, `src/style.css` | Markup template and styles. `@@CSS@@` and `@@JS@@` are replaced at build time |
| `tools/` | `smoke.js`, `project-test.js`, `sheet.js` |

### Character model

A character is plain data from `newChar()`: part ids (`hair`, `face`, `top`, `bottom`, `shoes`, `glasses`, `facial`, `hat`, `neck`), colours (`skin`, `hairC`, `topC`, `botC`, `shoeC`, `hatC`, `neckC`), placement (`x`, `y`, `s` scale, `r` rotation in degrees, `flip`) and `pose`. The SVG is regenerated from this data on every change. Never store SVG in state.

### Coordinate space and rig

- Local space: pelvis at (0,0), figure faces +x, head centre (0,-212), shoulders at (±33,-150), hips at (±19,-4). Every part is drawn in this space, which is why parts from different categories line up.
- Left-facing is `scale(-1 1)` on the `.body` group. Rotation and scale sit on the outer `.item` group.
- Each limb is two bones. `pose` holds `[upperAngle, lowerAngle, bendSign]` per limb (`aL`, `aR` arms, `lL`, `lR` legs). Angles are degrees, 0 is straight down, positive swings toward +x.
- `ik(origin, l1, l2, target, sign)` solves a limb from a hand or foot target. Arms default to sign +1 (forearm folds forward), legs to -1 (knee folds forward). Poses in `POSES` are stored as targets and solved with IK.
- Draw order in `charSVG`: hair back, legs, neck, pelvis/skirt, top, neckwear, left arm, head layers, right arm.

### Adding a part

Add an entry to the right list (for example `HAIR`) with `id`, `name`, `tags` and a draw function, using `INK` outlines (stroke 3) and the colour passed in. Add its section to `SECS` if it is a new category. Thumbnails, search and the picker UI come for free, because thumbnails are rendered by `charSVG` with a cropped `viewBox`.

### Editor behaviour to preserve

- Pointer drags use `window` listeners because the stage is re-rendered with `innerHTML` on every move. Do not attach drag state to elements.
- `snap()` pushes a history entry. Call it once before a mutation, and for drags only after the pointer has moved.
- The selection box is measured from the rendered `.body` group's bounding box, so it stays axis-aligned when a character is rotated.
- Exported SVG (`exportSVG`) has no editor chrome (hit areas and pose handles are skipped) and has named layers (`background`, `scene`, `character-N`).
- Editor items use `type: 'char' | 'prop'` and, for props, `kind: <prop id>`. The file format (spec data model) uses `kind: 'char' | 'prop'` and `prop`. Only `toProjectItem` / `fromProjectItem` in `project.js` convert between them. localStorage keeps the editor shape under `drawfree.v1` (plus `name`, `aspect`), so older saves still load.
- Everything read from outside (an opened file, localStorage) goes through `cleanFrames`: unknown part ids fall back to the section's first part, bad colours to defaults, unknown props are dropped, numbers are clamped, XML-illegal characters stripped. Add new character fields to `PART_LISTS` or `COLOR_SLOTS` there, and to `toProjectItem`.
- To change the file format: bump `PROJECT_VERSION` and add `MIGRATIONS[oldVersion]`. Files with a newer version are refused.
- Autosave is debounced 500 ms (`save`), flushed on `pagehide` and when the tab is hidden (`saveNow`), and never throws. The project name and aspect are not in the undo history; opening a file is one undo step.
- Dialogs use `openDialog` / `closeDialogs` in `io.js` (focus moves in, Tab is trapped, Esc closes, focus returns). Use them for any new dialog.

## Status and roadmap

Done: SVG and PNG download (1x/2x/3x, transparent option) from the Export dialog, save and open `.drawfree.json` (button, Ctrl/Cmd+S and +O, drag a file onto the page), part picker with search, ~50 original parts, full-body rig with IK posing and presets, flip, rotate, scale, move, duplicate, bring to front, undo/redo, multi-frame storyboard with notes, scenes and background colours, copy-as-SVG, autosave to localStorage (`drawfree.v1`, migrates from the old `inkframe.v1`).

Next, roughly in priority order:

1. **Board export.** PDF contact sheet and PNG strip for the whole storyboard (frame export is done). Downloads are blocked inside Claude's artifact viewer; Copy SVG remains for that case.
2. **Optional cloud save and share links** (Cloudflare R2 + D1). Local save and open are done.
3. **Better art.** All art is original and hand-coded, so it is rougher than a real illustrator's work. Options: import Open Peeps (CC0, https://www.openpeeps.com) by converting each part to one of these draw functions with fixed anchors, or commission an illustrator for hands and faces only and keep the rest. Check each asset's licence before shipping.
4. **More head angles** (profile, back, looking up or down). Hair and faces must be redrawn per angle.
5. **Poseable hands** (open, fist, point) and a held-prop slot so characters can hold objects.
6. **Snap-to-surface for sitting**, so a seated character lands on a chair.
7. **Rotated selection box** and multi-select.
8. **Move to Vite + React + TypeScript** once the UI grows. The data model and part functions port as they are, and Zustand would replace the global `S`.
9. Touch polish for phones and tablets, keyboard accessibility for the picker, automated tests that run `smoke.js` in CI.

## Gotchas

- `dist/artifact.html` is a fragment (no doctype or head) because Claude's artifact viewer wraps it. Host `dist/index.html`.
- PNG export draws the SVG through an `<img>`, which cannot use the page's web fonts, so speech-bubble text falls back to the system font in PNGs until the fonts are self-hosted and embedded.
- Aspect ratio is stored in the project file and preserved, but the stage is still fixed at 16:9 (960x540). Per-project aspect choice is milestone 4.
- Hosting: `wrangler.jsonc` has production (`drawfree`) and `env.staging` (`drawfree-staging`). Staging is at https://drawfree-staging.hello-hafiz.workers.dev. `public/_headers` sets a strict CSP; any new external origin (fonts, analytics, a share API) must be added to it or the browser silently blocks it. Check the console on staging after such a change.
- The standalone page loads Figtree and Bricolage Grotesque from Google Fonts. If a strict CSP is added to `public/_headers`, allow `fonts.googleapis.com` and `fonts.gstatic.com` plus inline scripts and styles, or self-host the fonts.
- Product decisions (from the founder, Oct 2026): no accounts, free forever, no watermark on exports, no illustrator for now (Open Peeps plus original art), custom domain drawfree.fun to be connected later.
- Scene line colour switches by background luminance. Character outlines are always near-black, so dark backgrounds make them hard to see. Keep backgrounds light unless outlines become themeable.
- Browsers never show `alert`, `confirm` or `prompt` inside the artifact viewer. The app uses its own toast and modal, so keep it that way.
