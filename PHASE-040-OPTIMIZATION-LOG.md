# Phase 040 Optimization Log

## Cached consecutive Tilemap batches

- Measured problem: the baseline submitted one draw call and one matrix/UV update per populated Cell per frame; 10,240 Cells implied about 10,240 Tilemap draws.
- Change: cache local-space quad geometry in consecutive Texture/sampler/missing-state runs. Preserve exact authored order rather than globally regrouping transparent artwork. Split batches below the Uint16 vertex limit.
- Invalidation: `syncTilemapRenderer` replaces the renderer revision after Paint, Erase, semantic recompute, Layer replacement/visibility, Chunk stamp, Tileset/Sprite changes, and load. The next draw destroys the prior buffers and rebuilds once.
- Transform/camera behavior: one entity model matrix is uploaded per Tilemap; camera motion, zoom, rotation, scale, and translation do not rebuild geometry.
- Cleanup: deleted Tilemaps are swept every scene render and all remaining caches are released during renderer destruction.
- Instrumentation: a stable `Symbol.for('opus.tilemap.metrics')` readout exposes aggregate qualification counters without serializing cache state.
- Before: approximately 10,240 draws for the canonical 10k fixture.
- After: three consecutive render-state draws for the canonical mixed-filter world; the architectural gate is no more than 16.
- Engine delta after final implementation: 168,984 bytes raw / 43,457 gzip, +2,850 raw / +884 gzip from the 166,134 raw / 42,573 gzip baseline.
- Correctness: 30 focused tests, 250,000 deterministic cache/model mutations, known-coordinate and clean Bundle parity, regression suites, and browser output parity.

## Rejected optimizations

- GPU instancing: rejected. Cached static batches remove per-cell submission with substantially less shader/state complexity.
- Dirty-region geometry: rejected. Whole-revision rebuild latency already meets authoring gates.
- View culling: not required for the measured host; the worst-case all/mostly-visible workload passes. The current conservative policy submits the cached map geometry and lets the GPU clip it.
- World streaming, octrees, infinite maps, TMX, and animated Tiles: outside Phase 040.
