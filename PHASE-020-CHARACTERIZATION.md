# Phase 020 Sprite Foundation Characterization

## Canonical ownership

`kind: "sprite"` is the authored flat-world object. Its version-4 `sprite-renderer` component owns stable Sprite Asset identity, per-instance Width/Height and pivot overrides, tint, opacity, visibility, Sorting Layer ID, and Order in Layer. The version-3 Sprite Asset owns source Texture identity, optional top-left-origin source rectangle, default pivot, Pixels Per Unit, and Smooth or Pixel / Nearest filtering. Scene and Prefab records do not duplicate atlas coordinates or filtering.

## Runtime and hybrid ordering

Sprite geometry is pivot-aware, unlit, and retains authored Transform orientation. Sprites sort by project layer order, integer Order in Layer, and stable Object ID. Transform Z remains spatial. Opaque and transparent 3D passes still obey ordinary depth; the Sprite pass retains depth testing against opaque 3D and disables depth writes while drawing ordered transparent Sprite planes.

A Billboard remains a legacy-compatible 3D cube record using the Billboard mesh, generic Texture/Material fields, lighting, alpha, full/cylindrical camera-facing modes, and 3D depth. It never receives a Sprite Asset or Sprite Sorting Layer. Camera orbit during dogfood made authored Sprites edge-on while the Billboard continued facing the camera.

## Authoring behavior

Sprite Asset rows use a typed `{ assetType: "sprite", assetId }` placement payload. Drop resolves the stable ID at commit time, uses the existing perspective camera ray and ground plane, applies optional spatial snap, creates one ordinary Sprite record, pushes one Undo snapshot, selects the result, and opens the Inspector. Search, filters, folders, tags, and the non-drag **Place Sprite** command reuse the same path.

Direct resize and pivot handles operate on the same component record and create one Undo step per gesture. Inspector conveniences are explicit operations. Asset metadata remains live through stable identity, while copied instance Width/Height and pivot are overrides until **Use Natural Size** or **Use Asset Pivot** is invoked.

## Persistence, reuse, and repair

Sprite records use the ordinary Level, Save/Load, duplicate, Undo/Redo, hierarchy, Prefab, Editable Export, and Playable Export infrastructure. Linked Prefab propagation is intentionally manual: **Update Prefab From This** changes the stored template, and each linked instance changes only when **Update From Prefab** is requested. There is no hidden live override merge.

Project validation preserves broken IDs and reports repair context. Missing Sprite Asset, source Texture, and Sorting Layer references are detectable and repairable without destroying the owning object or asset. Deleting a used sorting layer is guarded and explicitly reassigns owners to Default; Default itself is reserved.

Export closure is `Sprite instance → Sprite Asset → Texture`. Unused Sprite Asset metadata is pruned. A direct-Texture legacy Sprite follows the Texture dependency path. Both tiers embed the same serialized project and shared runtime/editor source; playable-only mode is one boot flag, not a divergent renderer.

## Compatibility and limits

Current loading migrates Phase 011 integer `layer` and direct Texture records into version 4, retains Phase 012 Sprite Asset identity, normalizes project sorting layers introduced in Phase 013, defaults pre-Phase-017 opacity/filtering compatibly, accepts Phase 018 full-image or atlas Sprite Assets, and treats Phase 019 placements as ordinary Sprites.

The qualified grade is **B — No-code common path**, not A. Perspective cameras, transparent 3D overlap limitations, Texture-wide mip behavior, and manual prefab propagation are documented constraints. Orthographic/pixel-perfect cameras, Sprite animation/playback, Tilemaps, and 2D collision/physics are not present and were not simulated.
