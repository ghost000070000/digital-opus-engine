# Auto-Tile Authoring Contract

The Tile Palette has separate Tiles and Auto-Tile Sets views. Set cards expose mode, Default, and rule coverage. The editor supports create, stable-ID rename, independent duplication, dependency-aware deletion, Default and mode editing, and visual 3x3 rule masks with typed Tile output selection.

Selecting a Tile activates the Manual Tile Brush. Selecting a Set activates the Auto-Tile Brush. Paint, erase, set replacement, manual override, and gap-free drag strokes call the central resolver. One stroke has one snapshot Undo boundary including indirect neighbor changes. Rule, Default, and mode changes recompute every user before Save or Export.

Four-way hides diagonal choices. Eight-way clears gated diagonals when adjacent cardinals are removed. Coverage is informative, not required; sparse rules fall back to Default.
