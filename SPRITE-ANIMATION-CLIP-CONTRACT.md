# Sprite Animation Clip Contract

## Identity and shape

`sprite-animation` is a version 2 Asset Type Registry entry. A clip has a stable `id`, creator-facing `name`, ordered `frames`, `playbackMode`, and optional library `folder`/`tags`. Renaming changes only the display name. Version 1 records migrate to version 2 with `playbackMode: "once"`.

```json
{
  "id": "spriteAnimation1",
  "type": "sprite-animation",
  "name": "Walk",
  "version": 2,
  "playbackMode": "once",
  "frames": [
    { "spriteAsset": "spriteAsset1", "durationMs": 100 }
  ]
}
```

Each frame owns exactly a typed Sprite Asset ID and a positive finite duration in milliseconds. Array position is frame order. The authoring default is 100 ms; the abuse-prevention maximum is 60,000 ms. Frames never copy Texture data, source rectangles, pivot, PPU, filtering, transform, material, sorting, or events.

## Authoring and validation

Clips live in the existing Asset Library and open one dedicated visual editor. It supports create, select, search, type filtering, rename, folder/tags, independent duplicate, guarded delete, visual Add/Remove/Duplicate Frame, drag reorder, Move Left/Right fallback, per-frame timing, preview, scrubbing, and Once/Loop. An empty clip is preserved but reports `sprite-animation-empty`. A one-frame clip is valid. Invalid duration or mode, missing Sprite Asset, wrong reference type, and missing Sprite Renderer clip references are structured validation errors with navigation back to the clip or affected Sprite.

Deleting a referenced clip warns and preserves repairable dangling Sprite references. Deleting a Sprite Asset used by a frame reports the dependent clip and does not cascade-delete it.

## Persistence and closure

Project format 6 stores `spriteAnimations`, frame order/durations, and Sprite Renderer `animationClipRef`/`playOnStart`. Transient playback time is excluded. Export closure is Sprite instance → clip → referenced Sprite Assets → each Sprite Asset's Texture; unused clips and unrelated atlas cells remain prunable, and repeated atlas frames do not duplicate image payloads.

Phase 022 still excludes state machines, transitions, events, directional variants, transform keyframes, per-frame offsets, ping-pong/reverse, and professional timeline infrastructure.
