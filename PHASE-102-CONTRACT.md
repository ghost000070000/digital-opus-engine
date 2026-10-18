# Phase 102 — Third-person camera preset builder

COMPLETED on8a5b after focused9/prior10116/full8/native27 plus fresh
10180+80/input117/public4 compatibility. Original contract below retained;
final evidence in PHASE-102-REPORT.md and qualification/phase-102/qualification.json.

IN PROGRESS. Exact authoritative title, Epoch11;101 qualified852c10b2.
Make a discoverable reusable third-person follow-camera authoring workflow
using existing Camera records, public chase APIs, Active Camera and typed
Change Camera references. No competing runtime, controller migration or
103–110 features (obstruction/zones/groups/shake/new template registry).

Characterize a non-programmer's native creation/setup workflow first. Existing
Inspector exposes distance/height/smoothing but lacks public chase pitch and
lookAhead controls. Reproduce this creator gap in actual browser, not a claimed
collision failure. A named follow preset should be easy to create/configure,
preview against the actual player, select at startup or with existing typed
logic, save/reopen and export. Preserve legacy third-person spawn defaults and
existing named Camera references. Prefer one-click existing palette/preset
composition over IDs, JSON or Custom Script.

Expose honest creator terminology/units for tilt and movement lead. Public
chase pitch is radians affecting additional eye elevation via sin(pitch)*distance,
not a full orbit-angle controller; UI degrees convert once. Look-ahead is
velocity prediction in seconds; zero is valid. Preserve valid historical signed
values where public API supports them; reject blank/nonfinite edits before Undo.
Distance/height/smoothing remain positive per public Camera contract. Do not
impose wheel zoom's3–25 clamp on authored distance or alter camera obstruction.

Prove actual no-code creation/configuration, independent/coalesced Undo/Redo,
duplication, Save/reopen, typed Camera references in ordinary-object Prefabs,
actual chase framing/player movement, startup/restart and exact Editable/Playable
plus site. Standalone Camera component/Prefab registry is still an explicit
representation limitation, not permission to invent one. Re-run10116 plus
appropriate prior input/core/controller gates and normal integrated builds.
No physical device/offline/newall28/soak claim without observation.

Ownership: hud_review editor/src/01-editor.js and scoped editor/index.html only;
checkpoint_review new focused102 test and tests/run-tests.js registration only;
program_forecast sole qualification browser tooling/evidence. Coordinator owns
contracts/state/full gates/tracker. Baseline browser first; scoped product repair
only after reproduced gap. No duplicate runners or overlapping writes.
