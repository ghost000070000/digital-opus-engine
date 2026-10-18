# Orthographic Camera Contract

Phase 028 extends the existing `Camera`; it does not create a second camera type.

- `projection` is `perspective` or `orthographic`. Missing historical values normalize to `perspective`.
- `orthographicHeight` is the full vertical world span. Its default is 10 and valid authored values are finite and greater than zero.
- Horizontal span is `orthographicHeight * viewportAspect`. Invalid or zero aspect safely falls back to 1.
- Near and far keep the existing OpenGL clip convention and require `0 < near < far`.
- Camera translation along its viewing axis does not change orthographic object size. Perspective remains distance-scaled.
- `screenPointToRay` returns parallel rays whose origins move across the orthographic plane.
- Fixed cameras accept an authored up vector so arbitrary rotation and roll remain finite. Align to 2D Plane restores the canonical XY view, forward -Z and up +Y.
- The same renderer paths, scene, entities, depth ordering, and camera identity serve both projections.

Malformed runtime height/aspect input uses a finite fallback matrix; authoring validation still reports the bad stored value for repair.
