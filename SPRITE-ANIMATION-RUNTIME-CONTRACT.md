# Sprite Animation Runtime Contract

## Playback state

Each Sprite instance owns transient `{ clipId, currentFrameIndex, elapsedMs, playing, started, completed }` state. The clip and its Sprite Assets are shared immutable authoring data; duplicates and Prefab instances never share mutable timers.

`playSpriteAnimation` starts/restarts at frame 0. `stopSpriteAnimation` returns to an unstarted state so the authored static Sprite Asset is rendered. `advanceSpriteAnimation` consumes engine delta seconds, converts to milliseconds, and crosses as many frame boundaries as required. Invalid, non-finite, zero, or negative delta is ignored. No per-Sprite timers, intervals, timeout chains, or wall-clock progression exist.

`playbackMode: once` preserves Phase 021: reaching the end sets `playing=false`, `completed=true`, and holds the final frame. `playbackMode: loop` reduces absolute time modulo total duration, wraps indefinitely with `completed=false`, and handles arbitrarily large deltas without transition-count iteration. One-frame loops are stable; empty or missing clips are safe and unplayable. A missing frame Sprite Asset preserves timing and follows the existing visible missing-source placeholder path.

## Source precedence

While playback has started, the current frame's Sprite Asset supplies Texture, sourceRect, and filtering. Before playback starts or after an explicit stop, the Sprite Renderer's authored `spriteAssetRef` is the fallback. Runtime never overwrites that static reference.

Frame switching changes artwork only. Sprite Renderer width/height and pivot remain instance-authoritative, so differently sized or pivoted Sprite Assets do not move or resize geometry. Transform, hierarchy, tint, opacity, visibility, Sorting Layer, and Order in Layer remain untouched. The selected frame's filtering mode is resolved live from that Sprite Asset.

`playOnStart` defaults to false and starts a fresh independent playback state when editor/runtime Play begins. Loading authored data resets transient state. Runtime Save Game animation-progress persistence is outside Phase 021.
