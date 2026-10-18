# Hybrid Scene Layering Contract

Phase 029 defines one bounded, deterministic relationship between 3D transparency and the Sprite pass. The canonical order is:

1. opaque 3D, with depth testing and depth writes;
2. transparent 3D and Billboards authored `behind-sprites`, with depth testing and no depth writes;
3. the entire contiguous Sprite pass, with depth testing and no depth writes;
4. transparent 3D and Billboards authored `in-front-of-sprites`, with depth testing and no depth writes.

`spritePassRelation` is eligible only for transparent non-Sprite entities. Its values are `behind-sprites` and `in-front-of-sprites`. Missing or invalid runtime values resolve to `behind-sprites`, preserving historical projects. Opaque objects retain but ignore the field so an alpha round trip is lossless. Sprites never own this setting.

This contract is identical for perspective and orthographic cameras and follows the active camera. In-front does not mean x-ray: opaque depth can occlude every later pass.
