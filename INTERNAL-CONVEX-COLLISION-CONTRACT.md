# Internal Convex Collision contract — Phase 047

Slope Tile collision uses a transient three-point convex polygon inside Character Tile queries. The public authoring schema still exposes Box Collider 2D and Circle Collider 2D only; there is no creator-facing Polygon Collider component or general polygon import path.

The conservative Body 2D separation and sweep helpers accept this internal triangle alongside authored Boxes and Circles. Box/triangle uses separating axes from both convex outlines. Circle/triangle uses finite edges and inside/outside classification. A sweep advances only by a lower bound on separation, stops before first contact, and fails closed at its iteration cap. The Triangle belongs to a synthetic Tile candidate, never to a scene Body. Invalid, non-finite, or degenerate authored slope metadata is rejected before a runtime polygon is emitted.
