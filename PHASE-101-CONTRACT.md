# Phase 101 — Camera component/preset editor consolidation

COMPLETED on frozen852c10b2; evidence in PHASE-101-REPORT.md and
qualification/phase-101/qualification.json. Exact authoritative title, Epoch11.
Historical prerequisite: Phase100 qualifieda1027dd6
and Epoch10 integrated review closed. Consolidate existing Camera/2D Camera
authoring and reusable preset references; do not create a competing camera
runtime or implement102–110 builders, zones, obstruction, shake or target groups.

Characterize native Add Camera/2D Camera, Inspector modes/projection, author
View Through/Return, Active Camera and typed Apply Camera Preset workflow.
Preserve public Camera schemaVersion2, orthographic/perspective framing,
legacy four-controller ownership and existing historical defaults.

Actual native orthographic-shot→camera-less-level leakage reopens default
acquisition: each fresh player generation initializes canonical perspective
before controller setup; existing authored Active Camera/Start actions apply
afterward and may deliberately select orthographic. Never force projection
each controller tick or broaden public Camera API semantics. Native acceptance
must prove both default handoff and deliberate orthographic startup/restart.

Rendered frustum ownership also includes canonical Near0.1/Far100/FOV45degree
before family initialization. First-person authored player FOV overrides the
baseline; authored Camera/Start overrides all appropriate shot settings later.
This prevents old shot planes clipping nearby default gameplay geometry; do not
reset inactive author framing data or force frustum settings each frame.

Observed source risks are hypotheses until reproduced: focus-only Undo entries,
blank/nonfinite numeric mutation, repeated active/align no-op history, and
missing camera reference misleadingly displaying another camera. Reproduce
with actual-source regressions and native authoring before repair. Valid changed
mutations get independent/coalesced history; invalid/no-op/Play-mode mutations
must not corrupt author state. Typed missing/future references remain retained
and visibly unavailable rather than silently redirected. Clear creator wording,
contextual help and consistent controls should expose current capability.

Native dogfood must demonstrate meaningful2D and3D author framing, projection
switch retaining values, actual scene view restoration, active/preset gameplay
selection and controller compatibility. Exercise Undo/Redo, duplication,
Save/reopen, Prefab where the existing camera representation supports it,
exact Editable/Playable and built-site. Explicitly record unsupported composition
instead of inventing a camera component registry or hidden scripted workflow.

Use existing public Camera APIs and canonical reference/history machinery.
Run focused actual-source regressions, relevant earlier camera/core/input gates,
normal integrated builds/sites/syntax/JSON/diff and representative actual public
gameplay. Freeze final source during qualification. No physical hardware/offline
claims without observations; no large endurance campaign absent stateful risk.

Ownership: hud_review owns editor/src/01-editor.js camera authoring and scoped
editor/index.html presentation; checkpoint_review owns focused actual-source
tests only; program_forecast owns qualification browser tooling/evidence only.
Coordinator owns contracts, packaging, full gates, tracker and durable program
state. No duplicate browser/runners or edits outside scoped ownership.
