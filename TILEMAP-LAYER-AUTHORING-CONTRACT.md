# Tilemap Layer Authoring Contract

The Inspector layer panel displays topmost layer first while canonical storage remains bottom-to-top. A highlighted row is the active layer. Active Layer is transient editor state in a WeakMap and is never runtime project data. Existing valid selection is retained; otherwise the topmost visible unlocked layer is selected, falling back to the first layer.

The panel exposes show/hide, edit lock, immediate name editing, cell count, Move Up, Move Down, Add, Duplicate, Delete, Clear Layer, and active-row selection. Names must be non-empty and unique case-insensitively. Add and Duplicate insert immediately above their reference layer. Non-empty Delete and both Clear commands confirm using affected counts.

Paint and Erase target only the stable active Layer ID. Hidden layers remain selectable but show `Show this layer to edit its cells.` Locked layers show `Unlock this layer to edit its cells.` Neither can receive a stroke. Lock protects cells only: rename, visibility, and reorder remain available. Layer selection or a layer-state mutation finalizes any open stroke before proceeding.

Clear Layer affects only the active unlocked layer. Clear All Layers affects every layer. The shared Tile Palette and Tileset remain Tilemap-wide; there is no per-layer palette, Transform, Tileset, opacity, tint, or parallax.
