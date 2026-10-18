# Phase 033 Baseline Characterization

Baseline HEAD was `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`, ahead of `origin/main` by one commit, with 461 pre-existing dirty entries preserved. Baseline build output was 166,134 engine bytes / 42,573 gzip bytes from 22 sources and 184,028 delivery-demo bytes. The integrated runner passed through Phase 032; Phase 032 focused was 52/52. The public build remained 28/28 games and 123.0 MB.

## Qualified Phase 032 authority

The historical Tilemap record was version 1 with object identity, Transform fields, one `tilesetRef`, one top-level sparse `cells[]`, one Sorting Layer reference, and one integer Order in Layer. Cell normalization, the transient WeakMap index, lookup, set, erase, clear, count, bounds, stroke interpolation, used-Tile collection, and validation lived in `editor/src/00-authoring-plumbing.js`. Canonical cell order was Y then X and duplicate corrupt inputs normalized last-input-wins.

`editor/src/01-editor.js` owned explicit Paint/Erase state, Bresenham drag interpolation, one snapshot at the first semantic stroke mutation, Inspector controls, transformed plane picking, runtime descriptor resolution, Save/Load instantiation, duplication through the shared record path, dependency collection, and Editable/Playable serialization. `engine/src/09-renderer.js` treated the Tilemap as one Sprite-pass entity and emitted its cells contiguously. `engine/src/11-entity.js` composed each transient cell descriptor under the one Tilemap Transform.

Editable Export retained full Tileset authoring data. Playable Export scanned the top-level cell list, retained used Tile/Sprite/Texture dependencies, and booted the same runtime/editor bundle without editor chrome. Structured validation covered version, identity, sparse cells, coordinates, duplicate coordinates, missing Tile IDs, and integer Order in Layer.

## Migration constraint

Phase 033 must replace the top-level cell authority, not layer another competing model over it. Version 1 remains read-compatible; its cells migrate deterministically into `tilemap-layer-default`. Version 2 canonical Save/Export writes only `layers[]`. The qualified Transform, Tileset, Sprite sorting, picking, stroke grouping, runtime texture resolution, hybrid pass, and export mechanisms remain shared.
