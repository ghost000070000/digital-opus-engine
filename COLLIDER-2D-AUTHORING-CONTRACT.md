# Collider 2D Authoring Contract

Add Component exposes both shapes under Physics / 2D. Sprite addition performs a one-time visual fit: Box uses visual bounds; Circle uses the inscribed radius. `Fit to Visual` is the only later synchronization action.

Only the single selected eligible object shows Collider 2D furniture. Box provides center and four edge handles; Circle provides center and radius handles. Operations occur in object-local space after resolving the pointer on the object plane, support rotated/parented objects, clamp positive dimensions, and create one Undo entry per drag. Disabled shapes remain visible using dashed/non-color styling. Playable mode suppresses authoring furniture.

