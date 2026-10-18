# Sprite Direction Contract

Direction is an explicit semantic Sprite-animation input. Canonical authored values are `up`, `down`, `left`, `right`, `up-left`, `up-right`, `down-left`, and `down-right`; `none` is the compatibility/default value and selects ordinary State behavior.

Sprite Renderer persists `initialDirection`. Runtime playback owns transient `currentDirection`, established before Play On Start enters the Initial State. `setSpriteDirection` validates the enum and atomically resolves the current State; `getSpriteDirection` returns only the bounded scalar. Invalid requests return `false` without mutation or restart. Stop clears active playback but preserves direction.

Direction is changed only by Initial Direction, the bounded runtime/public setter, or the shared `Set Sprite Direction` Action. Phase 025 does not infer it from input, velocity, Transform, controller, AI, or physics state.
