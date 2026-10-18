# Moving Platform 2D contract

`moving-platform-2d` v1 is the authored record `{ version: 1, enabled: true }`. It is active only with an enabled v1 Kinematic Body 2D and enabled valid Box Collider 2D. Body 2D remains the sole owner of world-XY velocity.

The component opts its Box into Character Collision 2D as a solid, walkable, or one-way support. This is a Character-only exception: arbitrary Kinematic Bodies still pass through each other, platforms do not respond to Characters, and platforms do not respond to other platforms. Unsupported side contacts are not pushed.

Carry transfers translation only. An authored rotated Box may provide a walkable slope, but runtime rotation/scale changes do not rotate, orbit, scale, or parent a Character. Platform path authoring, auto-reversal, Dynamic bodies, gravity, input, jumping, collision filters, and global debug overlays are outside Phase 048.
