# Phase 095 — Dead zones, sensitivity and inversion controls

COMPLETED; frozen evidence in PHASE-095-REPORT.md. Exact authoritative title;
094 qualified first. Reuse canonical
first-person look, existing gamepad poller/mapped-axis evaluator, Player settings
history and local SettingsManager. No competing input runtime or Custom Script.

## Author and player ownership

Player Inspector exposes gamepad dead zone0–1 and right-stick look rate0–10
radians/second through an optional version1 GamepadTuning record under per-level
playerSettings.gamepadTuning. Absent retains historical0.25/2.6 behavior. Unknown
or malformed explicit records remain unchanged and visibly unavailable; do not
silently replace them. Unsupported tuning disables axis routes/look, not buttons.
Existing authored mouseSensitivity retains units/meaning and positive historical
values unchanged in storage; new edits require finite positive values at most
0.1 radians/pixel and independent Undo/Redo. Nonfinite effective multiplication
uses a safe historical0.0018 response rather than corrupting yaw/quaternion.
No-op or invalid mutations create no history. Save/reopen/duplication and both
exports retain independent authored settings.

Main/Pause expose local gamepad dead zone/look rate, existing mouse sensitivity
and clearly labeled vertical-look inversion for mouse/touch/gamepad. These are
compatible device preferences, unlike094's project-specific key rebinding.
New gamepad preference keys are absent until chosen; authored values apply when
absent. Local changes never enter project JSON/history. Reset gamepad tuning to
author defaults does not erase key bindings/audio/quality. Existing mouse0.0018
and invertMouseY preferences remain compatible; no scope migration is implied.

## Runtime semantics

Dead zone is an independent-axis strict threshold: abs(axis)>deadZone, not a
radial curve or analog movement speed. Zero accepts nonzero signed finite axes;
one suppresses all valid axes. Missing/disconnected/out-of-range/nonfinite axes
produce no movement/look. Gamepad right-stick angular rate uses seconds dt and
the existing yaw/pitch writer; mouse/touch pixel deltas are not dt-scaled.
Mouse and gamepad sensitivity have separate honest units. Existing touch2.2
pixel multiplier and pitch clamp remain. Invalid local values are inert, not
coerced to a default write. Capture/lifecycle must not alter look after Pause,
Stop or controller transition; characterize real reachability before labeling
the existing touch path a product failure.

## Proportional qualification

Permanent pure/actual-controller regressions for finite boundaries, precedence,
no-op/history/independence, inversion/pitch, actual mapped-axis behavior and
30/60/144Hz angular partitions. Native editor discovery/edit/Undo/Redo/Save/reopen,
actual mouse/touch look/lifecycle and exact Editable/Playable acceptance. Fake
pad fixtures are controller evidence, not physical hardware acceptance. Relevant
091–094 regression and normal integrated/engine/catalog/sites/syntax/JSON/diff
gates close only on frozen source. No mandatory multi-hour soak for scalar tuning.
No096contexts/097prompts/098layout/099diagnostics, Game29 or public deployment.
