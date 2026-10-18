# 2D Camera Authoring Contract

`2D Camera` creates an ordinary `kind: camera` record with camera schema version 2, fixed mode, orthographic projection, height 10, position near Z 10, and canonical XY orientation.

The Inspector exposes Projection, the active mode's framing value, Near/Far, position, rotation, Align to 2D Plane, View Through Camera, and Make Active Camera. Switching projection preserves both Field of View and Orthographic Height. Numeric orthographic height is the deliberate Phase 028 framing control; no direct viewport handle is claimed.

Only one authored camera is active. Placing a 2D Camera makes it active, Make Active transfers the marker, and duplicates are inactive. Active state, projection, inactive framing values, clip values, transform, and rotation survive save/load, level storage, and standalone export. Camera objects remain excluded from Sprite prefab semantics.

View Through Camera uses the real camera view and projection matrices. Return to Scene View restores the editor camera snapshot. The selected orthographic camera displays an aspect- and rotation-aware frame in edit mode; it is editor-only.
