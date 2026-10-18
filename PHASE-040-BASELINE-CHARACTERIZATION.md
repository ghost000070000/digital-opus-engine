# Phase 040 Baseline Characterization

## Repository baseline

- HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`
- Branch: `main`
- Dirty worktree preserved.
- Engine: 166,134 bytes raw / 42,573 bytes gzip / 22 sources.
- Baseline build, integrated tests, and 28/28 public games passed.

## Runtime Tilemap path before Phase 040

`syncTilemapRenderer` flattened every visible Layer in authored bottom-to-top, row-major order. It resolved stable Tile IDs through one `Map`, then resolved Sprite Assets and Texture handles while constructing a transient cell list. Terrain, Auto-Tile, Chunk, validation, usage indexing, and portable Bundle logic were not called by the steady render loop.

The renderer then iterated every cell every frame. Each cell performed texture/sampler state checks, base-color/UV/model uniform uploads, an allocation-heavy `_tilemapCellModelMatrix` composition, and one `drawElements`. Geometry used the shared unit Sprite quad; unchanged Tilemap geometry was not cached. A homogeneous 10,240-cell map therefore produced approximately 10,240 Tilemap draw calls and per-cell matrix allocations per frame. There was no Tilemap view culling or buffer reuse because there were no Tilemap-owned buffers. This failed the explicit Phase 040 draw-call architecture gate before frame qualification.

The sparse authoring model already had transient O(1) `WeakMap` cell indexes. Paint, Erase, and neighbor lookup use keyed Maps; invalidation occurs after structural replacement. Canonical serialization sorts cells, but steady lookup does not scan the full map.

## Editor path

- Grid overlay cost scales with occupied coordinate bounds and is emitted as two SVG paths, not thousands of DOM nodes.
- Hover and world-to-cell calculations are constant-time transforms.
- Selection is scene-object based; 10k Cells do not create 10k scene-list rows or Asset cards.
- Layer and Inspector summaries scan bounded Layer metadata; Tilemap validation is explicit, not per-frame.
- Collision overlay resolves collision-bearing cells only when enabled. Spawn Markers render as SVG overlay nodes; the canonical fixture uses 100.
- Brush footprint and Chunk preview are explicit interaction paths. Terrain/Auto-Tile resolution runs on authoring mutations, never in steady runtime frames.

## Measured decision

The baseline draw architecture was the dominant, certain blocker. The smallest justified change was transient consecutive render-state batching with one cached geometry build per Tilemap revision. GPU instancing, dirty-region meshes, octrees, world streaming, and a new culling system were not justified.
