# Trigger Collider 2D Authoring Contract

Add Component exposes one Trigger Collider 2D on eligible Cubes and Sprites. Inspector fields are Enabled, Shape, Offset, Box Size, and Circle Radius. Shape switching is one Undoable schema edit and retains both subshape values; only active-shape fields are shown and validated.

Fit to Visual follows Phase 041: Box uses visual bounds and Circle uses an inscribed fit. With no supported visual it reports that Fit is unavailable; default geometry remains fully authorable.

The selected-only overlay is distinct without relying on color: a thick dashed outline, Trigger label, and diamond handles. Box supports center and four edge handles; Circle supports center and radius. Disabled styling remains visible. The overlay never appears in Play or Playable output. One direct drag creates one Undo boundary.

