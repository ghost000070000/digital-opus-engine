# Tile Collision Overlay Contract

Collision Overlay is transient editor state exposed in the Tilemap edit toolbar. It draws resolved collision shapes only for the active Tilemap layer. A hidden active layer draws no shapes; a locked active layer remains inspectable because locking protects authoring, not inspection.

Full Cell covers the complete cell. Custom Rectangle uses normalized Tile coordinates scaled by Tileset Cell Size. Each of four local corners is projected through the Tilemap Entity basis, scale, rotation, translation, and any engine-supported parent transform path, so rotated, scaled, and negative-coordinate cells remain quadrilaterals in screen space.

The overlay never serializes, creates scene objects, appears in Playable Export, or implies current physics behavior. Visibility and lock do not change Tile metadata or define future collision participation.
