# Phase 041 Baseline Characterization

- Baseline: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`; existing dirty worktree preserved.
- Engine baseline: 168,984 raw bytes, 43,457 gzip bytes, 22 sources.
- Integrated baseline: 2,121 assertions; Phases 011–040: 1,759 assertions; public games 28/28.
- Before Phase 041, the editor had legacy 3D solid/collider fields and Tile-owned collision intent, but no first-class passive Box/Circle Collider 2D Component, no selected-shape handles, and no canonical 2D overlap API.
- The phase boundary excludes response, Body roles, velocity, gravity, triggers/events, layers/masks, and automatic pair processing.

