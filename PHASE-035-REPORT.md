# Phase 035 Report — Auto-Tiling Rules

Verdict: `PHASE_035_AUTO_TILING_READY`

## Baseline and final build

- Baseline HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`; branch `main`; the pre-existing dirty worktree was preserved.
- Baseline/final engine: 166,134 bytes / 42,573 gzip / 22 sources; delta 0 / 0. Auto-tiling remains editor authoring logic.
- Baseline editor package: 1,715 KB. Final qualification build: 1,750 KB; delta +35 KB.
- Public games: 28/28. Engine site: 28/28 examples with path/link checks. Games site: 28/28 with path/link checks. No game 29, deployment, DNS, commit, push, terrain system, physics, or Phase 036 implementation.

## Implemented model

- Tileset advances from v2 to v3 and normalizes historical `autoTileSets` to `[]`. Sets own stable Tileset-local ID, unique creator name, `four-way` or `eight-way` mode, required Default Tile, and sorted `{mask,tileId}` Rules.
- Tilemap advances from v2 to v3. Historical cells remain manual `{x,y,tileId}`. Auto-managed cells add `autoTileSetId`; this is semantic membership while `tileId` is the deterministic resolved render/collision cache.
- Four-way bits are N=1, E=2, S=4, W=8. Eight-way adds NE=16, SE=32, SW=64, NW=128 and gates every diagonal by both adjacent cardinals. Enumeration proves 47 canonical eight-way masks.
- Connectivity requires the same Set ID, Tilemap, and Layer. Manual Tiles, other Sets, other Layers, and other Tilemaps never connect. Negative coordinates require no special case.
- Exact valid Rules win; otherwise a valid Default wins. Broken Rules fall back to Default. Missing Sets or broken Defaults preserve the stored Tile output and validate rather than blanking content.

## Authoring and recompute

- The Tile Palette exposes Tiles and Auto-Tile Sets, cards, coverage, create/rename/duplicate/delete, dependency-aware Tile deletion, explicit convert-to-Manual repair, Default/mode controls, a keyboard-native 3x3 mask grid, typed output picker, and canonical Rule list.
- Selecting a Tile activates Manual Tile Brush; selecting a Set activates Auto-Tile Brush. Hover resolves and names the hypothetical output. Auto Paint, erase, same-Set repair, A→B replacement, Manual→Auto, and Auto→Manual use the central resolver and Phase 032 interpolation.
- Membership mutations recompute only the changed cell and the eight-cell superset neighborhood. Output changes do not recurse. Rule, Default, delete, and mode changes use deterministic full Set usage recomputation across the project before Save/Export.
- Snapshot history includes direct and neighbor-derived changes. Browser proof shows one long stroke at 33→41 cells, Undo to 33, and Redo to 41.
- Collision remains Tile-owned: changing the resolved Tile automatically changes Phase 034 overlay/collision source without copying metadata or adding physics.

## Persistence, validation, and export

- Save/Load preserves Sets, ordered Rules, membership, and canonical resolved outputs. Tilemap/Level/Tileset duplication use existing record paths and deep-independent Tileset copies.
- Validation covers malformed/duplicate Sets, names, modes, Defaults, masks, Rule outputs, and aggregated missing-Set cells. Navigation opens the exact Set/Rule or representative Layer/cell.
- Editable Export retains full Sets/Rules and 44 browser-authored managed cells. The 1,805,303-byte artifact boots with authoring intact.
- Playable Export strips Sets/Rules and `autoTileSetId`, retaining the same 44 resolved `{x,y,tileId}` cells. The 1,799,149-byte artifact has exact visual Tile parity and uses resolved dependency closure.
- Engine renderer/API source audits and exported boot state prove no runtime neighbor solver, per-frame recompute, or gameplay Auto-Tile API.

## Qualification evidence

- Focused Phase 035: 104/104.
- Phase 011–035 aggregate: 1,378/1,378.
- Integrated suite: 1,740/1,740.
- Phase 031: 78/78; Phase 032: 52/52; Phase 033: 85/85; Phase 034: 86/86.
- Fuzz: 50,000 deterministic mutations, ten fixed seeds, both modes, 1,000 comparison batches; incremental state equaled full recompute after every batch.
- Bounded current-run observations: 2,500-cell full recompute 12.97 ms; 25 Tilemaps / 5,000 cells 19.10 ms; 1,000-cell Auto stroke model 14.11 ms. These are sanity observations, not Phase 040 claims.
- Real browser dogfood authored all 16 Road Rules through visible controls and proved isolated, horizontal, vertical, L, T, plus, erase-retile, manual override/restore, negative coordinates, live Rule edit, stable rename, independent duplicate, eight-way mask 19, gated result 2, and cross-Layer isolation.
- Browser/editor, Editable, and Playable checks recorded zero page errors, console errors, and external requests. Validation reported no structured authoring issues.

## Capability and boundary

- Tilemaps remain grade B; Sprites / 2D remains B. AFR-0002 remains RESOLVED with Phase 035 evidence. Genuine residual friction: 16/47 Rule setup is repetitive, the mask concept and gated corners require learning, and manual-vs-auto brush state requires attention.
- Remaining Tilemap gaps include terrain/biome brushes, object/spawn markers, chunk reuse, import/export hardening, animated Tiles, richer layer presentation, final large-world qualification, and later actual physics.
- The Phase 036 seam allows a later Terrain/Biome brush to select existing Sets and submit the same authoring operations without changing connectivity or runtime boundaries. Phase 036 is ready to begin but was not implemented.
- Recommended next roadmap phase: Phase 036 Terrain Brush Integration, subject to a new explicit request.
