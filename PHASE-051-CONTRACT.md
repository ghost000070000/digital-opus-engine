# Phase051 — Unify Behaviors, Node Graph and Sequences under shared no-code vocabulary

COMPLETED. See PHASE-051-REPORT.md and qualification/phase-051/closure.json.
Reuse existing OpusAuthoringLanguage and ACTION_TYPES; do not create
another scripting runtime. Exact roadmap title and serialized historical IDs remain.

Actual trace in editor/src/01-editor.js: Behaviors resolve an Event then runBehavior
and executeAction; Graph actions route runGraphActionNode→executeAction; Sequence
runSequenceSteps also routes executeAction. Graph action fields already derive from
ACTION_TYPES; Sequence action choices already derive from the same table. Phase005
already enriches common labels/categories/aliases. This work must close remaining
creator vocabulary/discovery gaps, not pretend that shared execution is new.

Observed gaps: special graph Behavior label says Node Graph while taxonomy says
Visual Graph; graph palette searches only visible text, ignoring existing aliases/
categories/help; Behavior and Sequence selectors lack the same vocabulary search;
graph help calls flow ports 'sequence', confusing them with named Sequences.
Provide common read-only searchable descriptors and contextual choice guidance.

Preserve runtime ownership, action field definitions, serialized action/Event/node/
Sequence IDs, graph connection meanings and Sequence Delay semantics. Unknown
historical IDs must remain inspectable, not silently rewritten. No new event nodes,
action/condition runtime, typed pins, macro/scoped-variable system or tracing ahead
of052–060 qualification. Custom Script remains explicitly Advanced and excluded
from no-code graph palette as before.

Gates: permanent canonical vocabulary/alias/surface compatibility tests; native
Behavior/Graph/Sequence creator discovery and existing common Action authoring;
actual execution/parity, Undo/Redo/SaveLoad/Prefab/export where relevant; focused
and integrated regressions. Backend descriptors or relabeling alone are not READY.
