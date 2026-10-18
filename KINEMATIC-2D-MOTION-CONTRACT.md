# Kinematic 2D motion contract

The existing simulation clock supplies seconds and clamps each update to 0.1 second. Requested world motion is `linearVelocity * dt`. The single `moveKinematicBody2D` service resolves world X then world Y and returns transient requested/actual deltas, blocked axes, sorted unique hit object IDs, and initial-overlap status. Contact never rewrites the authored velocity.

For a parented Kinematic object, the committed world XY displacement is rotated by the inverse parent quaternion and divided by parent scale before changing `localPosition`. Singular or nonfinite parent transforms fail closed without writing NaNs. Full parent rotation, scale, and mirror are handled by this conversion. A direct Transform edit is a teleport: it may start overlapping another Body and is not automatically depenetrated.

Each axis uses a swept mover AABB to reject distant Static candidates. For a candidate, conservative advancement uses shape separation divided by movement speed, stopping at a contact epsilon of `1e-6` with a cap of 48 advances. The last safe fraction is retained when the cap is reached. This checks the path, including thin walls that an endpoint-only overlap check would miss. Starting penetration is reported and remains in place for creator repair. The result and all shape caches are transient.
