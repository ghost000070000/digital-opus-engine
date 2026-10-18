# Sprite Directional Animation Contract

Each renderer-local Animation State retains its required base Clip and may contain a sparse `directionalVariants` array. A row is identified by its canonical direction and stores an optional `clipRef`, `mirrorX`, and `mirrorY`. Blank Clip means Use Base Clip. An unmapped direction also uses the base Clip; diagonals never fall back to a nearest cardinal direction.

One resolver combines State plus current Direction into an effective Clip and direction mirror. A missing nonblank variant Clip remains serialized, validates as repairable, and safely uses the State base Clip at runtime.

Changing direction to a different effective Clip restarts that Clip at frame zero and follows Phase 024 frame-zero Event rules while preserving the State ID. Changing only mirror flags on the same Clip preserves frame/time and emits no false Event. Re-requesting the current direction is a no-op. State changes and explicit same-State restarts always resolve the current direction first.

Dependencies and deletion usage include every nonblank directional Clip. Prefabs, duplicate Sprite, level duplication, Save/Load, Editable Export, and Playable Export use the ordinary component serialization and shared runtime paths.
