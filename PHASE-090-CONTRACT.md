# Phase090 — UI template/prefab library and export QA

IN PROGRESS after089 qualification. Exact authoritative title retained; this is
the local executable acceptance contract derived from that roadmap, not a renamed
phase or replacement master specification.

Creator workflow: save a reusable HUD group/layout into a named project-local
UI library; insert independent instances through the existing UI canvas; edit,
Undo/Redo, Save/reopen and export without scripting. Preserve unrelated level UI,
screen/menu configuration and literal text. No competing UI renderer/runtime.

Use bounded versioned authoring records, existing HUD ID allocator and canonical
history. Remap only typed internal HUD references for independent instances;
missing external references must remain explicit, never silently rebound.
Template capture excludes runtime presentation; runtime Playable requires normal
instantiated level UI, not a live authoring library. Library-only image assets
must survive project Save/Editable even before placement. Malformed/future data
must not corrupt existing libraries or partially mutate the project.

Gates: actual-source/native missing workflow RED; discoverable capture/insert,
two independent instances including local Image and HUD Button tween ref, literal
ID-like text unchanged; one transactional history operation; persistence and
library dependency closure; Source/Editable/Playable native consistency; relevant
missing-reference/future-data tests and integrated regressions. At Epoch09 end,
review combined canvas/layout/bindings/prompts/menus/actions/widgets/tweens/reuse
creator workflow and fix material friction before091. No Game29/publication.
