# Sprite Slicing Workflow

## Manual region

1. Import an image as a Sprite, or create a Sprite from an existing Texture.
2. Inspect the Sprite Asset and edit Source Region X, Y, Width, and Height in pixels.
3. Drag the cyan rectangle over the full-image preview to move it, or drag its lower-right handle to resize it. Numeric fields update to the bounded integer result.
4. Adjust region-relative Pivot, Pixels Per Unit, and Smooth or Pixel / Nearest sampling.
5. Use **Use Full Image** to clear the explicit region and restore the entire Texture.

## Regular grid

1. Expand **Slice as Grid** on any Sprite Asset whose Texture is available.
2. Enter Cell Width/Height. Optional Margin X/Y and Spacing X/Y support regularly spaced sheets.
3. Review the overlaid cell preview and generated count, then enter a base name.
4. Choose **Create Sprite Assets**. Names are deterministic (`name_001`, `name_002`, …), collisions gain a non-overwriting suffix, and each region receives a new stable ID.

Created assets inherit the current Sprite Asset's pivot, PPU, sampling, folder, tags, and source Texture. They are ordinary independent Sprite Assets for search, rename, duplicate, deletion, placement, Prefabs, Save/Load, and export. Slicing creates definitions only; it does not infer or play animation.

