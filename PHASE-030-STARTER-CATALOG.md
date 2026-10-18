# Phase 030 Sprite Starter Catalog

| Stable ID | Display name | Intended first step | Included proof |
|---|---|---|---|
| `sprite-2d-scene` | 2D Sprite Scene | Minimal 2D structure, then get out of the creator's way | Orthographic XY Camera, Background/World/Foreground sorting, Far Background parallax, one removable local Sprite |
| `sprite-animated-character` | Animated Character | Teach Asset → Clip → State → Direction → Event | Local atlas, Idle/Walk/Attack, Loop and Once, nonuniform timing, Mirror X, distinct left Walk Clip, Footstep and Attack Hit events |
| `sprite-parallax-hybrid` | Parallax Hybrid Scene | Show a small predictable Sprite/3D composition | Far/Mid parallax, Smooth and Pixel assets, Nine-Slice sign, opaque Cube, transparent Billboard explicitly Behind Sprites |

All three create independent current-format projects with one active Orthographic Camera, canonical named Sprite sorting layers, local/offline dependencies, zero structured authoring issues, and normal Save/Load and export paths. The catalog is a frozen three-entry data surface backed by small creator functions in `editor/src/00-sprite-starters.js`; it is not the Phase 201+ generalized template system.

