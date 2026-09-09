# Digital Opus Games — Public Hub Report

**This is a website/product-distribution report.** Not a Capability Wave, not Wave 10, not a dogfood game report. This pass turned the existing 28-game catalog (`GAME_CATALOG_READY`) into a deployment-ready public games website, without touching engine gameplay systems.

## 1. Site

- **Source template**: `build/templates/games-site.html` -- one maintainable HTML/CSS/JS file with placeholder tokens (`{{FEATURED_SECTION}}`, `{{MORE_SECTION}}`, `{{GAME_COUNT}}`), not a string buried inside the build script.
- **Structure**: header (brand + nav) → hero (title, one-sentence description, Browse/Featured actions) → category filter (All/Featured/Adventure & Action/Experimental) → Featured section (7 cards with generated title art) → More Games section (14 Sample + 7 Experimental cards, compact style, no image) → About section → footer.
- **Featured presentation**: rendered entirely from `games/catalog.json`'s own `featured`/`category` fields -- no separate hardcoded list. Cards show title, genre, controller, a short player-facing description, playtime, and a Featured badge.
- **Filters**: client-side, vanilla JS, toggles `hidden` on cards by `data-category`; sections themselves hide when empty. No framework, no search engine, no backend.
- **Mobile behavior**: verified at 375×812 -- single-column reflow, zero horizontal overflow, header/filters wrap cleanly, cards remain fully readable.
- **Accessibility**: cards are real `<a>` elements (natively keyboard-focusable, no tabindex hacks) with `aria-label="Play <title>"`; every thumbnail has descriptive `alt` text; one `<h1>`, clean `<h2>` section hierarchy with no skipped levels; visible `:focus-visible` outlines on all interactive elements; no hover-only information (all card content is always visible).
- **Thumbnails/screenshots**: see Section 5.
- **Player journey**: confirmed live (open site → Featured visible → choose Foglight → Play → Start Screen shown) with zero confusion points and zero references to project JSON, the editor, or the repository anywhere in the visible page.

## 2. Build

- **Build command**: `node build/build.js && node build/build-games.js && node build/build-games-site.js` (three commands total across the whole pipeline; the third is new this pass and is additive, not a replacement for the second, which remains the editor/dev-facing build).
- **Output folder**: `dist/games-site/`
- **Game count**: 28 (all existing catalog entries; no 29th game created)
- **Total package size**: 32.6 MB (28 playable builds, ~1.19 MB average per game, plus a ~15 KB site index and a ~13 KB public catalog manifest)
- **Static assets**: 7 generated SVG title cards (`assets/thumb-<id>.svg`), a few KB each
- **Validation**: every generated game file is checked for nonzero size, embedded project payload, correct resolved `<title>`, and absence of any external `<script src=` reference (the standalone-dependency floor) -- all 28 passed. Catalog itself validated for parseable JSON, no duplicate ids, no missing source files, recognized project format, before any build output is written.

## 3. Screenshots

- **Strategy assessed**: real screenshot capture (option A) was attempted for real, not just considered. `Opus.App`'s own existing `app.screenshot()`/`captureScreenshot` mechanism was investigated and found to depend on the real engine render loop's `requestAnimationFrame` ticking, which does not fire at all in this automation environment (confirmed directly: a raw `requestAnimationFrame` counter stayed at 0 across a full real second). Falling back to a direct, un-timed `canvas.toDataURL()` did produce real image bytes on the first attempt (real WebGL content, not blank) -- but relaying that ~16KB base64 string back through this session's own text-based tool-call round-trip corrupted it: the resulting PNG's own `IDAT` chunk failed to `zlib.inflate`, confirmed with a direct byte-level check, not assumed.
- **Decision**: rather than build a more elaborate/fragile capture-and-relay subsystem to work around a text-relay limitation (exactly the kind of scope-ballooning this pass is told to avoid), Featured games use option C -- deterministic generated title-card art (an SVG gradient unique per game plus the game's own title and genre text).
- **Featured coverage**: all 7 Featured games have generated title-card art. 0 use fallback/no-image (all 7 covered).
- **Fallback art usage**: all 14 Sample and 7 Experimental cards use no image (plain text cards), per this pass's own explicit "Samples/Technical may use ... no image in v1" allowance.
- **Refresh workflow**: title cards regenerate automatically on every `build-games-site.js` run from a small per-game color-palette table in that script; no manual asset-editing step exists or is needed.
- **Verdict**: `THUMBNAILS_DEFERRED_WITH_REASON` (specifically for real screenshots; generated title art itself is fully shipped, not deferred).

## 4. Clean Room (Featured Games)

All 7 launched live from the actual public hub (`dist/games-site/index.html` → click card → game loads), in a real browser, not source-string inspection alone:

| Game | Launched from hub | Booted | Start Screen | Title correct | Network requests | Console errors |
|---|---|---|---|---|---|---|
| Foglight | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| Signal Relay | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| Arsenal Run | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| Silent Sector | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| Power Grid | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| Relic Frontier | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| Relic Island | ✅ | ✅ | ✅ | ✅ | 0 | 0 |

No editor chrome reachable in any of the 7 (`export-playable-btn` present in embedded DOM but zero-size/non-interactive, matching the already-proven Playable Export behavior).

## 5. Portability

- **Entire-site clean-room test**: the complete `dist/games-site/` folder (28 games + `index.html` + `catalog.json` + `assets/` + `README.txt`, 32 items) was copied to a genuinely unrelated temporary directory and served by a fresh, separate static server (a new, temporary launch config, removed again after the test). The launcher rendered correctly, filters worked, and clicking Play on Foglight loaded it correctly with zero network requests -- no repository path was involved anywhere in this test.
- **Single-game portability test**: `foglight.html` alone (no `index.html`, no `catalog.json`, no `assets/` folder -- literally the one file, nothing else in its directory) was copied into an empty folder and served fresh. It booted correctly: correct title, Start Screen visible, all 80 objects present, zero network requests, zero console errors. Confirms the site integration adds nothing the standalone game itself depends on.
- **Relative path safety**: the build script itself scans the generated `index.html` and `catalog.json` for `../games/`, `../editor/`, `../dist/` and fails the build if any are found -- confirmed clean on every run this pass.

## 6. Bugs Found

| Issue | Classification | Resolution |
|---|---|---|
| Catalog genre/description text for the 7 Technical entries literally read "Technical Sample" / "kept for engine regression coverage" -- internal language that would have shown directly on public player-facing cards | **Content issue (catalog metadata), not an engine bug** | Fixed at the source: `games/catalog.json`'s own genre/description fields rewritten to calm, player-facing wording. Applies everywhere the catalog is read (editor Games tab, both generated sites), not patched per-template. |
| Card genre line showed a literal " · n/a" for the two legacy-format games with no recorded controller | **Site/build bug (minor)** | Fixed in all three card-rendering call sites (editor Games panel, `build-games.js` launcher, `build-games-site.js` site) with one consistent guard: omit the controller segment entirely when it's `"n/a"`. |
| Real screenshot capture via `canvas.toDataURL()` + this session's own text-relay produced a corrupted PNG (confirmed via failed `zlib.inflate` on the file's own IDAT chunk) | **Test/tooling artifact of this automation session, not an engine bug** | Not fixed -- correctly routed to the task's own stated fallback (generated title-card art) instead of chasing a more fragile capture pipeline. |
| My own first live read of `placed.length`/`playMode` immediately after clicking a Games-tab Play button showed stale pre-load values (43 objects, `playMode:false`) | **Test artifact (my own script read state before the catalog loader's `await fetch(...)` resolved)** | Not a product bug -- re-checking a moment later showed the correct post-load state (80 objects, `playMode:true`, correct level name). No code change. |

No product/engine bugs were found or fixed this pass. This pass's own scope (discovery/access/packaging) was respected -- no physics, AI, renderer, weapons, terrain, animation, Node Graph, or Save Game code was touched.

## 7. API-FRICTION / CHANGELOG

- **API-FRICTION additions**: none. Every issue found this pass was a content, build-script, or test-methodology issue -- not a reusable engine/editor API limitation. No entries invented to pad the log.
- **Public API changes**: none.
- **CHANGELOG**: updated under `### Digital Opus Games Public Hub` (not Wave 10).

## 8. Final Verdict

**DIGITAL_OPUS_GAMES_HUB_READY**

The public hub works end-to-end: every game link resolves (broken-link check passed, 28/28), all 7 Featured games boot cleanly when launched from the actual hub (not just inspected), the output is genuinely static and deployment-ready (verified via an entire-site clean-room copy AND a single-game-alone copy, both served fresh with zero repository dependency), build output is deterministic and repeatable, and the editor's existing Games tab / manual JSON import / Crate Run default all remain fully unaffected. The one secondary item intentionally deferred (real screenshots, replaced with generated title art for all 7 Featured games) does not block the primary goal -- a visitor can already arrive, understand the site, browse, and play, with zero JSON/editor/repository knowledge required.

## 9. Wave 10

Not started. This pass changed only public-facing packaging/presentation (a new template, a new build script, catalog metadata wording) -- no engine capability, no new game, no gameplay-system change. Nothing found this pass points at any capability theme.

Do NOT start Wave 10.
