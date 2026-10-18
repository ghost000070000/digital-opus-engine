# Tile Collision to 2D Physics Seam

Phase 041+ may consume the chain `Tilemap → Layer → Cell → Tile → collision metadata → normalized rectangle → Cell Size → Tilemap Transform`. Phase 034 provides pure resolution and geometry helpers only; it creates no physics objects.

Later work must decide, with performance evidence, between one static collider per solid cell, merged rectangles, or chunk-generated static geometry. It must also decide whether layers gain an explicit collision-participation policy. Phase 034 deliberately adds no `collisionEnabled` layer field; visibility remains rendering state and lock remains authoring protection.

Triggers belong to Phase 042, body kinds to Phases 043–044, and one-way/platforming or slope semantics to later phases. `custom-rect` is not overloaded with trigger, damage, navigation, one-way, or polygon meaning.
