# Phase 020 Report

## Outcome

Phase 020 closes Epoch 02 by qualifying the Sprite foundation from a fresh local profile and hardening one reproduced Inspector-state defect. No new subsystem was introduced.

## Implementation and evidence

- Preserved live Sprite Renderer component identity during renderer synchronization; normalization now occurs only when a Sprite lacks the component.
- Reacquired current component/asset state in pivot, aspect, asset-pivot, and natural-size actions.
- Added 35 focused Phase 020 checks and wired them after Phase 019.
- Added clean-room, characterization, Epoch, dogfood, friction, and capability evidence.
- Kept Sprites / 2D at grade B and Tilemaps at grade D.

The clean-room project imports transparent, pixel-art, and atlas sources; slices 16 cells; uses repeated Asset-row placements; edits appearance, geometry, pivots, sorting, hierarchy, and authored rotation; builds and updates a linked Sprite Prefab; mixes a Sprite, Billboard, and opaque Cube; reloads a saved two-level project; validates cleanly; and exports both tiers. Both single-file exports retain two levels with 21 objects each, one linked prefab, five sorting layers, 11 used Sprite Assets, and three required Textures while pruning eight unused atlas-cell assets.

The final Editable and Playable exports were subsequently served from isolated temporary localhost origins and booted in newly created browser tabs. The Editable export opened its editor through the visible control, placed and edited a new `Smooth Hero` Sprite using normal authoring controls, passed Project Validation, rendered correctly in Play, and stopped normally. The Playable export entered the runtime directly with no visible path back to editor chrome and retained Sprite, atlas, filtering, opacity, ordering, prefab, Billboard, and opaque-occlusion parity. Neither artifact made a remote resource request or produced a page error, console error, or console warning. Full evidence is recorded in `PHASE-020-EXPORT-BOOT-CLOSURE.md`.

## Compatibility and scope

Phase 011–019 record shapes remain covered through the shared current loader and focused suites. Billboard remains a camera-facing 3D object; Sprite retains authored orientation and named 2D ordering. No orthographic/pixel-perfect Camera, Sprite animation, Tilemap, 2D collider/physics/controller, game #29, commit, push, deployment, or DNS change was made.

## Verification

- Phase 011–020 focused suites passed at 349/349; Phase 020 contributes 35/35 checks.
- Final integrated suite passed at 711/711, including showcase quality at 15/15 and public-site integration at 1/1.
- Engine build passed: 160,854-byte bundle, 41,445 bytes gzip, 22 source files; demo 178,748 bytes.
- Games build passed at 28/28: 116.7 MB total, four Featured and twenty-four Sample releases.
- Engine-site packaging passed path/link checks: 1,455 KB editor, 28/28 examples, 217.9 MB total.
- Games-site packaging passed path/link checks: 28/28 games with reviewed screenshot coverage, 138.2 MB total.
- Capability and friction generators pass `--check`: 57 capabilities (A 5, B 32, C 18, D 1, N/A 1) and 24 preserved friction records.
- The clean-room browser console contained no errors or warnings.
- Real-browser export closure passed for both final single-file artifacts from clean localhost origins; Editable authoring/Play and Playable-only runtime behavior were directly exercised with zero page errors, console errors, or console warnings.

## Verdict

`PHASE_020_SPRITE_FOUNDATION_QUALIFIED`
