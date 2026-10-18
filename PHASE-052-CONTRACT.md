# Phase052 — Visual Event nodes and lifecycle events

COMPLETED. See PHASE-052-REPORT.md and qualification/phase-052/closure.json.
Exact authoritative roadmap title. Build on051 shared vocabulary,
existing object-owned Behavior dispatch and implicit graph start entry.

The graph entry becomes a visible Event node with canonical Event selector/help;
editing it changes the owning Behavior Event only on Save, Cancel mutates nothing.
Keep graph start port ID/start edges and historical trigger/eventRef serialization.
Support all existing authored Events including target-specific Sprite frame events.
No duplicate Event listener runtime or multi-entry schema migration.

Lifecycle: existing On Start remains level-start, including mid-session level entry;
add opt-in On Update once per active simulation tick, not editor frames, paused
frames or after game end. Snapshot iteration prevents same-tick spawned objects
from recursively joining the dispatch. Old projects have no update subscribers.
No new Destroy/Stop/Switch lifecycle promises before their mutation/cleanup ordering
has a qualified contract. Those are intentional bounded limitations, not hidden UI.

Phase075 integration extension: the same Start/Update dispatch also serves Sprite
Behavior owners now that their canonical Event/Action panel is exposed. Historical
Cube ordering, game-ended guards and snapshot/removal safety remain unchanged;
terrain and other non-Behavior authoring kinds stay excluded. See075 evidence.

Gates: real-source lifecycle regression, native Event-node choice/save/cancel,
historical flow compatibility, Start/Update execution and Pause/Stop/restart,
Undo/Redo, SaveLoad, Prefab capture and exact Editable/Playable parity; integrated
regression/builds. Event dropdown alone is not qualification.
