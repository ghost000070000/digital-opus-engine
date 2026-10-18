# Phase 040 Tilemap Performance Integration Seam

Phase 039 established the deterministic portable format. Phase 040 qualifies that path at 10,240 simultaneous populated cells and replaces per-cell draw submission with transient cached consecutive render-state batches.

The Phase 040 cache is runtime-only. It is revision-invalidated, never serialized, retains authored order, splits below Uint16 limits, preserves Sprite and hybrid pass placement, and releases buffers when Tilemaps or the renderer are destroyed. Camera changes reuse geometry. The canonical mixed-filter world submits three Tilemap draws; no GPU instancing, view culling, dirty-region rebuild system, world streaming, or infinite-map format was introduced.

Phase 041 may consume the existing collision metadata through its own explicitly bounded collider/physics contract. It must not treat the render cache as authoring state or silently change Tilemap persistence. Later performance work may evaluate 100k-cell authoring bundles, Worker-based preview verification, streaming decoding, progress/cancel, compression, or world streaming while preserving v1 canonical bytes, atomic preview/commit semantics, Playable parser absence, and clean re-export guarantees.

Phase 040 is closed as `PHASE_040_TILEMAP_10K_PERFORMANCE_READY`; Phase 041 was not started.
