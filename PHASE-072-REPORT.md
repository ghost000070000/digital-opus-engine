# Phase072 — Component add/remove/reorder UI

COMPLETED. Final candidate f2e7b0f6a03e6653a96e32665ed005dddcf5d507c91908fb4c6fece1de4fe1dc.

Final native024312752Z11 observations and three real clicks PASS0errors; prior071
024449494Z14 registry/Health/history/Prefab/persistence/exports PASS. Full024324007Z
eight gates,387 syntax/40 JSON/all28build/bothsites/diff/frozenfingerprint PASS.
Additional actual-source removal callback test passed after the full suite; no
product change. Fresh024436314Z seven Playables actual start/movement/native
restart/postmovement PASS0errors, all four families. Not a new full gameplay soak.
Drive241 readback onlyE73/E74 status changes, strict validation/WRAP/MIDDLE retained.
Continue073; overall product mission remains active.

Canonical OpusAuthoring API: orderedComponents, getComponentRemovability,
removeComponent and moveComponent. Native Inspector controls use existing registry
and history. `inspectorOrder` is additive portable component-record metadata, never
runtime priority; historical records without order retain registry order. No second
runtime or global project-order map. Duplicate/Prefab/Save/exports share existing
record paths. Schema removeTarget owns legacy cleanup; removing Health clears
legacy Health so Save cannot recreate it. Trigger clears owned role metadata.

Intrinsic Sprite renderer/emitter roles cannot be removed independently; native
disabled controls explain why. Unknown/future records remain preserved, not rewritten
or destructively downgraded. Boundary/invalid moves and refused removals do not push
history. Removal does not cascade dependent component deletion; validation remains
available. Existing role-specific removal selectors are retained but hidden/routed
to one canonical visible control. Body/Trigger registration and character caches,
visual overlays and validation are refreshed. Stop Play before authoring mutations.

Permanent red before implementation: canonical moveComponent absent. Canonical
tests cover exact one-change callback, boundary no-op, add/remove/re-add, owned legacy
cleanup, unknown/future protection, intrinsic preservation, serialize/reopen/copy
ordering and Trigger removal. New tests are wired into normal integrated suite.

First native024049318Z11 observations PASS: actual add, reorder exact Undo/Redo,
Health remove exact Undo/Redo/re-add, Collider remove retaining Health, independent
Duplicate order, Prefab library/link history, Save/reopen and both native export
downloads. Three actual canvas clicks still damage25→18 through ordinary Actions.
No browser/console/external errors. Reordered Inspector screenshot inspected:
readable controls and explicit presentation-only wording. This first run predates
final capability/metadata changes and is not final-candidate acceptance.

First integrated suite PASS. Final gates above qualified. Grade remainsB; broader
roles073 onward, no extension sandbox,
execution ordering, drag-reorder claim, Game29 or public mutation.
