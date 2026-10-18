# Character moving-platform carry contract

Each tick snapshots the prior Character support link (`groundSupportId`). A bounded first-tick surface probe avoids a one-frame delay for authored riders. The runtime builds a transient stable-ID platform-to-riders map.

The platform first computes its Phase 043 Static-limited base delta without committing. A single safe scalar is applied to that vector, the platform commits once, and every prior rider receives the exact same actual world translation. Each Character's own requested Kinematic motion then runs against current platform geometry. Carry never changes either Body's requested velocity.

Multiple riders use the minimum safe fraction. After own motion, support is recomputed: walking or moving upward off the surface changes/clears `groundSupportId`, so the next tick has no carry. Read-only state adds `onMovingPlatform` and frozen `groundSupportVelocity`, derived from actual platform delta divided by positive `dt`; static/unsupported state returns `[0,0]`.
