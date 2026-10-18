# Phase 098 — Virtual joystick/button layout editor

COMPLETED. Exact authoritative roadmap title.097 qualified before this work.
Final54 native gates, prior096117/09731/core14 and full8 command gates qualify
frozen bfd30e7b on2026-10-10. See PHASE-098-REPORT.md for proofs and limitations.
Build over canonical093 mappings,096 logical contexts,097 device activity and
existing pointer-owned physical leases. No competing player/input runtime.

## Creator contract

Optional versioned per-level UI touch layout; absent data preserves historical
D-pad and action controls. One movement joystick and bounded named Action buttons
are visually placed and sized on an editor canvas, with desktop/tablet/phone
preview, clear defaults and contextual help. Reuse established HUD canvas/history
mechanisms where practical. No raw Action IDs as the common authoring workflow.
No-code Add/remove/select/drag/resize, independent Undo/Redo, invalid/no-op guards,
level duplication and Save/reopen. Typed references survive exact exports;
unknown/future records are retained and visibly unavailable, not normalized away.

## Runtime contract

Joystick feeds canonical four movement Actions as digital directions, including
diagonals. Radius/deadzone are bounded; this is not analog movement-speed support.
Pointer capture and independently owned captured-code leases allow another finger
to operate an Action button without stuck keys or releasing unrelated keyboard
input. Use actual CSS viewport coordinates, not backing-canvas pixels. Respect
093 touch permissions and096 contexts; navigation retains existing rules.
Accepted actual touch updates097 activity. Cancel/lostcapture/Pause/Stop/level
switch and remapping release this control's sources. First-person look remains
reachable outside controls. No overlay of128 unbounded Action buttons: retain
the existing bounded paged bank for unplaced mapped Actions.

Control placement must remain reachable across small/large viewports; show
overlap/offscreen warnings rather than silently hiding controls or rewriting
author data. Preserve gameplay defaults and identity of the existing28 demos.

## Qualification

Pure bounded portable schema/geometry/directions tests and actual authoring/input
integration regressions. Real native creator drag/resize/history/Save/reopen,
actual joystick diagonal/reversal/deadzone, simultaneous two-finger Action input,
cancel/Pause/Stop/restart/level/remap cleanup and context rejection. Verify phone
and desktop reachability plus exact Editable/Playable. Retest prior096/097 input
and core persistence/export workflows; normal integrated builds/sites/syntax/
JSON/diff on final frozen source. Browser harness failures remain distinct from
product failures. Hardware gamepad is not required for touch-layout acceptance.
No public Game29, deployment,099 conflict feature or overall readiness claim.
