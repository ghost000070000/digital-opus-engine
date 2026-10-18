# Phase 050 Character debug-visualization seam

A future opt-in debug view should show the accepted support segment and `groundSupportId`, ground normal and `slopeAngle`, walkable-angle cutoff, rejected steep edges, one-way crossing direction, step-up candidate heights and head-clearance rejection, bounded step-down probe, and sparse Tile candidate cells versus narrow tests. Distinguish requested from actual Character displacement so a blocker is not misread as controller intent.

Render these as transient diagnostics over the existing query and contact state. Do not serialize probe caches or add per-cell scene objects. Phase 047 only updates selected-object Tile slope preview and collider authoring cues; it does not implement a global physics overlay.
