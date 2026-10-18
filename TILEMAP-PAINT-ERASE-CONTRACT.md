# Tilemap Paint and Erase Contract

Paint and Erase are explicit viewport modes for exactly one selected Tilemap. Pointer coordinates intersect the transformed Tilemap plane, convert through the entity basis and scale, then use `floor(local / cellSize)` so negative cells behave correctly. Dragging interpolates crossed cells deterministically. Repainting replaces a cell; erasing an empty cell is a no-op. Right-button and modifier camera gestures remain available.

Paint requires a valid selected Tile from the Tilemap's assigned Tileset. The grid, origin, hover cell, brush preview, and toolbar are editor-only DOM state.
