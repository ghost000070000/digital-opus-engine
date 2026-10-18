# Spawn Marker Authoring Contract

The Tilemap viewport provides a Spawn Marker tool, labeled overlay with visibility toggle, click-to-create, and drag-to-move. The Inspector provides a marker list/detail surface for selection, rename, integer X/Y editing, optional Prefab assignment, duplicate, and delete.

Each mutation uses the editor's existing snapshot Undo/Redo boundary. Marker tools do not require an active, visible, or unlocked Tile Layer. Marker overlays are editor-only and are absent from Playable presentation.
