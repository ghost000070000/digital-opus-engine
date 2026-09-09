# Digital Opus Engine — Public Home Report

**This is a product/distribution report, not a Capability Wave, not Wave 10, not a dogfood report.** This pass gave Digital Opus Engine its own public-facing home and packaged editor, entirely separate from the existing, real, live Digital Opus Games portfolio at `games.digitalopusadsolutions.com`. Nothing was deployed anywhere.

## 1. Product

- **Positioning**: Digital Opus Engine answers "what can I build?" -- a local-first, browser-native 3D game builder. It is explicitly distinguished from Digital Opus Games ("what games can I play?"), a separate, already-live 43-game portfolio that remains completely untouched.
- **Hero**: "Digital Opus Engine / Build 3D games directly in your browser. Local-first. Visual authoring. Play, save, edit and export games without a traditional heavyweight engine install." Primary CTA "Open the Editor", secondary "Play Example Games", tertiary "Explore Features". No inflated claims (no "AAA", no "Unity/Unreal replacement").
- **Features**: five grounded pillars (Browser Native, Local First, Visual Authoring, Standalone Export, Real 3D Systems) plus four concise feature groups (Build Worlds, Build Gameplay, Characters & Combat, Presentation) -- all naming only shipped capability.
- **Sample integration**: the home page's "Built With Digital Opus Engine" section and the `games/` subpage both render entirely from `games/catalog.json` -- no hardcoded title list anywhere. Public wording avoids internal terms ("Featured"/"More Examples"/"Experimental", never "Technical Regression Fixtures").
- **Creator journey**: Home → Open the Editor → (optionally) Games tab → Open in Editor → modify → Play/Export. Player journey: Home → Play Example Games → pick a card → Play. Both proven live, not assumed (Section 4).

## 2. Build

- **Landing-page template**: `build/templates/engine-home.html`
- **Games-hub template (reused)**: `build/templates/games-site.html` (now parameterized so the same template serves both the standalone Digital Opus Games CLI build and the Engine's own examples subpage with different branding copy)
- **Build script**: `build/build-engine-site.js`
- **Output location**: `dist/engine-site/`
- **Package structure**:
  ```
  dist/engine-site/
    index.html            Engine home
    editor/index.html     packaged editor (unmodified)
    editor/src/01-editor.js
    dist/opus-engine.js   editor's own ../dist/ dependency
    build/export-template.js   editor's own ../build/ dependency
    games/                Engine examples hub (28 games + catalog.json + assets + raw project JSON)
    DEPLOYMENT-README.txt
  ```
- **Total package size**: 34.5 MB (editor package ~1.16 MB; 28 examples ~32.7 MB; home page + hub pages a few tens of KB)
- **Game count**: 28 examples (unchanged; no game #29)
- **Featured count**: 7

## 3. Editor Packaging

- **Runtime files included**: `editor/index.html`, `editor/src/01-editor.js` (byte-identical copies of the repository's own files -- never modified for packaging), `dist/opus-engine.js`, `build/export-template.js`, plus `games/catalog.json` and every `games/<id>.json` (needed so the packaged editor's own Games tab can fetch raw project data, exactly like the dev editor already does -- not a new "download source" feature; the identical JSON is already embedded, in full, inside every generated game's own view-source).
- **Repository paths removed**: confirmed via an automated scan for `C:\Users\...`, `localhost:8180`, `127.0.0.1` across the package -- clean.
- **Clean-room load**: the entire `dist/engine-site/` folder was copied to a genuinely unrelated directory and served by a fresh, separate static server (temporary launch config, removed after testing). All four required journeys (Section 4) were run against THAT copy, not the dev tree.
- **Crate Run**: loads correctly from the packaged editor (`editor/`) -- default starter game visible and playing, zero console errors.
- **Games tab**: loads all 28 cards correctly from the packaged editor.
- **Open in Editor**: works correctly (see Section 5, Bugs -- required one real fix).
- **Imports**: a real, original 4x4 PNG was created in-browser and pushed through the actual Import Texture file-input UI from the packaged editor -- succeeded, proving packaging did not break real file-input handling.
- **Export**: both Playable and Editable Export were exercised from the packaged editor (Section 4, Journey C+).

## 4. Clean-Room Journeys (all four, from a genuinely separate directory, not the dev tree)

**A. Home → Open Editor → Crate Run → Play**
Navigated to the clean-room copy's `/`, clicked "Open the Editor" (`href="editor/"`), landed on the packaged editor showing the default Crate Run starter game, already live and playing. Zero console errors.

**B. Home → Play Example Games → Foglight → Start**
Navigated to `/games/`, clicked "Play Foglight" (`href="foglight.html"`), confirmed correct title ("Foglight"), Start Screen visible, 80 objects loaded, zero network requests. Dismissed the Start Screen and confirmed `playMode` became `true`.

**C. Editor → Games → Foglight → Open in Editor → modify → Play** (the most important proof)
From the packaged editor: opened the Games tab (28 cards), clicked "Open in Editor" on Foglight. **First attempt failed** with a real bug (see Section 5) -- fixed at the root, then reproduced the full journey cleanly: Foglight loaded (80 objects, level name "Vale", Edit mode), moved the `GroveGate` object (+7 on its X axis), entered Play successfully (`gameEnded: false`).

**D. Public Editor → small import/export proof**
A real PNG texture was imported via the actual Import Texture file-input UI (succeeded). A real Playable Export was then built from the packaged editor (`buildExportHTML(true)`) and opened in an isolated `<iframe srcdoc>` realm: confirmed the moved gate's position (`x: 7`) was correctly embedded, title correct ("Foglight"), zero network requests. A real Editable Export was also built and opened in isolation: confirmed the genuine "🛠 Edit This Game" toggle is present and the playable-only flag is correctly *not* set at runtime (an initial naive string-search check falsely flagged this -- see Section 5, Test Artifacts, for why that was a false positive, not a bug).

**Bonus: subpath portability** -- the same clean-room package was additionally served nested three levels deep (`/test/engine/`); the home page, packaged editor, and a game (`games/foglight.html`) all resolved correctly, confirming every internal link in the package is relative, never root-absolute.

## 5. Product Separation (explicit record)

- `games.digitalopusadsolutions.com` (the existing, separate, real 43-game Digital Opus Games portfolio): **not touched** -- no files copied there, no DNS/hosting changes, no catalog merge in either direction.
- Digital Opus Engine's own example catalog: **28 games**, unchanged count, sourced entirely from `games/catalog.json`.
- No new game was created (no #29).
- The Engine home page's own footer/About section links to Digital Opus Games explicitly labeled as "a separate collection" -- never presented as the same product or a new Digital Opus Games release.

## 6. Bugs

### Product/site bugs
None found this pass beyond the packaging bug below.

### Packaging bugs
**One real, reproducible bug, found live and fixed at the root**: the editor's own Games tab (`openCatalogGame`) fetched `../games/${entry.file}` to load a sample's raw project JSON. In the packaged engine-site, `../games/catalog.json` resolves to the PUBLIC catalog `buildGamesSite()` generates (whose `file` field intentionally points to the compiled `<id>.html`, for that hub's own card links) rather than the dev-source catalog (whose `file` field points to the raw `<id>.json`). "Open in Editor" therefore tried to fetch a nonexistent `foglight.html`-shaped path and failed with `Unexpected token '<'` (an HTML 404 page mistaken for JSON). **Fixed** by having `openCatalogGame` fetch `${id}.json` (built from the catalog's own stable, always-`<id>.json`-named id) instead of trusting the `file` field -- correct under either catalog shape. Reproduced before the fix, re-verified fixed after, confirmed working in both the packaged clean-room editor and the normal dev editor.

### Editor bugs
None found beyond the above (which is arguably an editor bug surfaced BY packaging, not a packaging-tool bug -- classified here as "packaging" since it only manifests when the editor is packaged alongside a public games hub, never in the plain dev-tree Games tab).

### Game bugs
None found this pass.

### Test artifacts
- My own first read of `placed.length`/`playMode` immediately after clicking a Games-tab button, before its `await fetch(...)` resolved, showed stale values -- not a bug, just read-too-early on my part (same pattern already documented in a prior pass's own report).
- A naive `html.includes('window.__OPUS_PLAYABLE_ONLY__ = true')` check on an Editable Export returned a false positive, because that literal string appears inside `composeExportHTML`'s own embedded source code (needed for the re-export chain) regardless of which branch actually executes. Verified correctly instead by loading the export in an isolated realm and reading the actual runtime value (correctly absent/falsy).

### Environment limitations
None new this pass. (No screenshot automation was attempted -- Section 32's own instruction not to reopen that investigation was followed; generated title-card art, already produced in a prior pass, was reused as-is.)

## 7. Optional Features — Decisions

- **Deep-link Open-in-Editor** (`editor/?game=<id>`): **implemented** -- a small, ~10-line addition reusing the existing `openCatalogGame` (no router, no new project-loading architecture). Verified: `openGameFromURLParam()` reads `?game=` once the catalog is available and opens that sample in Edit mode.
- **Game HTML download**: **deferred**. Every example is already a self-contained, directly-linkable `.html` file (proven by the portability tests); a dedicated "Download" button was judged unnecessary clutter for v1, consistent with keeping card actions to Play (primary) and Open in Editor (secondary).
- **Project JSON public download**: **deferred**, explicitly. The packaged editor's Games tab does fetch raw `<id>.json` files internally (see Section 3), but no public-facing "Download Project (.json)" link or button was added to any card. This is a deliberate, disclosed distinction: internal tool requirement, not a promoted public feature.
- **Real screenshots**: **still deferred**, per this pass's own explicit instruction not to reopen that investigation. All 7 Featured examples use the generated title-card art already produced in the prior pass.

## 8. CHANGELOG

Updated under `### Digital Opus Engine Public Home`. Does not claim any production URL -- nothing is live.

## 9. Final Verdict

**`DIGITAL_OPUS_ENGINE_PUBLIC_HOME_READY`**

The Engine landing page works, the packaged public editor works (including a real found-and-fixed packaging bug, now verified resolved), example games work (all four required clean-room journeys passed, plus a bonus subpath test), the deployment package is fully self-contained (no repository/dev-environment path dependency, confirmed by an automated scan and by clean-room + subpath testing), and product separation from Digital Opus Games is complete and explicit.

## 10. Proposed Deployment Target

`PROPOSED_DEPLOYMENT_TARGET: engine.digitalopusadsolutions.com`

Not created. No DNS record was added or checked for this subdomain this pass (out of this pass's own scope -- packaging only). The package also tolerates subpath hosting (e.g. `/engine/` on an existing host) if that is preferred instead, since every internal link is relative.

## 11. What Must Be Authorized Before Actual Deployment

1. Confirm `engine.digitalopusadsolutions.com` (or an agreed alternative path/subdomain) as the real target.
2. Authorize DNS creation for that specific subdomain only (no other record should be touched).
3. Authorize the actual file upload/hosting step (this environment has no hosting credentials, matching the prior pass's own finding).
4. Reconfirm, immediately before upload, that `games.digitalopusadsolutions.com` still resolves to the separate, unrelated 43-game portfolio and remains untouched by this deployment.

## 12. Wave 10

Not started. `WAVE_10_NOT_JUSTIFIED`. This pass was packaging and public-facing content only -- no engine capability was added, changed, or evidenced as needed.

Do NOT start Wave 10.
