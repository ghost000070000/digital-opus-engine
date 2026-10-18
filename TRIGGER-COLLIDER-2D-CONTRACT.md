# Trigger Collider 2D Contract

`trigger-collider-2d` v1 is a singleton `Physics / 2D` component:

```json
{"version":1,"enabled":true,"shape":"box","offset":[0,0],"size":[1,1],"radius":0.5}
```

Supported shapes are exactly Box and Circle. Local XY and Transform resolution match Phase 041. Box uses its local offset/size; Circle uses offset/radius and the larger transformed XY basis. Both inactive subshape values remain serialized deterministically. Invalid or degenerate active geometry fails closed.

The Trigger is independent of ordinary colliders and visible artwork. It may be larger, smaller, differently shaped, offset, or wholly invisible. It detects; it never blocks, moves, pushes, creates velocity, or becomes a Body.

