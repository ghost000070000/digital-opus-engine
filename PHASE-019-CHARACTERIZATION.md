# Phase 019 Characterization

## Before

Sprite Assets were reusable and could be assigned at creation through a library **Place** button at a fixed origin, but their rows were not viewport drag sources. The ordinary visible sequence was: create a Sprite object, select it, find and assign the Sprite Asset, apply natural size, and optionally restore the asset pivot. The library did not communicate typed Sprite identity through the existing pointer-placement lifecycle, repeated drag placement had no contract, and there was no cursor-intent placement alternative.

## After

The common sequence is one gesture: drag a Sprite Asset row into the viewport. The row supplies only `{ assetType: "sprite", assetId }` to the shared placement dispatcher. The existing perspective ray/ground-plane calculation, optional spatial snap, object instantiation, root parenting, selection, Inspector, scene list, and snapshot Undo/Redo paths remain authoritative. A six-pixel threshold preserves click-to-inspect behavior. The Place button and command palette arm that exact same dispatcher for non-drag input.

Successful placement creates an ordinary Sprite at ground-ray X/Z and canonical Sprite pivot height Y=1. Full-image and atlas-region natural size, asset pivot, Default/0 sorting, white/opaque/visible appearance, unique Object ID, and collision-safe object name are correct immediately. Source region, source Texture, and filtering stay live-linked through the asset ID; size and pivot remain instance overrides after the initial copy. Broken source Textures remain repairable placeholders.

## Normal-editor dogfood

At `http://127.0.0.1:8872/editor/index.html?phase=19`, a clean guided/blank project imported `tests/fixtures/phase-017-pixel-art.png` through **Import as Sprite**, changed Sampling to Pixel / Nearest, and dragged the same Sprite Asset five times. The selected Inspector showed the expected 0.16×0.16 size, 0.5/0.5 pivot, Default/0 sorting, opacity 1, stable `spriteAsset1` reference, and root parent. Repeated names advanced from `phase-017-pixel-art Sprite` through `phase-017-pixel-art Sprite 5`.

The normal editor then imported `tests/fixtures/phase-018-atlas.png`, opened **Slice as Grid**, created sixteen 32×32 Sprite Assets, filtered the library through search, and dragged four different cells. Each selected Sprite showed 0.32×0.32 natural size and its corresponding region-backed asset. One was directly resized to 1.3467×0.32, pivoted to approximately 0.6434/0.8354, moved to X=-8, and assigned `Sorting Layer 1` with Order 7.

A fifth atlas placement was immediately undone and redone; the scene returned with ten named drag-created Sprites and no duplicate identity/name. One restored placement was saved as `Phase 019 Atlas Sprite`, then instantiated through the ordinary Prefab palette. Save/Load of `phase-019-dogfood` retained eleven objects and all eighteen Sprite Assets across two shared Textures. Level duplication retained all eleven objects. Play/Stop, Editable Export, and Playable Export completed. Browser warnings/errors were empty.

## Interaction reduction

Prior common path: create Sprite; select it; locate Sprite Asset; assign it; use natural size; apply asset pivot if desired. Qualified Phase 019 path: drag the Sprite Asset once. Search/filtering may precede either path but does not add a configuration step.

## Scope and grade

Sprites / 2D remains grade B. Direct asset placement materially improves the common creation loop but does not add orthographic/pixel-perfect cameras, animation, Tilemaps, or 2D collision/physics. Phase 020 was not started.
