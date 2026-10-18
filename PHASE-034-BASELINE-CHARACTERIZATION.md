# Phase 034 Baseline Characterization

Captured before Phase 034 mutation on 2026-09-16.

- HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`
- Branch: `main`
- Worktree: substantially dirty from the qualified Phase 001–033 campaign; preserved without reset, clean, restore, commit, or discard.
- Required prior verdict: `PHASE_033_MULTILAYER_TILEMAPS_READY` in `PHASE-033-REPORT.md`.
- Baseline engine: 166,134 bytes / 42,573 gzip bytes / 22 sources.
- Phase 033: 85/85. Phase 011–033: 1,188/1,188. Integrated: 1,550/1,550. Public games: 28/28.
- Baseline editor package: 1,702 KB.

## Tileset v1 path

`editor/src/00-authoring-plumbing.js` registered Tileset v1 and normalized each Tile to exactly `id`, `name`, and `spriteAssetRef`. New and bulk-added Tiles were assigned stable Tileset-local IDs. Tile duplication created a new local ID while copying the Sprite reference; Tileset duplication retained local Tile IDs and deep-copied its Tile array. Validation covered Tileset identity, version, positive Cell Size, Tile ID/name uniqueness, and reference integrity.

`editor/src/01-editor.js` owned the visible Tile Palette, selected-Tile detail editor, snapshot Undo/Redo, Save/Load through `createTileset`, exact Tile validation navigation, editable serialization, and dependency traversal. Playable export excluded Tileset authoring roots and retained only dependency-closed runtime Tile art needed by Tilemaps.

Tilemap v2 cells were `{x,y,tileId}` records inside stable layers. All visible layers were flattened transiently for rendering; no per-cell entity existed. This is the preserved foundation for Tile-owned collision intent.
