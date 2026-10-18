# Trigger 2D Lifecycle Contract

Pair identity is `(triggerObjectId, targetObjectId)`. Target eligibility requires a current-scene object other than the owner with at least one enabled valid ordinary Box/Circle Collider 2D. Trigger geometry alone is never a target. Any number of overlapping ordinary colliders still yields one object pair.

- New current pair: one Enter.
- Pair in current and previous: one Stay per simulation tick.
- Previous pair absent from current: one Exit when both objects still live.
- Re-entry after Exit: a new Enter.

Disabling/removing the last target collider or disabling/removing the Trigger closes with Exit on the next tick. Target or Trigger deletion clears silently. Level change, Play stop, and restart reset silently.

Events sort by trigger stable ID, target stable ID, then Enter/Stay/Exit order. A frozen event snapshot is installed before callbacks. Mutations during callbacks affect only the next tick.

