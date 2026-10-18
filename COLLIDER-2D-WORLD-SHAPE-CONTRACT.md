# Collider 2D World Shape Contract

Box local corners are transformed in stable identity order: bottom-left, bottom-right, top-right, top-left. Mirroring may reverse winding but not identity. Its AABB is derived from all four points.

Circle center is the transformed local offset. World radius is local radius multiplied by the larger magnitude of the transformed X/Y bases. This remains circular under nonuniform scale and emits authoring guidance to use Box for stretched shapes. A zero/near-zero basis fails closed.

The editor supplies already-resolved hierarchy world transforms; the pure geometry module has no scene traversal or frame loop.

