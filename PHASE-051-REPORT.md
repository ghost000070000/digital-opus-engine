# Phase051 — Unify Behaviors, Node Graph and Sequences under shared no-code vocabulary

COMPLETED at de846f02b3034e0244972654c54a127bda5301a81f86c3ea1273d7685230da31.
The autonomous product program continues with exact Phase052, not product READY.

Behaviors, Visual Graph and Sequences search the same canonical Action labels,
historical aliases, categories and help. “Play Audio” finds Play Sound without
changing sound IDs. “Node Graph” finds Visual Graph. Behavior/Sequence search
retains the chosen Action; Behavior pending fields survive filtering. Conditions
remain distinct. Contextual help explains reactions/branching/ordered Actions;
graph ports say Flow in/out, not Sequence. Custom Script remains Advanced.

Use Inspector → Behaviors → Event and searchable Action; Visual Graph + Add opens
branching authoring. Level → Sequences orders Actions and Delay / Wait; start one
with Play Sequence from a Behavior/Graph.

Phase005 OpusAuthoringLanguage remains canonical. Immutable logicEntries,
logicActionLabel and matchesLogicEntry do not replace ACTION_TYPES fields or
execution. All three already shared executeAction; that integration is not new.
Historical Event/Action/node/edge/Sequence IDs and Delay kind unchanged. Unknown
labels fall back to IDs. No new scripting runtime or schema migration.

Evidence:

- tests/phase-051-logic-vocabulary.test.js verifies canonical parity, aliases,
  boundaries, immutability, unchanged definitions/fields and unknown-ID fallback.
  Phase00533/33 passes; two old source-shape assertions now test canonical semantics.
- qualification/phase-051/logic-browser-20261009T200911163Z/proof.json:19 native
  observations. Real controls authored Set Counter=7 as Behavior, connected Graph
  and delayed Sequence. All three executed in Source, restart, reopened Source,
  Editable and auto-start Playable. Exact logic arrays/IDs survive Save/Load/exports.
  Undo/Redo and Prefab capture preserve Graph and level-local Sequence reference.
  Zero page/console errors/external HTTP requests. visual-graph.png and sequence.png
  reviewed. Evaluations only read state; all authoring/execution through controls.
- regression-direct-20261009T200944672Z: integrated tests, engine,28/28 games,
  both sites exit0;334 JS syntax/JSON/diff PASS, matching start/final fingerprint.
  Existing041–050, actual-controller, API/onboarding/capability/friction/site chain green.

Limits: free-typed counter keys, object-owned Events, Graph validation/tracing,
Sequence temporal overview and field-edit history remain later work. Prefab capture
does not prove standalone portable Sequence dependency import. No grade/count
inflation or unjustified long soak for read-only vocabulary UI. Collision closure
remains source-scoped at b57; no new gameplay-soak claim. No commit/push/deployment.
