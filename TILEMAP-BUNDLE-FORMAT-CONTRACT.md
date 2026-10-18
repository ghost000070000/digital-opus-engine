# Tilemap Bundle Format Contract

The first-party format identity is `digital-opus-tilemap-bundle`, version `1`. A bundle root is either `tilemap` (`.opus-tilemap.json`) or `tilemap-chunk` (`.opus-chunk.json`). One file contains the root, its required authoring dependency closure, a content-addressed blob table, and SHA-256 integrity metadata.

Tilemap roots exclude scene-object identity, hierarchy membership, groups, and local-parent transform fields. A parented Tilemap must be detached before export. Its detached position, rotation, scale, ordered Layers, visibility/lock state, semantic Cells, sorting, and Spawn Markers remain portable. Chunk roots retain their Asset ID/name and remain independent of a source Tilemap.

The dependency envelope has exactly one full Tileset plus required Sprite Assets, Textures, Prefabs and recursive Prefab dependencies, mesh/audio/animation dependencies used by those Prefabs, and referenced sorting-layer descriptors. All Tiles in the Tileset remain present even when unused. Ordinary scene objects are excluded.

See `schemas/digital-opus-tilemap-bundle-v1.schema.json` for the published envelope schema. The executable validator in `editor/src/00-tilemap-bundle.js` is intentionally stricter about limits, base64, MIME types, hashes, canonical bytes, and unsafe object keys.
