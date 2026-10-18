# Tileset Asset Contract

## Scope

A Tileset is a first-class project asset for organizing reusable Tiles. It is authoring data, not a scene object or renderer. Phase 031 adds no Tilemap/Grid, painted cell model, runtime tile rendering, collision generation, auto-tiling, terrain rules, animation, tint, or custom Tile properties.

## Version 1 record

Each Tileset has a stable project-wide `id`, editable `name`, optional `folder` and `tags`, `version: 1`, positive finite `cellSize.width` and `cellSize.height`, and an ordered `tiles` array. Each Tile has a stable ID local to its parent Tileset, an editable non-empty name unique case-insensitively within that Tileset, and a required typed reference to one Sprite Asset.

The ownership chain is strictly `Tileset -> Tile -> Sprite Asset -> Texture`. Tiles never copy Texture bytes, source rectangles, pivots, filtering, or transparency rules. Previews resolve those properties live from the Sprite Asset. Renaming a Sprite Asset is safe because Tiles store IDs. Deleting a referenced Sprite Asset warns with the Tileset and Tile names and leaves an explicitly broken, repairable reference.

## Identity and duplication

Reordering and renaming never change Tile IDs. Duplicating a Tile creates a new local ID and collision-safe name while retaining the Sprite reference. Duplicating a Tileset creates a new Tileset ID and deep-independent cell/tile records; its local Tile IDs are retained because their identity namespace is the new parent Tileset. Editing either copy cannot mutate the other.

## Persistence and compatibility

Tilesets are additive data in project format 6. Older projects normalize a missing `tilesets` field to an empty array. Save/Load, project JSON, and Editable export retain Tilesets and their transitive Sprite/Texture closure. Playable export does not treat unused authoring-only Tilesets as runtime roots. Direct scene Sprite use independently retains the referenced Sprite and Texture even when every Tileset is pruned.

## Validation

Validation rejects missing/duplicate Tileset IDs, invalid names or versions, non-positive cell dimensions, non-array Tiles, missing/duplicate local Tile IDs, blank/duplicate local names, missing Sprite references, missing targets, and wrong-type targets. Issues navigate to the exact Tileset and Tile in the dedicated Palette.
