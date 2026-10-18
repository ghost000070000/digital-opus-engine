# Collider 2D Overlap Contract

- Broad phase: inclusive world AABB check.
- Box/Box: Separating Axis Theorem over both quads' edge normals.
- Circle/Circle: squared center distance against summed radii.
- Box/Circle: center containment or minimum distance to each Box edge.
- Touching counts as overlap; default epsilon is `1e-8` world units.
- Results are symmetric. Null, unknown, nonfinite, disabled, invalid, or degenerate shapes return `false`/no shape.

Queries are caller-driven and allocate no persistent pair state. Phase 041 defines neither consequences nor events.

