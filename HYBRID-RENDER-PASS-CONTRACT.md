# Hybrid Render Pass Contract

The renderer partitions visible renderable entities once per frame into opaque 3D, behind-Sprites transparent 3D, Sprites, and in-front-of-Sprites transparent 3D. It draws those collections in that exact order. The two transparent collections reuse the same back-to-front comparator and the same depth-write-off draw routine.

Billboard facing is resolved before drawing and is not changed by pass assignment. Camera projection type does not branch pass selection. Active-camera eye position drives transparent sorting. Sprite parallax changes only the transient Sprite draw transform and does not change pass membership.

This is deliberately bounded, not order-independent transparency. Interpenetrating transparent surfaces can still expose conventional alpha-blending limitations.
