# Tile Collision Authoring Contract

The selected Tile detail surface exposes a keyboard-native Collision mode selector for None, Full Cell, and Custom Rectangle. Custom Rectangle exposes Left, Bottom, Right, and Top normalized numeric fields plus a one-click Use Full Cell action.

The preview separately presents the cell outline, Sprite artwork, and orange collision shape. Tile cards show a text badge for Full or Custom collision, so color is not the only signal. No drag handles are required in Phase 034; exact numeric authoring is the authoritative route.

Mode and field edits use the shared snapshot Undo/Redo system, mark project state through ordinary mutation, commit on `input` or `change`, and are immediately available to Save and Export. Invalid typed values remain visible for validation and repair; safe visualization resolves them to None. Validation navigation opens the exact Tileset and Tile at its Collision section.
