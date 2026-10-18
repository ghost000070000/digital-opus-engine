# Tile-Grid Object Placement Contract

Place Object is a bounded editor tool. One primary click creates one existing Prefab instance at the center of the clicked Tilemap cell through the established Prefab assembly path. It uses current Tileset cell width/height and the selected Tilemap's resolved position, right/up basis, and scale.

Placed output is an ordinary scene object or Prefab assembly. Root-level placement is intentional. It can be selected, moved, duplicated, parented, serialized, exported, and deleted normally. Changing cell size or moving the Tilemap later does not move the placed object because no ongoing grid binding is stored.
