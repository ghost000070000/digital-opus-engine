# Collision Layer registry

The project owns one ordered `collisionLayers` array, not per-scene copies. Maximum 32 records includes immutable-name, undeletable Default (`collision-layer-default`). Display order is persisted and does not change runtime identity. A valid primary ID must appear exactly once; duplicate registry IDs therefore fail closed.

Add generates an independent stable ID and rejects empty/duplicate names or overflow. Rename changes only the name, using an explicit button or Enter. Reorder changes presentation order and canonical order indices. Default may be reordered but cannot be renamed/deleted.

Usage separates primary assignments and Custom mask memberships, traversing current scene objects, other Levels, and Prefab records. Deletion requires confirmation, and when primary usage exists an explicit replacement other than the deleted ID. The transaction replaces primary refs and removes only deleted mask memberships. One Undo restores registry and affected records; Redo reapplies the transaction. UI counts refresh after project load, history restoration, and opening Project.

Malformed registry IDs, duplicate names, missing Default, reserved-name changes, and limits are validation errors. No normalization renames or merges a semantic ID to hide a conflict.
