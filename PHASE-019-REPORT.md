# Phase 019 Report

## Outcome

Sprite Assets are now directly placeable content. Their normal Assets-library rows drag into the current perspective viewport and immediately create selected, editable, correctly configured Sprite objects. Search, Sprite type filters, folders, and tags reuse the same rendered rows; the non-drag Place Sprite flow uses the same typed dispatcher.

## Implementation

- Added a bounded typed placement payload containing only `assetType: "sprite"` and the stable Sprite Asset ID.
- Extended the existing pointer placement lifecycle with a six-pixel Asset-row threshold, native image/text-drag suppression, cropped region ghost, viewport drop marker, outside/pointer-cancel/Escape cleanup, and a common payload commit dispatcher.
- Reused the current camera ray, Y=0 ground plane, optional existing position snap, root-level `addPlaced`, Sprite record instantiator, selection/Inspector, and scene snapshot Undo/Redo architecture.
- Centralized Sprite placement-record creation in authoring plumbing: natural full/region size, asset pivot, white/opaque/visible defaults, Default Sorting Layer, Order 0, default transform, and collision-safe object names.
- Kept asset metadata authoritative: source Texture/region/filtering are resolved through stable asset identity; instance Width/Height and pivot are initial copies and remain independent overrides.
- Preserved missing-source placeholder/validation behavior and kept Texture, Mesh, Audio, Billboard, and Prefab boundaries distinct.
- Added the Asset-row Place action and command-palette `Place Sprite` alternative, both arming the same typed viewport placement path.
- Added 39 Phase 019 checks, the placement contract, characterization, and normal-editor dogfood evidence.

## Compatibility and scope

Placed results have no drag provenance: they are ordinary Sprite records and therefore use existing Save/Load, Level duplication, Prefab, Play, Editable Export, and Playable Export behavior. Existing Palette placement also benefits from the shared spatial snap dispatcher when Snap is enabled. No generic Asset placement rewrite or runtime API change was introduced.

No orthographic/pixel-perfect camera, screen-space placement, animation, Tilemap, 2D physics/controller, bulk placement, or game #29 was added. Phase 020 was not started.

## Verification

- Baseline HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`; branch `main`; unrelated dirty work preserved.
- Baseline engine build passed; baseline integrated suite passed at 637/637; required Phase 018 verdict was present.
- Baseline games passed at 28/28, 116.4 MB.
- Phase 011–019 focused suites passed; Phase 019 adds 39/39 checks.
- Normal-editor dogfood passed the blank import, five-repeat Pixel Sprite drag, sixteen-cell atlas slice, four distinct atlas drops, direct manipulation, sorting, Undo/Redo, cancellation, Save/Load, Prefab, Level duplicate, Play/Stop, and both export-tier gates. See `phase-019-dogfood.json`.
- Browser console contained no errors or warnings.
- Final integrated suite passed at 676/676, including Phase 019 at 39/39, showcase quality at 15/15, and public-site integration at 1/1.
- Final engine build passed: 160,854-byte bundle (41,445 bytes gzip) and 178,748-byte demo.
- Final games build passed at 28/28: 116.7 MB total, with four Featured and twenty-four Sample releases.
- Final engine-site package passed path and link checks: 1,453 KB editor, 28/28 examples, 217.8 MB total.
- Final games-site package passed path and link checks: 28/28 games with reviewed screenshot coverage, 138.2 MB total.
- No commit, push, deployment, DNS action, or game #29 was performed.

## Capability assessment

Sprites / 2D remains grade B. Sprite Asset → direct placement is now qualified common-path creation, while orthographic/pixel-perfect cameras, Sprite animation, Tilemaps, and 2D collision/physics remain genuine broader limitations.

## Verdict

PHASE_019_SPRITE_PLACEMENT_READY
