# Phase 042 Baseline Characterization

- Required prior verdict: `PHASE_041_2D_COLLIDER_COMPONENTS_READY`.
- Baseline commit: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`; the pre-existing dirty worktree is preserved.
- Engine baseline: 168,984 raw bytes, 43,457 gzip bytes, 22 engine sources. Editor package: 1,921 KB. Phase 041 focused: 83 assertions; Phases 011–041: 1,842; integrated: 2,204; public games: 28/28.
- The engine has no general-purpose event bus. No-code gameplay already routes canonical Behavior event IDs through `runBehaviors` to the existing Action system. Sprite frame events are the closest typed-event precedent. Custom Script is an Action protected by the existing project trust gate.
- Canonical simulation timing is the editor/runtime `app.onUpdate` callback. It is stopped by `App.pause()`. Movement and hierarchy resolve before legacy Trigger Volumes.
- Object IDs are stable authored/runtime identities. Level loading, Play start/stop, and mid-Play Level switching are explicit lifecycle boundaries.
- Phase 041 provides the authoritative immutable Box/Circle world-shape and overlap functions. Phase 042 must reuse them and must not add trigger state to ordinary colliders.
- Before this phase there was no separate 2D Trigger component, object-pair registry, Trigger 2D event payload, or collider-to-collider Enter/Stay/Exit lifecycle.

