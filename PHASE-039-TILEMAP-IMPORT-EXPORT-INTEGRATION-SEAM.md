# Phase 039 Tilemap Import / Export Integration Seam

Phase 038 intentionally stopped at internal project Assets. Phase 039 closes this seam with the first-party `digital-opus-tilemap-bundle` v1 format for whole Tilemaps and independent Tilemap Chunks.

The implemented format preserves Digital Opus semantic Terrain and Auto-Tile ownership without flattening, packages a complete Tileset and required asset/Prefab closure, embeds deduplicated bytes, verifies canonical SHA-256 integrity, previews deterministic cross-project remaps, and commits atomically with one Undo.

TMX, Tiled JSON, LDtk, compressed transport, and streaming remain outside v1 and are not implemented. See the format, determinism, closure, import, security, and root-semantics contracts plus the Phase 040 seam.
