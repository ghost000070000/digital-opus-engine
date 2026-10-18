# Phase 034 — Tile Collision Metadata Qualification

## Verdict

`PHASE_034_TILE_COLLISION_METADATA_READY`

Every required Phase 034 gate passed. Phase 035 was not implemented.

## Baseline and final build

- HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`; the inherited dirty Phase 001–033 work was preserved without reset, clean, restore, commit, push, deploy, or DNS changes.
- Required prior verdict: `PHASE_033_MULTILAYER_TILEMAPS_READY`.
- Baseline and final engine: 166,134 bytes / 42,573 gzip / 22 sources; delta 0 / 0.
- Baseline editor package: 1,702 KB. Final: 1,715 KB; delta +13 KB.
- Final delivery demo: 184,028 bytes.

## Implemented contract

Tileset advances from v1 to v2. Every historical or new Tile normalizes to a canonical Collision record with default `none`. Collision is owned once by Tile identity—not Sprite Asset, Texture, source rectangle, Tilemap cell, or Tilemap layer. Cells remain exactly `{x,y,tileId}` and layers gain no collision-policy field.

The bounded modes are `none`, `full-cell`, and `custom-rect`. Full Cell means normalized 0,0→1,1 without redundant rectangle storage. Custom Rectangle owns finite Left/Bottom/Right/Top values inside 0..1 with strict positive area. Invalid or unknown authored data remains visible for repair, produces one Tile-level issue, and safely resolves to None.

Normalized cell space is independent of artwork pixels, source rectangle, Sprite pivot, PPU, or alpha. Cell Size scales the derived local rectangle without rewriting metadata. Pure helpers resolve Tile metadata, derive Tilemap-local rectangles, and transform four corners through translation, scale, rotation, and optional parent composition. They create no objects and expose no gameplay collision query.

## Authoring and overlay

The Tile Palette exposes a keyboard-native mode selector, four Custom Rectangle numeric fields, one-click Full Cell, creator help, text badges, and a visual cell/art/collision preview. Numeric input is the qualified authoritative editor; drag handles were intentionally not added.

Mode and rectangle edits participate in shared snapshot Undo/Redo and commit immediately for Save and Export. Rename, reorder, Sprite-ref change, Tile duplication, Tileset duplication, Save/Load, validation, and exact Tile navigation preserve or target collision correctly.

The editor-only Tilemap Collision Overlay shows the active layer. Hidden active layers draw no shapes; locked layers remain inspectable. Full and Custom rectangles follow Cell Size and the Tilemap transform as projected quads, including negative cells and a rotated/scaled map. No overlay enters Playable output.

## Dogfood evidence

The real editor imported a seven-Tile fixture: Grass/Water/Floor/Decoration None, Wall Full then visibly edited to Custom 0.2/0.1/0.8/0.7, Rock Custom 0.1/0.05/0.9/0.75, and Tree Custom trunk 0.38/0/0.62/0.42. Tree art was 2 world units tall against a 1-unit cell height, proving artwork overhang remains separate from its sub-half-cell collision footprint.

Wall was painted at negative and positive cells and repeated across two layers. Changing its metadata updated every semantic occurrence without changing any cell record. Visible rename/revert and reorder/revert preserved its collision and painted IDs. A visible Tree Sprite-reference change preserved the exact trunk collision and was then restored.

Cell Width changed 1→2 while Rock metadata remained unchanged; its derived local X bounds changed from 0.1→0.9 to 0.2→1.8. A deliberately inverted Wall rectangle validated, resolved to None without crashing, and repaired cleanly. Undo/Redo restored exact modes. Named local Save, full page reload, Load Selected, validation, Editable export, and Playable export all retained the repaired record.

The active Collision Examples layer produced four orange collision quads for Wall, Rock, Tree, and Wall; Grass emitted none. The rotated/scaled map, negative Wall, hidden layer, and locked repeated-Wall layer behaved according to the overlay contract. Scene state retained one Tilemap object and no collider object.

## Export and browser evidence

- Editable: 1,763,823 bytes, all 7 Tiles, 3 collision-bearing Tiles; the exported editor reopened Wall collision controls, switched Full→Custom, committed Left 0.25, and rendered the active-layer overlay.
- Playable: 1,763,137 bytes, 5 dependency-pruned used Tiles, 3 collision-bearing Tiles. Policy: metadata is retained on used Tile records but has no runtime consumer.
- Editable/Playable Tilemap layer parity passed.
- Both exact files booted with one Tilemap, cell keys only `tileId/x/y`, no collider objects, no Playable editor chrome, no page errors, no console errors, and no external requests.
- Evidence: `phase-034-dogfood.json`, `phase-034-export-proof.json`, and `qualification/phase-034/phase-034-collision-overlay.png`.

## Qualification

- Phase 034 focused: 86/86.
- Phase 032 regression: 52/52; Phase 033 regression: 85/85.
- Phase 011–034 focused: 1,274/1,274 across 24 suites.
- Integrated runner: 1,636/1,636 (qualified Phase 033 total 1,550 plus 86 Phase 034 checks).
- 1,000 mixed Tile normalization/validation/serialization/lookup sanity: pass.
- 2,500-cell overlay-resolution sanity: pass; cells remained metadata-free and object count unchanged.
- Browser/editor/export audit: pass.
- Public games: 28/28, 123.8 MB; no game 29 or dogfood public route.
- Engine site: 28/28 examples, path and link checks pass, 225.3 MB total.
- Games site: 28/28, path and link checks pass, 145.4 MB.
- Capability catalog: 57 valid entries; A=5, B=33, C=18, D=0, N/A=1.
- Syntax checks and `git diff --check`: pass; only existing LF→CRLF working-copy warnings were emitted.

## Capability, friction, and roadmap

Tilemaps remains B: collision intent is useful and physics-ready, but it is not actual collision behavior. Sprites / 2D remains B. AFR-0002 remains resolved for the common Tilemap path and now records Phase 034 collision-intent authoring; broader 2D physics/gameplay gaps remain open.

Observed bounded friction: normalized 0..1 coordinates require explanation, and repeated Custom Rectangle setup remains numeric and potentially repetitive. The preview, creator labels, and Full Cell shortcut mitigate this; no speculative drag editor, bulk system, or presets library was added.

Future physics may consume `Tilemap → Layer → Cell → Tile → collision → normalized rect → Cell Size → Transform`, but must separately decide static geometry strategy and layer collision participation. Triggers, one-way behavior, slopes, character response, circles/polygons, and bodies remain deferred.

Epochs 01–03 remain qualified. Epoch 04 Phases 031–034 are qualified. Phase 035 (auto-tiling) is the recommended next phase and remains planned, not implemented. Phases 036–040 remain planned.
