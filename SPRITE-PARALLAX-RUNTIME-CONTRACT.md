# Sprite Parallax Runtime Contract

At each fresh Play start, Phase 027 captures the active camera's stable world position after player spawn. For world-axis camera delta `D = current - reference` and layer factor `F`, the one authoritative offset is:

`offset = D * (1 - F)`

The offset applies to world X/Y only after hierarchy/world-transform resolution and before Sprite draw. Z, authored Transform data, hierarchy, snapshots, Undo, Prefabs, selection bounds, pivot, size, sorting, depth testing, tint, opacity, animation state, animation events, and direction/flip state are not modified.

Factor `1` produces zero correction; `0` is camera-translation locked on that world axis; values between zero and one create background motion; values above one create foreground exaggeration; negative values reverse and amplify relative motion. Factor zero is not HUD or screen space: camera rotation and perspective still apply normally.

Simple Sprites receive one outer render translation. Every cell of a Nine-Slice Sprite receives the same translation. Billboard and Mesh entities are excluded.

The reference is reset on Stop, fresh Play, and level transition. When the active authored camera identity changes, the new camera is used immediately and its current stable position becomes the new zero-delta reference. Transient camera shake is subtracted from the sampled position, preventing layer shear. Camera rotation is never a parallax input.

