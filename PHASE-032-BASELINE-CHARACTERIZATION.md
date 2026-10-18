# Phase 032 Baseline Characterization

Run ID: `phase-032-20260916-115829`  
Started: `2026-09-16T18:58:29.6469133Z`

## Baseline

- HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`.
- The pre-existing dirty worktree had 441 porcelain entries at capture time and is preserved.
- Engine: 164,608 bytes / 42,346 gzip / 22 sources.
- Integrated: 1,413/1,413; Phase 011–031 focused: 1,051/1,051.
- Public games: 28/28; editor package from Phase 031: 1,649 KB.
- No reset, clean, discard, commit, branch, push, deploy, DNS, global configuration, dependency download, or public catalog change was performed.

## Phase 031 seams reused

Tileset normalization and validation live in `editor/src/00-authoring-plumbing.js`. `createTileset`, `getTilesetById`, `getTileById`, the asset-type registry dependency hook, `buildReferenceIndex`, and `collectProjectIssues` are the canonical data paths. `editor/src/01-editor.js` owns project `tilesets`, `activeTilesetId`, `activeTileId`, Tile Palette rendering, immediate edits, shared snapshot history, project serialization, dependency closure, and export composition. Playable export currently excludes authoring-only Tilesets; Phase 032 will turn painted Tilemaps into runtime roots.

## Scene and Transform seams reused

The canonical scene list is `placed`. `addPlaced` assigns stable object identity. `serializeItemRecord`, `instantiateItemFromRecord`, and `loadScene` are the shared Save/Load, Level, duplication, Undo/Redo, and export reconstruction paths. Entity-backed objects use ordinary `Entity.position`, `Entity.quaternion`, `Entity.scale`, `parentId`, local Transform fields, and `updateHierarchyTransforms` / `resolveWorldTransform`. `itemPosition`, `hierarchyCapable`, Scene selection, `pickEntity`, and the Move/Rotate/Scale gizmo are the existing authoring seams.

## Rendering seam reused

The Sprite render mesh is one XY quad. `syncSpriteRenderer` resolves Sprite Asset → Texture, source rectangle UVs, natural size, filtering, alpha, Sorting Layer and Order in Layer. `Renderer.renderScene` owns the bounded pass order `opaque → transparent behind → complete Sprite pass → transparent in front`; Sprite entities are sorted by layer order, object order, then stable ID and drawn with depth testing on/depth writes off. Phase 032 extends a single scene Entity with an internal Tilemap cell batch; it will not add scene objects per cell.

## Pointer and history seams reused

The viewport uses Pointer Events, camera `screenPointToRay`, `screenToPlanePoint`, pointer capture, and mutually exclusive drag state before selection/camera routing. Current project history is `captureEditorSnapshot` plus `pushUndo`, `undo`, and `redo`. One Tilemap stroke will call `pushUndo` only on its first semantic mutation; hover and no-op paint create no snapshot.

## Export seam reused

`collectProjectDependencies`, `serializeProject`, and `buildExportHTML` define Editable/Playable closure. A painted Tilemap becomes the first runtime Tileset consumer: the scene record retains its Tileset, used Tiles, their Sprite Assets, and shared Textures. Editable keeps full Tileset authoring; Playable may compact to used Tiles while preserving IDs and record meaning.

## Hard boundary

Phase 032 exposes one canonical sparse `cells` set. It adds no layers array, collision, physics, auto-tiling, terrain/biome rules, object cells, animated Tiles, per-cell tint/rotation/flip, chunks, interchange import, GPU instancing, or Phase 033 behavior.
