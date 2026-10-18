# Phase 042 Characterization

Trigger Collider 2D is a versioned singleton component for Cubes and Sprites. It owns independent Box or Circle geometry and may coexist with both ordinary Phase 041 colliders. Both subshape values are retained; the selected shape alone is active. It requires no visual.

The runtime keeps a transient object-level pair map. Each enabled valid Trigger tests enabled valid ordinary Box/Circle colliders on other current-scene objects. Multiple ordinary shapes on one target deduplicate to one pair. Trigger-only objects are not targets and self-pairs are excluded.

Each normal Play update runs once after movement and hierarchy resolution. Current minus previous yields Enter; intersection yields Stay; previous minus current yields Exit. Dispatch sorts by trigger ID, target ID, then lifecycle order. The event list is frozen before callbacks; callback mutations therefore affect the next tick. Disable/removal emits Exit while both objects remain alive. Deleted objects and scene boundaries clear silently to avoid ghost references.

Canonical events are `trigger2DEnter`, `trigger2DStay`, and `trigger2DExit`. They reuse Behavior → Action dispatch. A narrow `opusTrigger2D.subscribe()` seam supports runtime instrumentation, and trusted Custom Script receives the frozen payload as `event`. There is no second general bus.

The scan is intentionally simple: zero triggers return before target enumeration; target world shapes are cached per tick; AABB rejection precedes Phase 041 narrow overlap. This phase adds detection only—no Body, response, motion, filtering, Tilemap collision consumption, or global debug overlay.

