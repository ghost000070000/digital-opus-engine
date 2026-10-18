# Tilemap Bundle Import Contract

Import has two phases. Phase one reads text, rejects invalid or non-canonical input, validates envelope/blob hashes and limits, hydrates a private dependency graph, computes collision-safe identity/name mappings, structurally rewrites references, and shows a summary and warnings. Cancel performs zero project mutation.

Phase two commits the frozen plan as one editor transaction. Unused incoming stable IDs are preserved. Colliding project-global IDs receive deterministic `-2`, `-3`, … suffixes; names receive deterministic ` 2`, ` 3`, … suffixes. Prefab names and all typed references are remapped together. Tile IDs, Auto-Tile IDs, Terrain IDs, Layer IDs, marker IDs, and other owner-scoped identities remain local to their owner.

Imported Tilemaps receive a fresh scene-object ID and are detached. Imported Chunks receive a collision-safe Asset ID. Existing local records are never overwritten or merged by name. One Undo removes the root and every imported dependency; Redo restores them. A commit exception restores the pre-import snapshot.
