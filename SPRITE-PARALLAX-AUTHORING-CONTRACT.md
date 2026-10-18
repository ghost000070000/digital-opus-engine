# Sprite Parallax Authoring Contract

Creators manage reusable layers in **Project → Parallax Layers** and assign them in **Inspector → Sprite Renderer → Parallax**. The picker displays names and persists stable IDs; `None` means Normal World. The Inspector shows effective X/Y factors but does not duplicate factor editing per instance.

The normal workflow is: import an image, create/place a Sprite, choose its Sorting Layer, choose its Parallax Layer, position and resize it, then Play. Layout remains at authored Transform positions in Edit mode. Save/Load, duplicate, Prefab, level duplication, Editable Export, and Playable Export use the ordinary shared project/component paths.

Validation requires non-empty stable IDs, case-insensitively unique names, finite factors, and resolvable Sprite references. Registry issues navigate to Project settings; Sprite-reference issues navigate to the Sprite Renderer Parallax field. Factor guidance is advisory: `0` translation-lock, `0.1–0.4` far, `0.4–0.8` mid, `1` normal, and `>1` foreground.

Phase 027 does not add orthographic cameras, pixel-perfect framing, camera-local axes, Z parallax, background wrap/tiling, auto-scale, auto-fade, Mesh parallax, Billboard parallax, or screen-space UI.

