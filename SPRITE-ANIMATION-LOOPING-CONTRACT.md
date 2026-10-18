# Sprite Animation Looping Contract

## Schema and migration

`sprite-animation` is version 2. Its only new authored playback field is `playbackMode`, restricted to `once` or `loop`. Missing, v1, and unsupported values normalize to `once`, preserving Phase 021 behavior. Duplicating a v2 clip copies playback mode and independent frame records under a new stable clip ID.

## Exact runtime semantics

For `once`, the existing contract is unchanged: crossing the final duration holds the final frame, sets `playing=false`, and sets `completed=true`.

For `loop`, total elapsed time is reduced modulo derived total clip duration. The corresponding frame range supplies `currentFrameIndex` and frame-local `elapsedMs`; `playing` remains true and `completed` remains false. Remaining delta is consumed across any number of wraps. A 400 ms clip advanced by 1.35 seconds lands at wrapped time 150 ms; for ranges 0–80, 80–160, 160–320, 320–400 it lands on frame 2 (one-based), 70 ms into that frame. The implementation is modulo-based rather than transition-count-based, so absurd deltas do not iterate millions of frames.

A one-frame loop is valid and remains on frame 0. An empty loop remains invalid and unplayable; modulo zero is never attempted.

`playOnStart` remains independent Sprite-instance metadata. A Loop clip with Play On Start off loops only after an explicit play. Runtime Stop remains the Phase 021 unstarted/static-Sprite fallback; preview Stop remains frame-0 asset preview. Loop mode adds no dependency: Sprite → Clip → Sprite Assets → Textures is unchanged in editor, Prefab, Save/Load, Editable Export, and Playable Export.
