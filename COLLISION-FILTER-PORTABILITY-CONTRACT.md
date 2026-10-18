# Filter portability

Project JSON, editor history, duplicate/Prefab records, and exact Editable/Playable compositions preserve stable registry IDs and geometry-owned fields. Normalizing a current schema retains invalid references; validation names missing primary and mask IDs. A Prefab imported without its registry can remain explicitly invalid for repair rather than silently merging a same-named layer.

Tilemap Bundle closure collects primary IDs and Custom membership IDs from root Layers and dependent marker Prefabs. Only required semantic records are exported. A clean import/re-export is deterministic. Nonreserved incoming IDs that collide with existing IDs are independently remapped, including primary refs and mask arrays. Same-name records are not identity-merged; conflicting display names are made unique. Default maps to its reserved ID, and a Default-only import creates a reserved registry in a fresh project. Imports that would exceed 32 registry entries are rejected.

Bundle integrity checks and existing atomic import history apply unchanged. Registry dependency validation rejects malformed identities and filters. Chunks retain stamp data, not a parallel filter policy; stamped Tile Layers own the eventual collision policy.

Qualification evidence: `qualification/phase-049/phase-049-portability.json`. The model snapshot campaign is separately labeled from real UI Undo and real exported-editor Save/Load acceptance.
