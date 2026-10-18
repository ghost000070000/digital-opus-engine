# Phase 033 Characterization

## Schema and migration

Phase 032 used Tilemap version 1 with one top-level sparse `cells[]`. Phase 033 uses version 2 and writes ordered `layers[]`. Historical cells migrate into deterministic `tilemap-layer-default` / `Layer 1`, visible and unlocked. Repeated loads generate identical IDs and cells; canonical Save/Export omits top-level cells. The global project format did not need to advance because Tilemap records already own their version and migration boundary.

Layer IDs are stable only inside their owning Tilemap. Whole-Tilemap duplication retains them; Duplicate Layer creates a new ID. Names are unique, non-empty display text and may change without changing identity. Canonical array order is bottom-to-top. The UI reverses it so topmost appears first and labels that convention.

## Authoring and history

Active Layer is transient WeakMap editor state. A valid selection is retained; otherwise the topmost visible unlocked layer is chosen, with first-layer fallback. Add inserts immediately above active; Duplicate inserts above source. Hidden and locked layers remain selectable. Hidden cells cannot be painted accidentally; locked cells cannot be painted, erased, or cleared. Lock does not prevent rename, visibility, or reorder.

Every layer operation uses the existing snapshot history. A pointer stroke stores stable Layer ID and captures one Undo snapshot at its first mutation. Layer/state changes finalize an open stroke, preventing transaction leakage or index-based misrouting.

## Rendering and dependencies

Visible layers render bottom-to-top, with canonical cells inside each layer. Hidden layers emit no render descriptors. Locked visible layers render. The flattened descriptors stay contiguous in one Tilemap Sprite-pass sort slot; ordinary Sprites cannot interleave. Orthographic/Perspective picking, opaque depth, bounded hybrid transparent bands, atlas rendering, filtering, natural art size, and missing-art presentation stay shared.

Playable dependency collection deliberately scans every layer, including hidden layers, because generic loaded-record mutation can make them visible. Tile, Sprite Asset, and Texture dependencies deduplicate normally. Editable retains every authoring flag and layer operation.

## Rejected alternatives and boundary

Rejected: child Tilemap objects, per-layer Tilesets, per-layer Transforms, name/index identity, two canonical cell stores, random migration IDs, Sprite interleaving, layer opacity/tint/parallax, collision flags, auto-tiling, terrain rules, spawn/object layers, merge/copy/move tools, folders, and solo mode.

Phase 034 owns collision metadata and generated physics. `locked` is authoring protection only. Phase 033 implements no collision, physics body, trigger, one-way platform, neighbor rule, terrain brush, biome, or object marker.
