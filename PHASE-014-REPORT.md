# Phase 014 Report

Verdict: PHASE_014_SPRITE_BILLBOARD_BOUNDARY_READY

1. **Verdict:** PHASE_014_SPRITE_BILLBOARD_BOUNDARY_READY.
2. **Baseline/final build:** HEAD f1dc3516b585ebf5aa868006792c1dc1b9039da9 on main. Baseline was 462/462 integrated, 28/28 games, engine 159,879 bytes / 41,277 gzip, demo 177,773 bytes, editor 1,403 KB. Final engine/demo sizes are unchanged; editor is 1,405 KB.
3. **Sprite creator definition:** An authored flat visual for true 2D and intentional hybrid scenes, using Sprite Assets, pivot/size semantics, and named Sprite Sorting Layers.
4. **Billboard creator definition:** A camera-facing world-space image for 3D scene imagery and impostors, using generic Texture/Material, lighting, alpha, and ordinary depth.
5. **Sprite serialized identity:** Explicit kind sprite with a Sprite Renderer component.
6. **Billboard serialized identity:** Legacy-compatible kind cube, mesh billboard, and isBillboard true; no migration or identity change.
7. **Palette distinction:** Separate ▧ Sprite and 🌿 World-Space Billboard entries with concise semantic tooltips.
8. **Scene-tree distinction:** Sprite and Billboard now receive honest, separate labels.
9. **Inspector distinction:** Sprite shows Sprite Asset, size, pivot, tint, visibility, Sorting Layer, and Order in Layer; Billboard shows world Transform, generic Texture/Material, and facing mode, with no Sprite fields.
10. **Sprite orientation behavior:** Camera motion never rewrites Sprite quaternion; authored full XYZ orientation remains stable.
11. **Billboard camera-facing behavior:** Full mode follows pitch/yaw; Cylindrical follows yaw only and stays upright.
12. **Sprite Transform semantics:** Transform is the authored position, orientation, and scale of the stable plane.
13. **Billboard Transform semantics:** Transform supplies authored position/scale; camera-facing owns resulting world orientation according to the selected mode.
14. **Sprite Sorting Layer boundary:** Layers and Order in Layer apply only to Sprites; Transform Z is not Sprite/Sprite order.
15. **Billboard sorting behavior:** Opaque Billboards use ordinary opaque depth; alpha Billboards use ordinary transparent 3D camera-distance sorting.
16. **Render-pass order:** Opaque 3D, transparent 3D far-to-near, then named-order Sprites.
17. **Sprite depth behavior:** Depth test stays enabled against opaque 3D; depth writes are disabled. Higher Sprite layers do not X-ray through walls.
18. **Billboard depth behavior:** Billboards remain in the normal opaque/transparent 3D buckets and depth model.
19. **Sprite-vs-Billboard deterministic behavior:** Opaque Billboards can occlude Sprites; transparent Billboards draw in transparent 3D before the Sprite pass; Sprite layering remains Sprite-only.
20. **Transparent overlap limitations:** Transparent 3D is a bounded far-to-near approximation; no universal OIT or cross-system render queue is claimed.
21. **Hierarchy result:** Sprite-to-Sprite, Sprite-to-generic-Mesh, and Billboard-to-Cube were saved/reloaded. The generic Mesh parent was also moved and rotated through On Start tweens. Runtime order resolves hierarchy before Billboard facing, fixing parent quaternion overwrite while preserving inherited position/scale.
22. **Duplicate result:** Both Sprite and Billboard duplicates retain their respective identity and data.
23. **Prefab result:** Sprite and Billboard prefabs were created through normal editor UI; shared prefab dispatch and Phase 014 tests preserve each concept's distinct instantiate path.
24. **Save/Load:** phase-014-hybrid-dogfood saved and reloaded with objects, two Sprite Assets, layers, transforms, both Sprite hierarchy forms, Billboard hierarchy, texture alpha, Material alpha, parent motion, and camera behavior intact.
25. **Editable Export:** Normal-editor Editable Export completed through the shared embedded runtime.
26. **Playable Export:** Normal-editor Playable Export completed and reported no editor access, using the same runtime behavior.
27. **Legacy Billboard regression:** No shipped game contains a Billboard; the frozen pre-Phase-014 kind cube / mesh billboard / isBillboard fixture passes without conversion.
28. **Phase 011 regression:** 26/26 passing.
29. **Phase 012 regression:** 36/36 passing.
30. **Phase 013 regression:** 38/38 passing.
31. **Hybrid dogfood scene:** Six authored Sprites plus a duplicate, including a real RGBA transparent Sprite; Background/Actors/Foreground layers; full and cylindrical Billboards plus a duplicate; opaque and transparent meshes; a Point Light; Sprite-under-Sprite, Sprite-under-generic-parent, and Billboard-under-generic-parent hierarchy; moving/rotating parent behavior; prefabs; Save/Load; Play; and exports.
32. **Camera-movement proof:** Angle A used the normal player/chase view; Angle B used an authored fixed camera at [10,5,10] aimed at the opaque scene object through On Start -> Change Camera. Billboards stayed camera-readable while authored Sprite planes showed their own rotations and perspective.
33. **Occlusion proof:** The opaque slab masks image planes where depth requires; the alpha Mesh blends in the 3D transparent pass; Sprite sorting never bypasses opaque depth.
34. **Visual evidence:** Inline live-browser captures cover Scene identity/hierarchy, front/chase view, oblique fixed view, close perspective overlap, the transparent Sprite Asset/instance, moving-parent behaviors, and successful Playable Export. Details are indexed in phase-014-dogfood.json.
35. **Optional conversion result:** Deferred. Camera-facing, lighting, Sprite Asset ownership, pivot/size, and sorting semantics cannot be preserved honestly without creator choices; manual recreation is safer than a misleading conversion.
36. **Validation changes:** None. Sprite/Billboard coexistence is valid and should not generate noise; objective invalid references continue through existing validation.
37. **Help/documentation changes:** Added Palette tooltips, Inspector boundary notes, Billboard-mode help, the Sprite or Billboard? Help topic, and two authoritative contracts.
38. **Phase 014 targeted test count:** 36/36.
39. **Integrated test count:** 498/498 after adding Phase 014's 36 tests.
40. **28-game regression:** 28/28 playable game builds; no game #29.
41. **Package/editor size change:** Engine and demo unchanged. Packaged editor increased from 1,403 KB to 1,405 KB (+2 KB); game output remains approximately 115.4 MB.
42. **Friction update:** AFR-0001 now records the real Sprite, Sprite Assets, named sorting, explicit Sprite/Billboard boundary, hybrid pass/depth behavior, dogfood, and remaining genuine 2D gaps.
43. **Capability grade:** Sprites / 2D remains B. Phase 014 improves clarity and correctness but does not complete the full 2D workflow.
44. **Documented hybrid limitations:** No universal transparent ordering, pixel-perfect/orthographic projection, per-camera Sprite layers, automatic 2.5D depth rules, Y-sort, Sprite lighting/shadows, Billboard Sprite sorting, or generic render queue.
45. **Readiness for Phase 015:** The semantic boundary, compatibility fixture, hierarchy order, creator UI, contracts, and regression suite are ready; no Phase 015 work was implemented.
46. **Recommended next phase:** Phase 015 only when explicitly requested, focused on its bounded Sprite sizing/pivot creator tooling.
