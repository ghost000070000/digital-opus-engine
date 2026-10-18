# Orthographic and Parallax Integration

Phase 028 deliberately reuses Phase 027's parallax service unchanged. Parallax remains a world-axis render offset derived from stable camera translation and the active authored camera identity. Projection type and orthographic height are not formula inputs.

At fresh Play, the active authored camera is applied before the parallax reference is captured. A later camera switch updates the stable camera ID, causing reference recapture rather than carrying delta across cameras. Transient shake remains removed from the stable eye position.

This preserves simple and nine-slice Sprite behavior, sorting, flip, animation, states, events, direction variants, Billboard exclusion, Mesh behavior, and authored transforms across perspective and orthographic cameras.
