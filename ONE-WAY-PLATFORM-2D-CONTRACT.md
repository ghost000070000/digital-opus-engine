# One-Way Platform 2D contract (Phase 046)

`one-way-platform-2d` is a singleton v1 component with only `enabled` (default true). It is meaningful on a scene Cube or Sprite with enabled Static Body 2D and enabled valid Box Collider 2D. Missing requirements leave the record authored but inactive and warn; the component never changes Body or Collider geometry. If a Circle Collider is also present, only the Box supplies Character one-way geometry. Ordinary Kinematic Bodies still see the whole Static Collider as solid.

An eligible Character Collision 2D object passes upward through and horizontally through the platform, but may land on its world-horizontal top when descending from above. One-way contributes grounded contact only—not ceiling, wallLeft, wallRight, or wallSliding. The platform need not have visible art; a zero-alpha Cube carrying the required components is valid. Selected Box authoring shows a green top-edge line when supported. Inspector shows Static/Box/orientation readiness and explains the Character-only rule.

The resolved Box's two local horizontal edges are transformed to world space. The world-higher edge is the candidate top, allowing mirrored X/Y and nonuniform scale. A 0.01 maximum absolute rise/run ratio (about 0.57°) admits normal floating-point imprecision but not a slope. A materially rotated or malformed top falls back to ordinary solid Character collision and triggers a warning; slope walking belongs to Phase 047. Parent transforms are included in resolved world geometry.

No input, jump, gravity, drop-through control, Dynamic Body, moving-platform carry, collision filters, global debug overlay, or collision event lifecycle is introduced.
