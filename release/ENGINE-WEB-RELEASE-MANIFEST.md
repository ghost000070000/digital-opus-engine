# Digital Opus Engine — Web Release Manifest

No secrets. No deployment credentials. No claim of production deployment.

## Product

- **Name**: Digital Opus Engine — public home + packaged editor + 28-game examples hub
- **Intended target subdomain**: `engine.digitalopusadsolutions.com` (proposed only — not yet created, not yet DNS-configured)
- **Package build date/time**: 2026-09-05 (local build, this session)
- **Source working-tree state**: local git repo at `DOEngine/`, last commit `dc53da8` (2026-08-10). Working tree carries additional uncommitted local changes from prior passes (capability waves, public home, packaging fixes) not yet committed — this release package was built from that working tree as-is, not from a clean commit.

## Build & Test Results

- `node build/build.js` — succeeded (engine bundle + demo bundle built)
- `node tests/run-tests.js` — **31 passed, 0 failed** (canonical public-API suite)
- `node build/build-games.js` — 28/28 game builds succeeded
- `node build/build-engine-site.js` — succeeded; internal path-safety check passed; internal broken-link check passed (7 links on Engine home, all resolve)

## Package Contents

- **Game count**: 28
- **Featured count**: 7 (Foglight, Signal Relay, Arsenal Run, Silent Sector, Power Grid, Relic Frontier, Relic Island)
- **Engine home page now shows all 28 games as cards** (not Featured-only) — the 7 Featured entries keep their badge and generated thumbnail, sorted first; the remaining 21 render as unbadged cards without a thumbnail image, same fallback the Examples Hub already used. The "See All N Examples" CTA was renamed "Open the Examples Hub" since the home page itself no longer hides any game.
- **Source build output**: `dist/engine-site/` (34.5 MB uncompressed)
- **Release staging directory**: `release/digital-opus-engine-web/` (71 files — exact contents of `dist/engine-site/`, no reports/tests/`.git`/node_modules/capability-wave docs included)
- **Release ZIP**: `release/digital-opus-engine-web.zip`
  - **Size**: 9,908,539 bytes (~9.5 MB compressed)
  - **SHA-256**: `96493156701d2c9a795e1f7b5869d3b5422d236e04b320c1078bde3bc60c59b5`
  - **Structure**: flat at ZIP root — `index.html`, `DEPLOYMENT-README.txt`, `build/`, `dist/`, `editor/`, `games/` all sit directly at the top level (92 entries total — 21 more than earlier builds, from the new per-game thumbnail SVGs below). No wrapping `digital-opus-engine-web/` folder.
- **Fixed this build**: a real, systemic gameplay bug — every jump-enabled controller (Top-Down w/ jump, Third-Person, First-Person) had no recovery from falling off the edge of placed floor geometry into open space (none of the 28 games place an explicit `terrain` object, so there was no fallback ground height once a player cleared the last floor collider, and `applyMapBoundary` only ever corrects horizontal position, never vertical). Fixed once at the single per-frame dispatcher every controller funnels through: falling more than 30 units below the last spawn/checkpoint now automatically respawns the player there, reusing the exact same recovery the existing `Respawn At Checkpoint` behavior-graph action already used for hazards. All 28 games were rebuilt with this fix baked in.
- **Visual consistency fix**: every card (home page and Examples Hub) now gets a generated title-card thumbnail, not just the 7 Featured ones -- previously the 21 non-Featured cards rendered as bare text with no image, visually inconsistent once all 28 render on one page. Featured cards keep their hand-picked colors; the rest get a deterministic per-id color (hashed from the game's own id) so every card is visually distinct without any new hand-maintained palette.

## Upload-Root Expectation

Extracting this ZIP's contents so that `index.html` sits **directly** at the web server's document root for `engine.digitalopusadsolutions.com` (e.g. `public_html/index.html`, not `public_html/digital-opus-engine-web/index.html`) makes `https://engine.digitalopusadsolutions.com/` serve the Engine home page correctly. See `HOSTINGER-DEPLOYMENT-GUIDE.md` for exact steps.

## Explicit Warning

**Do NOT upload this package over, into, or anywhere near the existing `games.digitalopusadsolutions.com` document root.** That is a separate, already-live, unrelated 43-game Digital Opus Games portfolio. This release package must only ever go to the `engine.digitalopusadsolutions.com` subdomain (or an explicitly agreed alternative path), never to the Games site's hosting location.

## Clean-Room Verification

The exact ZIP above (not `dist/engine-site/` directly) was extracted into an unrelated temporary directory and served by a fresh static server. All of the following were verified working with zero console errors:

- `/` — Engine home page, all sections render, all 28 game cards correct (7 Featured badged/thumbnailed, 21 unbadged)
- `/editor/` — packaged editor loads default Crate Run starter game, playable
- `/games/` — examples hub renders all cards
- `/games/foglight.html` — direct game URL loads Foglight correctly
- `/editor/?game=foglight` — deep link correctly loads Foglight into the editor (confirmed via internal state: `Loaded Foglight` status, 80 placed objects — not just page title, which does not update on project load and is not a defect)

## Target Subdomain Status (read-only check only)

- `engine.digitalopusadsolutions.com` — no DNS record exists (confirmed via `curl`/`nslookup`, no mutation performed). Appears unused; safe candidate for a new deployment.
- `games.digitalopusadsolutions.com` — confirmed still resolving and still serving the existing, separate 43-game Digital Opus Games portfolio, unchanged by this pass.

## Wave 10

Not started. `WAVE_10_NOT_JUSTIFIED`. This pass is release-engineering/packaging only.
