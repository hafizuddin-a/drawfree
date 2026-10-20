# Drawfree

Storyboards you drag, not draw.

Build storyboard frames from full-body line-art characters. Swap hair, outfits and shoes, flip to face left or right, rotate, and pose arms and legs by dragging hands and feet.

## Run locally

```
npm install
npm run dev        # Vite dev server
npm run lint       # Biome
npm test           # unit, store, persistence and UI tests
npm run ci         # everything CI runs
npm run sheet      # contact sheet of every part, to art-sheet.png
```

Built with Vite, React 18, TypeScript (strict) and Zustand. Character art is plain SVG strings drawn by pure functions in `src/parts` and `src/rig`, so it runs (and is tested) in Node without a browser. See `CLAUDE.md` for the architecture.

## Deploy to Cloudflare

`wrangler.jsonc` serves `dist/` as static assets on Cloudflare Workers, with SPA fallback. There are two Workers: `drawfree` (production) and `drawfree-staging`.

```
npx wrangler login          # once
npm run deploy:staging      # https://drawfree-staging.<your-subdomain>.workers.dev
npm run deploy              # production: https://drawfree.<your-subdomain>.workers.dev
npm run deploy:preview     # uploads a preview version of staging without changing it
```

Each deploy script type-checks, builds and runs `tools/check.js` first. Response headers (CSP, caching, nosniff) live in `public/_headers` and are copied to `dist/` by the build.

**Custom domain (drawfree.fun):** add the domain to Cloudflare DNS, then in the dashboard open the `drawfree` Worker, Settings, Domains & Routes, Add, Custom domain. Nothing in the app depends on the hostname.

Cloudflare Pages is the fallback: `npm run build && npx wrangler pages deploy dist --project-name drawfree`.

### CI

- `.github/workflows/ci.yml` runs on every pull request and push to `main`: `npm ci`, then `npm run ci` (lint, typecheck, tests, build, size and source-rule check). Pull requests from this repo also get a preview URL, posted as a PR comment, from a version upload to the staging Worker.
- `.github/workflows/deploy.yml` deploys `main` to staging on every merge. Production is a manual run (Actions, Deploy, Run workflow, choose production). Add required reviewers to the `production` environment in GitHub for an approval step.
- Set two repository secrets: `CLOUDFLARE_API_TOKEN` (create it from the "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`. Never commit them.

## Working on it with Claude Code

Open this folder in Claude Code. `CLAUDE.md` describes the architecture, the part and rig conventions, and a prioritised roadmap, so Claude has what it needs without extra setup. Run `npm run ci` before committing.

## Files

- **Export** (top bar) downloads the current frame as PNG (1x, 2x, 3x, optional transparent background) or SVG.
- **Export, whole board** makes a PDF (A4 or Letter, one frame per page or a contact sheet) or a PNG strip of every frame with its note. Drag frames in the strip to reorder them, or use the arrow buttons.
- **Keyboard**: arrows nudge (Shift for 10 px), `+` and `-` scale, `[` and `]` rotate, `F` flips, Ctrl/Cmd+D duplicates, Alt+`]` brings to front, Delete removes, Esc deselects, Ctrl/Cmd+Z undoes, `/` searches.
- **Zoom and pan**: Ctrl/Cmd and the wheel (or a pinch) zoom, Space and drag pan, `0` resets, and there are zoom buttons on the stage.
- **Save** writes `<project-name>.drawfree.json`; **Open**, Ctrl/Cmd+O, or dropping a file on the page loads it. Open is one undo step.
- The project also autosaves in the browser (localStorage). If storage is blocked the app says so and keeps working.
