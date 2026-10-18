# Phase064 — Signal channels scoped to level/project/prefab

COMPLETED on7f8505c154355e951e200a92cb382f8329adf82f198d54c5fe21a1e9b4312ad5.
Exact authoritative title; expanded tracker specification is empty.
Compose canonical Signals, typed occurrence contexts and existing active scene;
do not add another dispatcher or execute unloaded level objects.

Historical absent channel scope means Project: the same named definition can be
used across levels, delivering only to live receivers in the active scene. Level
channels retain their declared stable level ID and cannot send or deliver elsewhere.
Prefab channels deliver only within one explicitly identified placed instance,
not to other instances and not by ordinary editor grouping. Unplaced sources do
not acquire implicit global scope. Pending work remains transient and is cleared
on scene replacement; channel context is captured per occurrence.

Native Project channel selector and named level picker must be discoverable,
preserve Undo and fail visibly on unavailable context without rewriting references.
Prefab placement/duplication/history/SaveLoad/exports preserve independent ownership.
Prove two actual instances do not cross-talk, project delivery works, level changes
isolate, typed delayed values remain correct, and old no-payload games still work.
No relay/filter065, broadcast debugger067 or inactive-level mailbox is included.
