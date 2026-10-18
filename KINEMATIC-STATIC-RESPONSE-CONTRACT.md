# Kinematic versus Static response

The solver accepts enabled valid Static and Kinematic Body 2D components and the union of each object's valid enabled ordinary Box/Circle Collider 2D shapes. Trigger Colliders are excluded. All Static candidates are sorted by stable Object ID; Static geometry is resolved once per update. Any mover-shape/obstacle-shape contact constrains that axis. Hit IDs are unique and sorted.

World X is resolved before world Y. Blocking X leaves a clear Y displacement intact, giving geometric sliding. A Static Transform never moves. A Kinematic object without shapes moves freely. Static-only scenes perform no pair sweeps. Kinematic/Kinematic pairs have no response. Response is translation only, with no rotation, impulse, friction, restitution, collision callback, or Tilemap cell consumption.
