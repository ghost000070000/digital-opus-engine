# Sprite Animation Preview Contract

The dedicated preview is asset-editor state, isolated from every scene Sprite and from scene Undo. Opening, playing, pausing, stopping, scrubbing, or selecting a frame never changes `spriteAssetRef`, a Sprite instance's transient playback state, or `playOnStart`.

The checkerboard stage resolves the current frame through the existing Sprite Asset preview path: Texture, atlas `sourceRect`, current asset filtering, transparency, and natural aspect are preserved, then auto-fit to a bounded preview box. Pixel / Nearest frames use crisp browser sampling; Smooth frames remain smooth. Missing frames use the standard visible missing-source state while timing remains traversable.

Play and resume use the shared `playSpriteAnimation` / `advanceSpriteAnimation` state machine and `requestAnimationFrame` delta; there is no timeout-based parallel engine. Pause freezes the current time. Stop resets the editor preview to frame 1 at 0 ms, which intentionally differs from runtime Stop: runtime Stop returns the Sprite to its unstarted static fallback. The scrubber covers 0 through derived total duration, uses the shared seek/time-to-frame helpers, and updates the preview plus selected/current indicators without editing clip data. Clicking a frame seeks to its start immediately.

Changes to duration, reference, order, or frame count stop/reset preview. This avoids stale indexes and makes live edits predictable. Preview time, playing state, selected frame, and playhead are never serialized, duplicated, saved in a Prefab, or exported as authored state.
