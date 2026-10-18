# Filter application

The shared mutual predicate runs before overlap/sweep geometry. Unique valid primary IDs are required; All accepts future IDs, Custom accepts explicit IDs, and empty Custom rejects all.

Physical sweeps and contact state operate on accepted actual shape pairs. Character surface candidates retain per-shape acceptance when evaluating slopes, step height, one-way crossing, finite support, and grounding. Sparse Tile queries reject a Layer before inspecting candidate cells; accepted Full/Custom/Slope metadata retains the existing geometry pipeline.

Trigger lifecycle filters its own shape against target ordinary shapes. Any accepted geometric pair can establish one object-level Trigger pair; multiple qualifying colliders do not duplicate Enter/Stay. Eligibility loss emits Exit and clears the pair; restored overlap emits Enter.

Moving support is rechecked before previous riders are carried. Rejection removes stale support; rider clearance against Static and Tile obstacles uses rider geometry filters, not the platform's filter. Platform Body motion still uses its own ordinary geometry. Existing Phase 048 ordering and conservative obstruction semantics remain intact.

Counters distinguish filter rejects, AABB tests, narrowphase tests, sparse cells, support changes, and carry clamps. Filtering is eligibility, not a promise that accepted shapes necessarily overlap.
