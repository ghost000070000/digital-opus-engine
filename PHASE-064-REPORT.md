# Phase064 — Signal channels scoped to level/project/prefab

COMPLETED on `7f8505c154355e951e200a92cb382f8329adf82f198d54c5fe21a1e9b4312ad5`.

Project tab offers named Project, Level and Prefab-instance channel selectors;
Level uses a native named level picker. Historical absent scope means Project.
Project definitions remain reusable across levels but only active scene receivers
execute. Level channels retain stable declared level identity, not the current
editing index. Prefab channels require explicit placed assembly root ownership;
ordinary editor groups do not become channels. Single linked historical Prefabs
use their own root identity. Templates without placed ownership fail visibly.

Canonical OpusSignals captures immutable channel context in each occurrence and
checks live receiver eligibility without stored subscription registries. Changed
scope/type cannot broaden queued work. Existing bounded work and lifecycle clear
remain. Actual Prefab constructor assigns a new shared identity to every assembly
member; Duplicate All creates another independent identity. Shared record wrapper
and load restore it across history, Save/Load and exports. Level duplication's
existing canonical object-ID remap preserves the new assembly-local references.

Native typed `channels-browser-20261009T234614974Z`:17 observations, no page/console/
external errors. Native Number3→Wait→Read Signal Value delivers3 only inside each
instance (unplaced original0); duplicated assembly remains isolated and Undo exact.
Project delivery reaches all active receivers (9 each from3 senders); named Level
accepts its own scene and rejects a genuinely configured duplicate start level.
Returning restores independent instance behavior. Save/reopen and exact Editable/
Playable authored identities and runtime effects pass. Reviewed native scoped
Project screenshot shows readable labels/contextual help, not hidden identifiers.

No-value native `channels-browser-20261009T234657905Z`:16 observations PASS.
Prior typed `payloads-browser-20261009T234724231Z`:16 PASS; historical named Signal
`signals-browser-20261009T234747299Z`:19 PASS. Actual-source adapter, constructor
and record regressions cover isolated instances, non-Prefab grouping, missing
ownership, Level changes, immutable channel context and queued scope changes.

Full `regression-direct-20261009T234636070Z`:8 gates PASS/370 syntax files,
integrated suite, engine/all28 games/both sites/JSON/diff and matching fingerprints.
Fresh `probe-20261009T234803285Z`:seven mandatory/representative public games start,
accept actual input, move, restart natively and move again; four controller families,
zero browser/console/external errors. Not another full collision soak.

Preserved harness misses: editor duplicate did not initially become gameplay start
level; Level selection required the separate Switch To control; delayed typed work
was initially sampled before the queue/waits completed. Captured contexts retained
correct values and identities. Corrected driver uses native start/switch controls,
relative simulation advancement and empty actual pending queues before assertions.
No product repair was made to hide those timing/navigation misses.

Limits: active scenes only, not inactive-level mailboxes; globally unique project
definition names; bounded primitive/reference values, not maps; no independent
cross-project Signal-definition Prefab bundle. Behavior creation remains Cube-
oriented; full Sprite authoring is not claimed. Relays/filter065, debugger067 and
broader integration/export validation remain later gates. No game content changed,
commit, push or deployment. Next exact065 Event relays and signal filters.
