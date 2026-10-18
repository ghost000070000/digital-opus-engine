# Phase 025 Characterization

Before Phase 025, Sprite Renderer v6 had stable named States and Clip Events but no authored instance flip, semantic direction, or directional State override. Creators needed duplicate facing art, negative-scale presentation hacks, or logic that manually selected Clips.

The existing renderer already had shared UV scale/offset uniforms and Phase 018 owned atlas-region calculation, making endpoint reversal the smallest safe flip seam. Phase 023's renderer-local States are the correct owner for sparse direction variants; Clip assets remain reusable and direction-agnostic.

The implementation deliberately excludes movement/input inference, controller integration, transition graphs, static-pose variant architecture, Tilemaps, 2D physics, orthographic camera, and Phase 026 nine-slice.
