# Phase 041 Characterization

Phase 041 adds a shape layer, not a physics world. Box and Circle Collider 2D are versioned singleton Components available to Cubes and Sprites through Add Component. Their local geometry follows the resolved world Transform, including hierarchy and mirroring. Circle uses the larger transformed X/Y basis so the world result remains a circle; nonuniform scale is warned.

Overlap is an explicit pure call. It performs broad AABB rejection followed by SAT for Box/Box, squared distance for Circle/Circle, and point/edge distance for Box/Circle. Touching counts within `1e-8`. Invalid and degenerate shapes fail closed.

The selected object exposes shape-specific handles and a Fit to Visual action. Adding to a Sprite initializes from its visual once; later visual edits do not silently rewrite authored collision geometry.

