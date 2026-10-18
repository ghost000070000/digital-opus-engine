# Character contact state contract (Phase 045)

Phase 046 adds one-way support to the existing grounded result only. A horizontal one-way top may keep a stationary Character grounded through the downward probe, but it never contributes ceiling, wallLeft, wallRight, or wallSliding; solid contacts remain unchanged. See `ONE-WAY-TOP-CROSSING-CONTRACT.md` for the support tolerance and crossing rule.

The Body manager keeps `active`, `grounded`, `ceiling`, `wallLeft`, `wallRight`, and `wallSliding` in a transient Map keyed by object ID. A copy is returned from the public query; authored data, Prefabs, and project saves never contain these fields. State clears at Play start/Stop/level switch, and the next tick clears removed, disabled, deleted, or ineligible components.

Four read-only world-axis probes run around the final ordinary Collider 2D geometry. Their distance is `min(CONTACT_EPSILON + 1e-4, max(2*CONTACT_EPSILON, 0.1*smallest world AABB extent))`. Each probe checks eligible Static Body shapes and the same conservative Tile candidate set used by movement; it never commits a Transform. This preserves floor or wall contact at zero requested velocity. Both walls may be true in a narrow passage. Initial penetration is not resolved by probes.
