# Phase 022 Characterization

Phase 022 advances Sprite Animation Clips to version 2 and adds the bounded visual editing and loop semantics that Phase 021 intentionally excluded.

| Area | Characterized result |
|---|---|
| Editor | One dedicated modal, opened from clip card, compact Inspector, or new-clip flow |
| Frame strip | Atlas-aware thumbnails, one-based numbers, durations, selection, playhead, broken slots |
| Manipulation | Add, remove, independent duplicate, native drag reorder, Left/Right fallback, typed reference and ms duration |
| Timing | Shared total/range/time-map/seek helpers; totals are derived |
| Preview | Checkerboard, natural-aspect auto-fit, sub-rect, alpha, per-frame filtering, Play/Pause/Stop/scrub |
| Schema | `sprite-animation` v2 with `playbackMode: once \| loop`; v1 migrates to Once |
| Once | Final-frame hold, stopped, completed |
| Loop | Modulo wrap, arbitrary delta, completed false; one-frame safe, empty unplayable |
| Isolation | Preview never drives scene playback or serialization; edits reset preview safely |
| Persistence | Order, durations, stable references, and mode persist; preview state does not |
| Reuse/export | Prefabs retain clip ID; Editable contains editor; Playable uses identical runtime timing |
| Boundaries | Static Sprite, Billboard, 3D/skinned animation, dependency closure, and Phase 021 APIs remain intact |

`tests/phase-022-sprite-animation-editor.test.js` contains 61 focused checks. It includes 100-frame editor timing and 100 independent looping-instance sanity cases, multi-wrap 1.35-second delta math, one-frame and empty-loop guards, atlas/Pixel preview contracts, persistence, Prefab/export closure, and regression boundaries.

Browser dogfood authored three clips through normal controls, including a four-frame 80/80/160/300 ms Once clip, a dragged/reordered six-frame 550 ms Loop, and a stable one-frame Loop. It exercised preview controls, native reorder, structural edits, eight mixed Sprite instances, reusable Prefab placement, Save/Load, deliberate break/validation/repair, and real Editable and Playable export boots. It found and repaired a scrubber event-order defect, then visibly sought to frame 4 at 328 ms. A real atlas frame switched to Pixel / Nearest resolved the `pixel` preview class and computed `image-rendering: pixelated` with clean validation and logs. The final exported editable editor switched modes, sought to frame 4 at 321 ms, and continued looping; an earlier export also accepted reorder and retiming to 625 ms. The playable rendered the mixed scene, changed visually across captures, and logged no errors or warnings.
