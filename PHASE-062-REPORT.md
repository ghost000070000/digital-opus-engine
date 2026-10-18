# Phase062 — Send Signal / On Signal

COMPLETED on `8dc5a62d2a46a8cde9724584eb0db95de66154b87b7557734ed0be35cab5e649`.

Project tab provides named definitions, stable rename references, Undo and explicit
missing-reference recovery. Canonical Send Signal Action and On Signal owning
Event require no receiver IDs or Script. Distinct occurrences deliver FIFO through
existing runAction to current-level receiver snapshots; removed owners are checked
before delivery. No stored subscription registry or alternate gameplay executor.

Public OpusSignals queue bounds:128 definitions,256 pending/processed occurrences,
2048 deliveries per drain; editor scans at most4096 Behaviors. Overflow is visible,
not silently infinite. Nested sends queue rather than recurse. Empty/off work returns
without receiver scans. Fresh Play/Stop/project/level replacement clears pending work.
Saved projects contain authored definitions/references, never queued occurrences.

Native signals-browser-20261009T230717679Z:19 observations, zero page/console/external
errors. Two sends reach two independent receivers twice; Stop/Play resets; duplicate
Event edits do not mutate the sibling; rename preserves references; removal fails
closed and Undo restores exact data. Actual native dragged Prefab becomes a third
receiver (2,2,2), then Undo restores the two-receiver project. Save/reopen and exact
Editable/Playable effects/references pass. Screenshot compact graph is readable;
search/Browse discovery no longer forces the full node palette above every graph.

Actual cloneBehaviors shared Event-reference failure reproduced red and repaired
with independent graph/dialogue copies. Permanent tests exercise actual editor
adapter/canonical runAction, FIFO, missing/ambiguous definitions, lifecycle generation,
removed receivers, bounded nested loops/queue/full-delivery limits, receiver error
isolation and cumulative overflow accounting. Historical Event order/default retained;
Sprite Event source reader/save contract retained. Capability evidence is B common
path, not A/full event system; established generated dashboard views reconciled.

Full regression-direct-20261009T230844773Z:8PASS/366 syntax files, integrated suite,
engine/all28 games/both sites/JSON/diff, matching start/final fingerprint. Fresh
probe-20261009T230952131Z: Arsenal Run, Power Grid, Signal Relay, Silent Sector,
Relic Frontier, Dungeon Descent, Survival Arena all start/accept actual input/move/
native restart/move again; four controller families, zero browser/console/external
errors. This is proportional compatibility, not another full collision soak.

Preserved attempts: initial Event ordering and stale Sprite-expression assertions;
dashboard grade/count/generated-view mismatches; click-only Prefab harness timeout
(actual palette uses drag); mid-command overflow repair caused final fingerprint
drift, so that attempt was not accepted. Final native and full gates use unchanged8dc.

Limits: project-local definitions/current-level delivery, existing Cube-oriented
Inspector Behavior creation, no independent Sprite receiver UI claim or cross-project
Signal-definition Prefab bundle. Payload063, channels064, relays065, debug067 and
integration068/export validation069 remain later phases. No game content migration,
commit, push or deployment. Next exact063 Signal payload values.
