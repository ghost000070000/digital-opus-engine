# Phase 031 Report — Tile Palette and Tileset Asset Foundation

Status: qualified. Phase 031 adds the reusable asset/palette foundation and stops before world Tilemap implementation.

## Baseline and preservation

- Baseline HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`; the heavily dirty pre-existing worktree was preserved.
- Phase 030 baseline: engine 164,608 bytes / 42,346 gzip; 1,335/1,335 integrated; 973/973 Phase 011–030 focused; 28/28 public games; 1,617 KB editor package.
- No reset, clean, discard, commit, push, deploy, DNS change, public catalog addition, or game 29 occurred.

## Architecture and authoring

`tileset` is a registered version-1 project asset with stable ID/name, positive world-space cell size, and ordered Tiles. Tile identity is local and stable across rename/reorder. Each Tile stores only its ID, name, and required typed Sprite Asset reference. The authoritative chain is Tileset → Tile → Sprite Asset → Texture; no atlas pixels or rectangles are duplicated.

The normal Tileset library provides create, search/filter, inspect, duplicate, and delete. Open Tile Palette enters a dedicated searchable visual surface with Small/Medium/Large editor-only card sizes, keyboard-focusable cards, true cropped/transparent thumbnails, Pixel/Nearest presentation, bulk Sprite Asset intake, stable selection, immediate rename, typed repair, move, duplicate, and remove. Validation navigation opens the exact Tile. Tileset mutations use the existing Undo/Redo snapshot path.

Project format remains version 6 with additive normalization for older projects. Save/Load, project JSON, and Editable exports retain Tilesets and transitive Sprite/Texture dependencies. Playable exports prune authoring-only Tilesets because Phase 031 has no runtime Tilemap consumer. Directly placed Sprites remain independent runtime roots.

## Visible dogfood and export evidence

The checked-in 64x64 fixture was imported through visible controls and sliced into sixteen distinct 16x16 Pixel/Nearest Sprite Assets. Grasslands was built with 17 Tiles, semantic names, search, Floor-before-Wall reorder, and a duplicated Floor. Clearing Grass's Sprite produced one required-reference error; issue navigation focused that Tile, repair returned validation to clean. A deep-independent Grasslands Variant retained local Tile identities, changed to 2x2 cell size, and was edited without changing the original 1x1 Tileset. Normal Save/reload restored both.

The real 1,698,386-byte Editable export retained 2 Tilesets, 16 Sprite Assets, and 1 Texture; it booted, opened the Palette, renamed a Tile, and validated clean. The 1,688,147-byte Playable export booted without editor chrome or Palette and pruned all unused Tileset content. A direct-Sprite overlap audit pruned every Tileset and unrelated Sprite while retaining exactly the scene-used Sprite and shared Texture. Both isolated boots made zero external requests and produced zero page errors, console errors, or unexplained warnings; Chromium's standard pre-gesture AudioContext warning was reviewed.

Structured evidence is `phase-031-dogfood.json`; the captured editable project is `qualification/phase-031/phase-031-tileset-dogfood.json`. A 1,000-Tile lookup/serialization audit completed in 1 ms for the recorded run, and the Palette has a 256-card sanity check. These are bounded observations, not world-Tilemap performance claims.

## Capability, friction, and boundary

Sprites / 2D stays B. Tilemaps stays D: creator UI, persistence, export, validation, and discoverability are partial only because they cover the Tileset/Palette foundation, while runtime support remains absent. AFR-0002 stays CONFIRMED but is narrowed from missing all tile concepts to missing world Tilemap/Grid construction, cells, painting, rendering, layers, and collision.

Phase 032 is ready to consume the documented stable-ID seam but was not started. No Tilemap/Grid object, painter, runtime renderer, collision, auto-tiling, terrain/biome, animation, tint, or custom Tile properties were implemented.

## Qualification

- Engine: 164,608 bytes / 42,346 gzip, 22 sources, unchanged from Phase 030 (0 / 0 delta).
- Phase 031 focused: 78/78.
- Phase 011–031 focused: 1,051/1,051; Phase 011–030 remained 973/973.
- Integrated: 1,413/1,413, including Showcase 15/15 and public-site integration 1/1.
- Public games: 28/28; catalog 28; no dogfood route or game 29.
- Engine-site: path safety and broken-link checks passed; 28/28 examples; editor package 1,649 KB (+32 KB); total 223.4 MB.
- Games-site: path safety and broken-link checks passed; 28/28 games; total 143.5 MB.
- Capability/friction catalogs, source syntax, diff whitespace, browser/export audit, and Editable/Playable isolation checks passed.

PHASE_031_TILESET_PALETTE_READY
