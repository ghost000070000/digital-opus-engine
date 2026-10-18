# Collider 2D Component Contract

`box-collider-2d` v1 stores `enabled`, local `offset [x,y]`, and positive local `size [width,height]`. `circle-collider-2d` v1 stores `enabled`, local `offset [x,y]`, and positive local `radius`. Both may coexist; each is a singleton. Disabled or invalid records produce no world shape.

Components are passive data. Presence never creates a physics world, Body, velocity, gravity, response, trigger callback, layer/mask, or per-frame pair scan. Shared Component serialization owns Save/Load, duplication, Level duplication, Prefab capture/instance/update, and exports.

