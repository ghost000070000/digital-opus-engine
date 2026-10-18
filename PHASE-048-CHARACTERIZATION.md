# Phase 048 characterization

The Body2D manager now executes one explicit order: collect prior/first-tick support, compute Moving Platform base motion against Static bodies, reduce it by the shared rider-safe fraction, commit platforms, carry riders, run Character own motion against current platform Boxes, run remaining Kinematics, expose final support state, then let the editor run Trigger lifecycle.

Support links are transient stable object IDs. Moving-platform deltas and rider lists are rebuilt each tick and never serialized. Base platform movement continues to use every ordinary platform Collider under Phase 043; Character platform geometry intentionally uses the Box only. Tile geometry protects riders but does not block the platform Body itself.

Flat, authored-sloped, and one-way platform tops can support Characters. Too-steep tops remain solid Character obstacles but cannot become ground support. Carry is exact world translation and parent-safe; it does not alter scene hierarchy or Body velocities.

Boundaries: no unsupported side push, no airborne pickup guarantee, no platform-vs-platform response, no platform-vs-Tilemap Body response, no runtime rotation/scale carry, no path system, and no Phase 049 filters.
