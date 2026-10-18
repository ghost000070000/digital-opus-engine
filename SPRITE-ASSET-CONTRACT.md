# Sprite Asset Contract

Phase 012 adds one first-class `sprite` asset type through the Phase 003 Asset Type Registry. It is reusable metadata over an existing Texture Asset; it never owns or duplicates image bytes.

## Record

```json
{
  "id": "spriteAsset1",
  "type": "sprite",
  "name": "Hero",
  "version": 1,
  "sourceTexture": "texture1",
  "pivot": [0.5, 0.5],
  "pixelsPerUnit": 100
}
```

`id` is identity; `name` is an editable label. `sourceTexture` is a typed stable Texture reference. Optional folder and tag values reuse existing Asset Library conventions. Image payload, decoded image, and GPU texture stay on the Texture Asset.

## Validation and dimensions

- Version is `1`.
- Pivot X and Y are finite values in `[0, 1]`.
- Pixels Per Unit (PPU) is finite and greater than zero; the default is `100`.
- Source width and height come from the existing Texture decode path and are persisted on Texture records when available.
- Natural world size is `source pixels / PPU`. This is a size-conversion contract, not pixel-perfect rendering.
- A missing source does not delete the Sprite Asset or clear its ID. The library shows a missing placeholder, Project Validation reports the problem, and the creator can select a replacement Texture.

## Renderer resolution and compatibility

Sprite Renderer version 2 adds `spriteAssetRef` while retaining the Phase 011 `sourceTexture` field:

1. A valid `spriteAssetRef` resolves Sprite Asset → Texture Asset.
2. If the Sprite Asset reference is absent or missing, a legacy direct `sourceTexture` may resolve.
3. Otherwise the safe missing-texture placeholder renders.

Existing Phase 011 records migrate to version 2 with their direct Texture, Width, Height, pivot, tint, visibility, and integer Layer intact. Conversion is explicit and appearance-preserving. Renderer Width and Height remain per-instance. New instances placed from a Sprite Asset copy its pivot and calculated natural size; later asset edits do not unexpectedly resize existing instances. `Use Asset Pivot` and `Apply Natural Size` are explicit instance actions.

## Dependency and deletion behavior

The registry dependency hook declares Sprite Asset → Texture Asset. Export begins at a referenced Sprite object, includes its Sprite Asset, then includes the one source Texture and image payload. Unused Sprite/Texture pairs are pruned by the existing policy.

Duplicating a Sprite Asset creates a new Sprite ID and deep-copied metadata while keeping the same Texture ID. Deleting a referenced Sprite Asset or source Texture warns first; if accepted, references remain visible and repairable rather than cascading or silently clearing.

## Boundaries

Phase 012 does not add sorting layers, order-in-layer, slicing, atlases, animation, filtering controls, cameras, 2D collision/physics, Tilemaps, nine-slice, or 2D lights.
