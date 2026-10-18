# Sprite Animation Event Runtime Contract

The one authoritative frame-entry path is `emitSpriteAnimationFrameEvents`. It emits an immutable context containing target Sprite ID, Clip ID, event ID and name, frame index, local state ID, and loop count.

- Frame 0 fires on start, a different-state switch, and explicit restart.
- Re-selecting the active state without restart is a no-op.
- Every crossed frame is processed for ordinary large deltas, in frame and authored-event order.
- Loop wrap re-enters and re-fires frame 0. Once playback enters its final frame once and then holds without re-firing.
- Pause, stop, zero/negative delta, and editor scrubbing emit nothing.
- Runtime playback remains per Sprite instance while Clip/event data remains shared.

Pathological dispatch is bounded by `MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE` (1024). The final playback position is still computed from total elapsed time. Excess backlog is skipped deterministically and surfaced by transient `eventDispatchOverflow`; it is never serialized.

