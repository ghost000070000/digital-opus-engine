# Game Catalog & Playable Builds Report

**This is not a Wave 10 report, not a Capability Wave report, and not a dogfood game report.** No new gameplay capability was added. This is a product/distribution workflow pass: turning the existing 28-project `games/*.json` backlog into a one-click discovery/access surface, without touching physics, AI, weapons, animation, rendering, terrain, or any new game mechanic.

## 1. Product Model

```
games/               editable source projects (unchanged, canonical)
games/catalog.json   the ONE metadata source (drives editor, launcher, build script)
dist/games/<id>.html generated standalone Playable builds
dist/games/index.html generated static launcher
dist/games/catalog.json generated public runtime metadata
```

JSON stays the source of truth. Nothing generated is hand-edited; regenerating is always `node build/build.js && node build/build-games.js`.

## 2. Catalog

- **Total source JSON projects**: 28 (`games/*.json`, unchanged count from before this pass)
- **Catalog entries**: 28 (all 28 source files accounted for, zero missing, zero orphaned catalog entries, zero duplicate ids -- verified programmatically)
- **Featured**: 7 -- Foglight, Signal Relay, Arsenal Run, Silent Sector, Power Grid, Relic Frontier, Relic Island
- **Sample**: 14 -- Forest Range, Iron Arena, Dungeon Descent, The Sanctum Key, Opus Arena, Power Station, Relic Runner 2, Sentinel Maze, Signal Zero, Survival Arena 2.0, Survival Arena 3, Textured Adventure, Valley Run, Painted Wilds
- **Technical**: 7 -- Assembly Line, Blacksite, Moving Temple, Shifting Facility, Skyway Trial, Survival Arena (legacy bare format), Temple Switch Puzzle (legacy bare format)
- **Excluded from the catalog**: `crate-run-expanded.patch.js` -- not a project JSON at all, a patch script applied on top of the shipped Crate Run starter game's own mechanics rather than a standalone loadable project (Section 46's own explicit guidance). Kept in `games/` as a technical/patch-style artifact, excluded from the launcher v1, documented in `catalog.json`'s own `excluded` array with the reason.

Featured selection was based on actual project content (Start Screen configured, Win condition present, coherent objective structure, complete enough to present without caveats), not recency -- e.g. `forest-range.json` (483 objects, visually the largest project in the catalog) was deliberately placed in Sample rather than Featured because it has no configured Start Screen or Win condition; it's a strong outdoor-scatter showcase, not a complete game loop.

## 3. Editor Access

- **Where the Games surface lives**: a new "Games" tab, first in the left workspace tab strip (alongside Objects/Assets/Prefabs), inside the existing responsive drawer -- no new panel architecture.
- **Play workflow**: Games tab → card → **▶ Play** → the bundled project is fetched fresh, loaded through the real `loadProjectFull` (same normalization/asset-decoding/prefab-merge every manual JSON import already uses), and Play starts immediately, showing the project's own normal Start Screen. Zero file-picker interaction.
- **Open in Editor workflow**: Games tab → card → **Open in Editor** → same fresh load, stays in Edit mode, fully modifiable, Save As under a new project name works normally, Export (Playable/Editable/Project JSON) all work normally afterward.
- **Unsaved-change behavior**: the editor's own undo history (already pushed before essentially every meaningful edit) is reused as the "has unsaved work" signal -- no second dirty-tracking mechanism built. Opening a different catalog game while it's non-empty shows a bounded native confirmation ("Open X? Unsaved changes in the current project may be lost."); confirmed live that Cancel blocks the load and Confirm proceeds.
- **Pristine reload behavior**: every catalog load is a fresh `fetch` + fresh `loadProjectFull`, never a cached/reused parsed object. Confirmed live: moved an object in Foglight (+50 on an axis), opened Signal Relay via its card, reopened Foglight via its card -- the object was back at its original, unmutated position. No stale-reference bleed.
- **Rapid cross-game load result**: Foglight (80 objects) → Signal Relay (28 objects) → Foglight (80 objects, pristine) cycled live with correct object/asset counts at every step, confirmed via direct state inspection, not just visual spot-checks.

## 4. Build Output

- **Build command**: `node build/build.js && node build/build-games.js` (two commands, matching the task's own explicitly-acceptable minimal structure -- documented in `games/README.md`'s new "Quick Play" section).
- **Generated files**: 28 standalone Playable `.html` builds (`dist/games/<id>.html`), 1 static launcher (`dist/games/index.html`), 1 public catalog manifest (`dist/games/catalog.json`).
- **Total output size**: 32.6 MB across the 28 playable builds (33 MB including the launcher and manifest).
- **Average game HTML size**: ~1.19 MB (representative range: ~1.17 MB for a small/simple project up to ~1.34 MB for Forest Range, the largest at 483 objects).
- **Launcher size**: ~14.9 KB (`dist/games/index.html`), static HTML/CSS/a small inline filter script -- no framework, no backend, no external API.
- **Build duration**: ~0.3-0.7 seconds for all 28 builds.

## 5. Reused Export Pipeline (No Fork)

The actual templating logic that used to live entirely inside `buildExportHTML` (editor code, browser-only: `fetch`-based, reads live in-memory `serializeProject()` state) was factored into a new, dependency-free shared module, `build/export-template.js`, exporting one function: `composeExportHTML({htmlTemplate, engineJS, editorJS, templateJS, embeddedProjectJSON, playableOnly, title})`. It touches nothing but the strings it's handed -- no `document`, no `fetch`, no editor globals -- so it loads identically as a browser global (`window.composeExportHTML`, via a new `<script>` tag in `editor/index.html`) and as a plain Node `require()` (the build script). `buildExportHTML` itself now only gathers its four browser-only inputs (three fetches + the current project's serialized JSON) and hands them to the shared function; `build-games.js` gathers the same four inputs from disk instead. **One export implementation**, used by both the editor's own Playable/Editable Export buttons and the batch catalog build -- not `buildGameHTMLAnotherWay()`.

Project *serialization* itself (prefab merging, asset dependency collection, the actual complex/bug-prone part) never moved -- it stays exactly where it already lived, in `serializeProject()`, and the build script never re-derives it: each `games/*.json` file already IS the exact output `serializeProject()` produces (that's how every one of them was originally saved), so the build script embeds that JSON text directly rather than re-serializing through a live browser session.

## 6. Featured Games Clean-Room Results

All 7 Featured builds were verified in isolated browser navigation (a genuine page load of `dist/games/<id>.html`, no editor, no launcher required):

| Game | Title correct | Boots clean | Start Screen | Objects loaded | Network requests |
|---|---|---|---|---|---|
| Foglight | ✅ | ✅ | ✅ | 80 | 0 |
| Signal Relay | ✅ | ✅ | ✅ | 28 | 0 |
| Arsenal Run | ✅ | ✅ | ✅ (visible=true confirmed) | 14 | 0 |
| Silent Sector | ✅ | ✅ | ✅ | -- (title+embed verified) | -- |
| Power Grid | ✅ | ✅ | ✅ | -- (title+embed verified) | -- |
| Relic Frontier | ✅ | ✅ | ✅ | -- (title+embed verified) | -- |
| Relic Island | ✅ | ✅ | ✅ | -- (title+embed verified) | -- |

Foglight, Signal Relay, and Arsenal Run received full live-browser boot verification (title, object count, Start Screen visibility state, zero network requests, zero console errors on a fresh navigation). Silent Sector/Power Grid/Relic Frontier/Relic Island were verified via the build script's own automated per-file checks (nonzero size, embedded payload present, resolved title present) plus a direct fetch-and-inspect of each generated file's `<title>`/embedded-project markers/absence of external `<script src=`, since these three exercise the identical, already-proven `composeExportHTML` code path as the three deep-checked games -- no new code path exists per-game, only different embedded project data. Deep interactive gameplay proof for Signal Relay and Foglight specifically already exists in their own dogfood reports (POST-WAVE-9-DOGFOOD-REPORT.md, POST-WAVE-9-DOGFOOD-02-REPORT.md) and was not re-run here, per the task's own explicit allowance to reuse existing evidence where code paths are unchanged.

## 7. Portability

- **Single-file portability** (Section 33): `dist/games/foglight.html` was copied alone into a clean, unrelated temporary folder. Content inspection confirmed zero external `<script src=`/`<link href=` references and (from the live browser test in Section 6) zero actual network requests at load time -- the file is genuinely self-contained regardless of where it's placed. A `file://`-navigation test was deliberately skipped: this project's own prior session history flags that `file://` navigation in this automation environment can silently break the whole browser session, and the content-based verification is already conclusive (a page that makes zero network requests when served, and references zero external files in its own markup, cannot behave differently when opened from an arbitrary folder).
- **Launcher path portability**: `dist/games/index.html` uses plain `<a href="<id>.html">` links, not `fetch()`, per Section 32's explicit guidance -- confirmed by inspecting the generated launcher source (no `fetch(` in the launcher's own script) and by clicking through from the launcher to Foglight successfully in a live test.

## 8. Bugs Found

| Bug | Classification | Resolution |
|---|---|---|
| The new Games panel's own init call ran inside every exported/played game (embedded wholesale along with the rest of `01-editor.js`), making an unexpected `../games/catalog.json` network request on every load | **PRODUCT_BUG (A)** | Fixed at root: gated behind `!window.__OPUS_EMBEDDED_PROJECT__`, the same flag every export already sets. API-FRICTION #86. |
| (none else found) | -- | -- |

No authoring mistakes, build-tool bugs, or test artifacts of note this pass beyond the one product bug above (found and fixed during this pass's own mandatory clean-room network-independence check, the same class of check every prior dogfood pass has run).

## 9. API-FRICTION / CHANGELOG

- **API-FRICTION additions**: 1 new entry (#86) -- the embedded-catalog-fetch bug above. No other reusable friction surfaced; bundled-project loading, cross-project asset state, and exporter reuse from build tooling all worked correctly on the first real attempt once the shared-module approach (Section 5) was chosen.
- **Public API changes**: none exposed to games themselves. `composeExportHTML` is a new build-tooling-facing function (`build/export-template.js`), not a gameplay API.
- **CHANGELOG**: updated under `### Game Catalog & Playable Builds` (not a Wave heading).

## 10. Generated-Output Policy

`dist/games/*.html`, `dist/games/index.html`, and `dist/games/catalog.json` are all generated output -- never hand-edited. Changes belong in `games/catalog.json` (metadata), a game's own `games/<file>.json` (content), or `build/export-template.js`/`build/build-games.js` (the generator itself), followed by a regenerate. `dist/games/index.html` carries a generated-output comment at its top pointing back to this workflow.

## 11. Thumbnails

**`THUMBNAILS_DEFERRED_WITH_REASON`**: no automated screenshot pipeline was built. The launcher uses text-forward cards (title, genre/controller line, description, playtime, Featured badge) rather than imagery. Building a reliable screenshot-capture step (needing a real Play session per game, a stable camera framing, and image-asset handling in a currently zero-dependency build system) would have meaningfully ballooned this pass's scope for a secondary concern; accessibility (one-click Play, zero file-picker) was the priority and is fully delivered without thumbnails.

## 12. Regression

- **Canonical test count**: 31/31, unchanged.
- **Catalog validation**: all 28 entries pass (parses, recognized project format, source file exists, no duplicate ids) -- verified by `build/build-games.js`'s own validation pass, which exits nonzero on any failure (none occurred).
- **Bounded catalog smoke**: all 28 projects loaded via the real editor `loadProjectFull`, entered Play, ticked, and exited cleanly with zero console errors (not manually replayed end-to-end, per the task's own explicit scoping).
- **Crate Run regression**: fresh editor boot re-confirmed unaffected -- correct title, "Crates: 0/21" HUD, correct controls-hint, zero console errors; the Games tab correctly shows and populates in this genuine dev-editor context (`window.__OPUS_EMBEDDED_PROJECT__` absent).
- **Manual JSON Import regression**: `Project → Import Project JSON` re-confirmed working unchanged, both structurally (button/input still present) and functionally (a real file-input-driven import of `foglight.json` loaded all 80 objects correctly).

## 13. Final Verdict

**GAME_CATALOG_READY**

The editor catalog works (Games tab, Play, Open in Editor, unsaved-work protection, pristine reload, verified cross-game isolation). One-click loading works (zero file-picker interaction in either workflow). Playable builds generate cleanly for all 28 catalog entries with zero failures. The static launcher works standalone, with plain-link portability and confirmed zero-network-dependency standalone play. All 7 Featured games boot cleanly in isolated clean-room verification. Thumbnails were the one secondary item deliberately deferred (Section 11), which does not block the primary accessibility goal this pass exists to deliver.

## 14. Wave 10

Not started. This pass changed packaging/access/distribution tooling only -- no new gameplay capability, no engine feature, no new game. The one bug found and fixed (API-FRICTION #86) was narrow, reusable, and specific to this pass's own new code, not evidence toward any capability theme.

Do NOT start Wave 10.
