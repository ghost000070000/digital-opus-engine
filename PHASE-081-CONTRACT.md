# Phase 081 — Visual HUD canvas editor

COMPLETED. Final evidence is in PHASE-081-REPORT.md and qualification/phase-081/closure.json. Authoritative original title is unchanged. This phase opens Epoch09 over the existing level.ui HUD system, not a new UI runtime.

Creator contract: open UI, see a responsive visual HUD canvas, select an existing HUD element and move it directly with pointer or keyboard. Existing element kinds, nine anchors, binding tokens and gameplay button Actions retain their runtime semantics. An authoring preview must not execute gameplay Actions or initialize gameplay state. Hidden elements remain discoverable for editing.

History owns independent current-level UI records. Add, remove, field changes and a drag each provide one appropriate transaction; no-op selection/focus and invalid numeric input provide none. Loaded IDs must not collide with retained HUD identities. Runtime Show/Hide/Text must not pollute authored project Save or survive Stop unintentionally.

Qualification: preserve actual-source/native RED evidence; prove Undo/Redo, repeated drag, responsive scaling/anchor geometry, Save/reopen, Source/Editable editing and runtime Playable parity. Keep existing stable gameplay button DOM behavior. Run focused regressions, prior creator workflow browser gates and normal integrated builds/sites. No READY from code or screenshots alone.

Scope boundary: Phase082 owns drag/drop creation of text/image/bar/panel elements.081 directly manipulates already supported elements; no new palette/type system or competing gameplay render loop. HUD is level-scoped, not an object Component; object Prefab behavior remains unchanged and must not accidentally capture the entire screen.
