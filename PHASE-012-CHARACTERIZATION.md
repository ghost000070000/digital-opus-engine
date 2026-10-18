# Phase 012 Characterization

The dependency-free suite is `tests/phase-012-sprite-assets.test.js` and is integrated into `tests/run-tests.js`.

It covers 36 checks across:

- Asset Type Registry identity, metadata, defaults, version, presentation, serialization owner, Texture source, and dependency hook.
- Stable rename-safe ID, bounded record shape, no image payload duplication, PPU validation, pivot validation, source dimensions, and natural-size math.
- Independent duplicate metadata with the same Texture reference.
- Typed Sprite Renderer assignment, missing Sprite Asset, missing source Texture, and Phase 011 direct-Texture migration.
- Texture → Create Sprite, composed Import as Sprite, search/type filter, preview, Inspector, explicit conversion, and natural-size placement.
- Save/Load, pruning, transitive dependency closure, Prefab/shared record paths, Editable/Playable shared export, warning-based deletion, Billboard regression, and Texture regression.
- Explicit absence of Phase 013-plus systems.

Browser dogfood used only normal editor controls with the local app icon PNG. It proved the composed image import, Texture creation, Sprite Asset creation/preview, rename, pivot and PPU editing, natural-size recalculation, placement, duplicate independence, two reusable definitions over one Texture, Sprite Renderer assignment, Sprite Prefab save, Save/Load, validation, an explicit missing-source placeholder/error, repair, and clean browser console. The revised acceptance pass also created a Phase 011-style direct-Texture Sprite through the Inspector, saved and reloaded it with 4×4 Width/Height and pivot `[0.25, 0.5]`, entered Play, exported both HTML tiers, explicitly converted it to `digital-opus-icon Sprite`, and verified that Width/Height, pivot, tint, visibility, and layer were preserved. The generated asset showed separate read-only Source Width, Source Height, Natural Width, and Natural Height fields, and final Project Validation reported no structured authoring issues. The second image-format check was deferred because the repository contains no existing JPG/JPEG/WebP fixture and Phase 012 does not expand formats merely to manufacture one.

Cross-project Prefab pressure remains characterized rather than redesigned: a Prefab stores the Sprite Asset ID, not copied metadata. In a project without that asset, the stable reference remains, validation reports it, and the renderer uses the placeholder (or a preserved Phase 011 compatibility Texture when present).
