# Phase054 — Visual Condition nodes generated from condition registry

COMPLETED, 2026-10-09. Exact authoritative roadmap title. CONDITION_TYPES now owns canonical Graph
Condition definitions while evaluateConditionNode is the real shared evaluator.
Dialogue intentionally adapts a bounded leaf subset; AI has
different actor/state semantics. Preserve those distinctions and historical IDs.

Establish one canonical registry for existing Graph conditions, generate visual
definitions from it, associate visible parameter labels/category/help and reuse
existing named reference controls. Keep evaluation semantics and flow/gate/operand
ports unchanged. Delay is an Action scheduler primitive, not a Condition.

Qualification: real registry/evaluator coverage, true/false/combinator/named-target
and Self behavior, native authoring/flow/gates, Undo/Redo/Prefab/SaveLoad and
Editable/Playable execution. Preserve unknown data, no speculative migration.
No typed pins, scoped variables, macro or tracing work ahead of055–060 gates.
