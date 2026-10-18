# Phase053 — Visual Action nodes generated from action registry

COMPLETED, 2026-10-09. Source fingerprint:
44bb7ad5d171f3d268c1840340ef344f9bec678a00f78129fc52e95cb6a3ff88.
This is a scoped phase verdict, not full product readiness.

## Creator result and compatibility

Actions retain the existing canonical ACTION_TYPES→GRAPH_NODE_TYPES field identity
and runGraphActionNode→executeAction→exec path. All89 non-Script registry Actions
project unchanged. No replacement runtime, extra Action registry or schema bump.
Graph-only Delay remains its prior scheduler primitive. Conditions are Phase054.

Action cards now show associated visible parameter labels, canonical category/help
and the existing named reference controls.240px cards contain select/color/checkbox
fields; new-node layout uses measured row bounds/280px columns without moving old
coordinates. Existing052 Fit includes full cards. Screenshots reviewed: coherent
three-Action chain, named ghost-wall target, checkbox and color visible.

An unavailable historical Action previously crashed Graph rendering. Actual-source
failure is preserved in unknown-node-red.log; fallback now displays an explicit
unavailable warning with expandable read-only payload. Native Save preserves the
exact historical node and start connection. It remains a runtime no-op, not a
claim that missing functionality was recovered. Unknown Condition role/ports are
not reconstructed from guesses; serialized data is retained.

## Evidence

- tests/phase-053-action-nodes.test.js: actual registry declaration and projection,
  all89 fields by identity/labels/flat execution delegation, historical payload
  preservation. Registered in integrated suite. Not89 full-effect gameplay tests.
- Native actions-browser-20261009T204213520Z:15 observations, zero page/console/
  external HTTP errors. Numeric Set Counter=7, explicit checkbox true→false,
  named-target visibility=false and RGB(.2,.6,.8), native flow connections,
  historical inspection/Save, Undo/Redo, Prefab capture, Source/restart/reload,
  exact SaveLoad/Editable/Playable persistence and actual effect execution.
  Evaluations only observe; authoring uses native browser controls.
- Two prior harness misses preserved: closed disclosure not expanded and unchanged
  unchecked default does not emit a change event. Corrected harness, no product
  crash/browser errors in those attempts. Earlier source-red is a genuine defect.
- regression-direct-20261009T204043402Z: integrated suite, engine build,28/28
  canonical games, engine site, games site all exit0;339JS syntax/JSON/diff PASS,
  matching start/final fingerprint. Prior physics/controller/public API/onboarding/
  capability/friction/site regressions remain green. No new endurance justified by
  this metadata/rendering change; collision closure remains separately frozenb57.

## Limits / next

Free state keys, unsupported historical implementations, level-local Prefab refs,
typed pins, scoped variables, tracing and migration remain explicit limitations
or later phases. Reference controls are reused, not claimed newly implemented.
Canonical help is currently generic for many Actions; contextual operation-specific
guidance remains product friction. No grades/count inflation, game mutations,
commit/push/deployment. Next054: condition-registry generation and actual condition
authoring/evaluation, preserving AI/Dialogue/Graph domain distinctions.
