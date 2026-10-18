# Pixel-Perfect Camera Future Seam

Phase 028 provides explicit orthographic world framing, not a pixel-perfect camera system.

A future pixel-perfect layer can derive world-units-per-pixel from `orthographicHeight / viewportPixelHeight`, then choose an integer scale or quantized height. That policy should wrap the existing `projection` and `orthographicHeight` fields without changing their meaning. It will also need explicit reference resolution, crop/letterbox policy, sub-pixel camera snapping, Sprite pivot/import rules, and tests across device pixel ratios.

No automatic pixel snapping, integer scaling, reference resolution, crop policy, or pixel-perfect claim is made here.
