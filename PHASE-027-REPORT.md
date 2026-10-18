# Phase 027 Report — Parallax Layers and Backgrounds

Status: qualified. Phase 027 adds reusable Sprite parallax without starting Phase 028.

## Baseline, preservation, and build

- Baseline HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`; the pre-existing dirty worktree was preserved.
- Baseline: engine 161,569 bytes / 41,584 gzip, full suite 1,109/1,109, Phase 011–026 747/747, 28/28 games, editor package 1,441,918 bytes.
- Final: engine 161,942 bytes / 41,634 gzip (+373/+50), full suite 1,163/1,163, Phase 011–027 801/801, Phase 027 54/54, and 28/28 games.
- Final editor package is 1,455,983 bytes (the builder's rounded display is 1,585 KB when its packaged sibling resources are included); the complete package is 221.6 MB. Engine and games sites passed catalog, path-safety, and broken-link gates with 28 public games and four Featured examples.
- No reset, clean, discard, commit, push, deployment, DNS change, or game 29 occurred.

## Registry and authoring result

- Project `parallaxLayers` entries contain stable `id`, unique creator-facing `name`, finite `factorX`, and finite `factorY`. Names are not identity. Add defaults to `0.5,0.5`; rename keeps IDs; duplicate is collision-safe; negative and above-one values are valid.
- Sprite Renderer advances from v8 to v9 with nullable typed `parallaxLayerRef`. Historical Sprites migrate to `null`, exactly equivalent to factor `1,1`.
- Project → Parallax Layers provides add, rename, X/Y edit, duplicate, affected-count confirmation, and delete. Inspector → Sprite Renderer → Parallax provides a name picker, None/Normal World, and an effective-factor summary. Inputs synchronize to the backing registry before blur so immediate Save/Export cannot capture stale visible values.
- Missing IDs remain stored, validate as dangling references, and use safe runtime `1,1`. Delete never remaps by display name.

## Runtime contract and proofs

- The authoritative world-axis formula is `offsetX = (cameraX-referenceX)*(1-factorX)` and the same for Y. Z is always zero correction. Rotation is not an input.
- Exact tests prove factor 0, 0.5, 1, 1.2/1.25, independent X/Y, negative factors, missing fallback, and non-finite safety. The export audit independently observes, for delta 20×10: Far 18×9, Mountains 11×5.5, Trees 8×4, World 0×0, Foreground -4×-2, and Screen Lock X 20×0.
- Fresh Play captures after spawn. Stop and level transition reset the reference. Active-camera identity changes recapture at the new camera and discard the old delta. Stable camera translation excludes transient shake.
- Offset is transient `Entity.spriteRenderOffset`, applied after hierarchy resolution to Simple and all Nine-Slice cell model matrices. Authored Transform, hierarchy, Z/depth, selection, sorting, pivot, size, Prefab data, snapshots, and Undo are unchanged. Parent parallax does not propagate.
- Animation clips, states, events, direction/mirroring, Flip X/Y, tint, opacity, and sorting remain independent. Billboard and Mesh are excluded.

## Visible browser dogfood

- At `http://127.0.0.1:8842/editor/`, a blank project was authored with Far Sky 0.1, Distant Mountains 0.45, Trees 0.6, Foreground 1.2, Screen Lock X 0/1, plus a no-layer Normal World Sprite.
- Five image fixtures were imported and six named Sprites were placed through normal controls. The matrix included a nine-slice foreground with 8/16/6/12 guides, explicit sorting/order, a flipped Prefab source, and a camera-translation-lock proof Sprite.
- Mountains was renamed to Distant Mountains and changed from 0.30 to 0.45 without changing `parallax-layer-2`. Play used existing W/D controls. Four linked Prefab instances were visibly placed (at least the requested three).
- The project validated cleanly, saved as `Phase 027 Parallax Dogfood`, reloaded from a fresh browser navigation, and restored all layer names, factors, scene records, and the Far Sky stable reference with effective 0.1/0.1.
- Both export commands completed visibly. The referenced-layer destructive break was not clicked without a fresh confirmation; its preserve/validate/fallback/repair contract is covered by the focused suite.

Structured visible evidence is in `phase-027-dogfood.json`.

## Standalone export qualification

`node tools/audit-phase-027.js` generated and clean-booted real standalone artifacts:

- Editable: `.tmp-phase027/phase-027-editable.html`, 1,648,026 bytes. Editor reopened; Project manager and Sprite picker were visible.
- Playable: `.tmp-phase027/phase-027-playable.html`, 1,647,778 bytes. Editor chrome remained absent.
- Both restored five named layers and six Sprite references, exercised exact offset math, retained authored Transform triples, included Simple and Nine-Slice paths, made zero external requests, and produced zero page errors.

Machine-readable evidence is in `phase-027-export-proof.json`.

## Regression, capability, and scope

- Static Sprite, Nine-Slice, Animation, State, Event, Direction/Flip, Prefab, duplicate, level serialization, validation, Editable/Playable shared runtime, Billboard exclusion, and 500-Sprite/100-layer sanity checks pass.
- Sprites / 2D remains B and Animation remains C. Parallax reduces manual background movement, duplicated camera-follow logic, and ad-hoc depth motion, but does not close broader 2D gaps.
- Remaining limits: orthographic/pixel-oriented camera, Phase 029 hybrid rules, Tilemaps, 2D collision/physics, dedicated 2D controllers, UI Canvas, and infinite background wrapping.
- Phase 028 can reuse the projection-independent world-axis formula and stable camera-reference service. Recommended next phase is Phase 028 only when separately authorized.

PHASE_027_SPRITE_PARALLAX_READY
