# Gameplay Collision Stabilization Contract

This sprint qualifies the collision already used by shipped games. It does not create the future generalized physics-authoring work reserved for Phase 041.

The supported bounded path is: a player circle/sphere against authored solid boxes, oriented boxes, spheres, vertical platforms, terrain, ramps, and optional play bounds. Fast movers use swept oriented-box or swept-sphere resolution before a thin obstacle can be crossed. Collision response must return finite corrected position and velocity, remove inward velocity while preserving wall-slide motion, and leave the mover outside the resolved surface.

Evidence consists of 100,000 deterministic swept oriented-box cases, explicit thin-wall and sphere-overlap cases, the integrated public physics suite, and real-browser dogfood in Arsenal Run, Signal Relay, and Relic Frontier. Content remains opt-in through existing `solid`, collider, terrain, and play-bound data.
