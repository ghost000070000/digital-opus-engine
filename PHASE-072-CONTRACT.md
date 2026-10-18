# Phase072 — Component add/remove/reorder UI

COMPLETED. Exact authoritative title; expanded tracker prompt empty. Reuse
canonical registry and current native Add Component workflow. Provide consistent
registered-component removal and accessible Inspector ordering in one Undo step.
Ordering is creator presentation, never implicit runtime execution ordering.

Persist independent ordering metadata through canonical records, duplication,
Prefab, Save/reopen and both exports. Preserve unknown/future records. Intrinsic
Sprite renderer/emitter roles must not be silently destroyed; explain unavailable
removal. Existing legacy adapter fields must be cleared when an attached role is
removed so serialization cannot recreate it. No cascade deletion of unrelated
components/content. Validate dependencies and clean relevant runtime registries.

Permanent canonical/actual-source tests and native add/remove/reorder/history/
Prefab/persistence/export dogfood, proportional integrated/public-game gates.
Do not preimplement073 new roles. No Game29/public mutation/commit/push.
