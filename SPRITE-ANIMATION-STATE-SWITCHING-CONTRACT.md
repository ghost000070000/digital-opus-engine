# Sprite Animation State Switching Contract

`setSpriteAnimationState(item, stateId, { restartIfActive })` is the single runtime transition path used by the public API and no-code Action.

- A valid different state becomes active immediately and displays its clip's frame 0 at elapsed 0.
- Requesting the active state is a no-op by default, including after a Once clip has completed and is holding its last frame.
- `restartIfActive: true` restarts the active state at frame 0, including a completed Once state.
- Switching away and back starts fresh. No hidden per-state playback position is retained.
- Stop clears `currentStateId`, clip, frame time, started, playing, and completed state, restoring the static Sprite Asset fallback.
- Invalid state or clip references fail safely without throwing. Invalid autoplay remains on the static fallback and is reported by validation.

Transient state is `{ currentStateId, clipId, currentFrameIndex, elapsedMs, playing, started, completed }`. Preview and runtime retain the shared Phase 022 clip timing helpers. The bounded public surface exposes set-state and get-current-state operations; it does not expose a mutable playback object.
