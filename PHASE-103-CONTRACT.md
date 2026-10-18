# Phase 103 — First-person camera preset builder

COMPLETED on0b96d708 after13 focused/full8/native45 and fresh prior/public gates.
Exact authoritative title,Epoch11; qualified102 baseline8a5b.
Create discoverable no-code first-person view setup using existing canonical
per-level Player settings and actual live firstperson camera/controller path.
An ordinary fixed Camera intentionally owns a cinematic shot under101; it is
not a first-person following preset. Do not invent a competing camera runtime,
controller migration or104+ features.

First reproduce actual native creator setup/history/validation gaps. Existing
Player controls expose FOV,eye height,opening yaw/pitch and input look tuning.
Inspect actual event handlers, history snapshots, Save/reopen and runtime writer.
Preserve eyeHeight0, finite canonical values, historical defaults and unknown
movement/combat fields. Blank/nonfinite/no-op/Play edits must not mutate authored
camera settings or consume Undo. Continuous valid edits should coalesce.

Builder/reset should make its effects explicit, use a single authoring transaction,
and preserve unrelated settings. Help distinguishes live Player view from explicit
Active/ChangeCamera cinematic ownership. Actual input must still move/turn camera;
startup/restart, per-level Save/reopen and exact Editable/Playable/site must agree.
Keep explicit cinematic override/release, pitch limit, collision/input and102 chase
semantics intact. Existing Player camera settings are not standalone Camera Prefabs;
do not claim representation the engine does not support.

Native baseline first; then scoped shared authoring repair and actual-source
regressions,10116/1029 compatibility, proportional native input/public gameplay and
normal integrated builds. No physical-device/offline/newall28/soak claims.

Native acceptance exposed a separate opening-view authoring gap. Provide an
explicit Use Player View at Start choice, separate from first-person defaults.
It clears only current-level Camera opening selections in one undoable transaction,
preserving Camera objects, typed references, other levels and intentional later
Start/Change Camera actions. Defaults must not silently discard cinematic intent.
Verify Undo/Redo, Save/reopen and actual Player startup across all four tiers.
