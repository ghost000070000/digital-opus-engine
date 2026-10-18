# Spawn Marker Dependency Contract

Every non-null marker `prefabRef` participates in the shared project Prefab dependency closure. Editable and Playable exports therefore retain referenced Prefabs even when the marker is their only owner.

Deleting a referenced Prefab warns with marker usage count and leaves the marker reference repairable. Project validation reports missing marker Prefabs without clearing author data. The current repository's established Prefab identity is its name; Phase 037 reuses that constraint rather than inventing a second identity system.
