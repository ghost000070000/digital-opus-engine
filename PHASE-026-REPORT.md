# Phase 026 Report — Nine-Slice Sprites

Status: qualified. Phase 026 adds bounded nine-slice authoring and rendering without starting Phase 027.

## Baseline and preservation

- Baseline HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`.
- The pre-existing dirty worktree was preserved. No reset, clean, discard, commit, push, deployment, DNS change, or game 29 occurred.
- Baseline engine bundle: 160,854 bytes / 41,445 gzip bytes.
- Baseline full suite: 1,029/1,029; Phase 011–025: 667/667; games: 28/28.
- Baseline editor package: 1,426,881 bytes.

## Delivered contract

- Sprite Asset schema advances to v4 and owns optional `nineSlice: { left, right, top, bottom }` metadata in source-region pixels. Historical assets migrate to `null` guides.
- Sprite Renderer schema advances to v8 and owns `renderMode: simple | nine-slice`. Historical renderers migrate to `simple`.
- One logical Sprite remains one sortable scene entity. Nine-slice presentation expands only at draw time into up to nine contiguous quads using one texture, sampler, tint, opacity, visibility, sorting tuple, and depth policy.
- Fixed border world sizes derive from guide pixels divided by Pixels Per Unit. Width and Height remain per-instance outer bounds.
- When a target is smaller than the opposing borders, each pair compresses proportionally per axis and the center collapses safely without negative or non-finite geometry.
- Atlas regions retain the Phase 018 top-left-to-WebGL conversion and sampling-safe outer bounds. Internal cells share exact UV boundaries.
- Flip X/Y mirrors source cells and swaps asymmetric border geometry, preserving a true visual mirror without negative Transform scale.
- Animation resolves the current frame Sprite Asset before nine-slice generation. Missing or invalid guides use the documented Simple fallback without a crash.

The authoritative details are in `NINE-SLICE-SPRITE-ASSET-CONTRACT.md`, `NINE-SLICE-RENDERING-CONTRACT.md`, and `NINE-SLICE-AUTHORING-CONTRACT.md`.

## Authoring surface

- Sprite Asset Inspector exposes Enable/Define, Left, Right, Top, Bottom, Clear Guides, effective source-region dimensions, and a visible 3×3 overlay.
- Sprite Renderer Inspector exposes a bounded Render Mode and a status summary with authored guides and natural side sizes.
- Direct Sprite resize, Use Natural Size, Save/Load, duplicate, Prefab, Level duplication, validation, Play, and both export tiers use the existing shared paths.
- Numeric guide editing plus the visual overlay is the accepted Phase 026 workflow. Draggable guide lines were intentionally omitted because they would conflict with the existing source-region drag surface; the phase brief explicitly allowed numeric controls plus visualization.

## Visible browser dogfood

The live source package at `http://127.0.0.1:8841/editor/` was exercised from Start Blank through ordinary editor controls only. Project state was not injected.

- Imported a full-image 64×64 panel fixture and a 128×96 hostile-neighbor atlas fixture.
- Authored asymmetric guides 8/16/6/12 and observed the 3×3 overlay on both assets.
- Set the atlas region to x32/y16/64×64 and Pixel/Nearest; the full-image asset remained Smooth.
- Placed eight instances: Simple Baseline, Nine-Slice Normal, Wide, Tall, Tiny, Flip X, Flip Y, and Atlas Nine-Slice.
- Applied tint `#d8f8ff` and opacity `0.85` to the atlas instance.
- Resized Flip Y from 3.00×2.00 to 3.64×2.00 by dragging its visible right handle; guide metadata remained asset-owned and unchanged.
- Broke atlas guides to Left 60 + Right 16 on a 64px region. Validation surfaced `sprite-nine-slice-guides-invalid` and `sprite-nine-slice-horizontal-bounds`.
- Entered Play while broken. The runtime stayed stable on the documented Simple fallback.
- Repaired Left to 8; validation returned no structured authoring issues.
- Saved as `Phase 026 Nine-Slice Dogfood`, reloaded the browser, loaded the saved slot, and observed all eight named instances.
- Saved `Nine-Slice Panel Prefab`, placed three linked instances, and edited them to normal, wide, and tiny sizes.
- Final visible validation passed. UI-triggered playable export reported completion; editable export entered its normal build flow with no browser console warnings or errors.

Structured evidence: `phase-026-dogfood.json`.

## Export qualification

`node tools/audit-phase-026.js` generated real standalone artifacts and clean-booted both from `file:` URLs:

- `.tmp-phase026/phase-026-editable.html`: 1,635,918 bytes; editor re-opened; guide controls present.
- `.tmp-phase026/phase-026-playable.html`: 1,635,979 bytes; editor chrome absent.
- Both contained eight Sprite records, the expected guide and atlas metadata, seven nine-slice renderers, finite geometry, true flip flags, and the tiny 0.15×0.12 case.
- Normal/wide/tall/flip/atlas instances emitted nine cells. The tiny case emitted six non-degenerate cells because its center column collapsed to zero and was skipped.
- Both exports made zero network requests and produced zero page errors.

Machine-readable evidence: `phase-026-export-proof.json`.

## Regression and build evidence

- Phase 026 focused suite: 80/80.
- Full test suite: 1,109/1,109 after adding Phase 026.
- Public-site integration: 28 public games, 0 internal excluded, 1/1 gate.
- Final engine bundle: 161,569 bytes / 41,584 gzip bytes, a bounded increase of 715 bytes / 139 gzip bytes from baseline.
- Final editor package: 1,441,918 bytes, a bounded increase of 15,037 bytes from baseline.
- Game build: 28/28. Engine site: 28/28 examples with four Featured, path-safety and link checks passed. Games site: 28/28 with screenshot coverage, path-safety and link checks passed.
- Capability dashboard check: 57 capabilities; A=5, B=32, C=18, D=1, N/A=1.
- Capability dashboard remains truthful: Sprites / 2D stays B; Animation stays C. `AFR-0001` remains CONFIRMED but now records the bounded nine-slice improvement.

## Scope boundary

No UI Canvas, tile/repeat mode, text layout, parallax, collision, guide auto-detection, or Phase 027 work was added.

PHASE_026_NINE_SLICE_SPRITES_READY
