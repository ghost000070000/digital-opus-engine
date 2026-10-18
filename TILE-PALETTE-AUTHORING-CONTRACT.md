# Tile Palette Authoring Contract

## Dedicated surface

The Tile Palette is a dedicated modal editor for one active Tileset. It is not the general Asset list and not a world painter. The Tileset library supports create, search, folder/tag filtering, inspect, duplicate, delete, and Open Tile Palette.

## Common path

Creators can add an empty repairable Tile or bulk-add selected Sprite Assets. Bulk intake preserves picker order, creates deterministic collision-safe names and local IDs, and does not duplicate underlying art. Palette cards show the Sprite Asset's true atlas region, source alpha, and Smooth versus Pixel/Nearest filtering. Pixel previews use pixelated sampling.

Search filters without changing authored order. Small, Medium, and Large card size is editor UI state, not project data. Selection is stable and keyboard-operable through listbox/option semantics. The details panel commits Tile names immediately and exposes a typed Sprite picker, broken-reference repair, move left/right, duplicate, and remove. Reorder changes only the ordered Tile array; IDs remain stable.

## History and errors

Tileset mutations participate in the existing editor snapshot Undo/Redo mechanism. Broken references remain visible and repairable. Project validation can focus the exact failing Tileset/Tile. Removing a Tile never deletes its Sprite Asset or Texture. Deleting a Tileset never cascades into shared Sprite/Texture assets.

## Performance expectation

Lookup uses Tileset and local Tile IDs rather than display names. Phase 031 qualification covers a 1,000-Tile lookup/serialization case and a 256-card palette sanity bound. This is evidence for the foundation, not a promise about future world-cell scale.
