# Body 2D Static/Kinematic contract

`body-2d` is a singleton v1 component for Cube and Sprite scene objects: `{version:1, enabled:true, type:'static'|'kinematic', linearVelocity:[x,y]}`. The default is enabled Static with zero velocity. Velocity is retained when Static and is measured in world XY units per second when Kinematic.

An enabled Static Body contributes all valid enabled ordinary Box/Circle Collider 2D shapes as immobile obstacles. The solver never changes its Transform. An enabled Kinematic Body integrates velocity and responds only to Static Bodies. Kinematic Bodies can overlap each other. A Collider without an enabled Static Body is not a physical obstacle. A Body without ordinary Collider shapes is allowed but has no physical geometry; Kinematic motion is then free. Trigger geometry does not count as a physical shape and never obstructs.

Disabled Bodies remain authored, have no physical role, and do not disable ordinary Colliders for Trigger detection. Invalid Body records are ignored by the runtime. This phase has no Dynamic Body, gravity, force, mass, impulse, friction, restitution, filtering, contact events, or character state.
