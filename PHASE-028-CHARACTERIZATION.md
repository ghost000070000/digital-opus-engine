# Phase 028 Characterization

Before this phase, `Camera` always produced a perspective matrix, camera records had no projection schema, and the Inspector exposed only FOV. Authored Camera objects already supplied identity, modes, position, actions, serialization, duplication, level storage, and export. `Mat4.orthographic` already existed but had no camera or authoring route.

Phase 028 therefore extends those seams: Camera schema v2 adds projection, full vertical height, clip planes, and rotation; the runtime branches only at projection/ray construction; the existing Camera object gains the 2D preset and mode-aware controls; active-camera startup precedes existing parallax reference capture.

Preserved boundaries: one Camera kind, one renderer, one scene, existing perspective behavior, unchanged Sprite/Animation/Nine-Slice/Parallax contracts, no UI Canvas, no follow/bounds camera, no 2D physics/controller work, no pixel-perfect claim, and no Phase 029 hybrid redesign.
