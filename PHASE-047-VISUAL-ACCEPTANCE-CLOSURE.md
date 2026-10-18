# Phase 047 — Visual Acceptance Closure

Exact verdict: **PHASE_047_BLOCKED**.

The original evidence-only visual block is closed: all five real exported-runtime motion cases pass with retained screenshots and structured state, and exported Editable authoring/save/reload/Play passes. During that work, however, the real Playable exposed two product defects in the previously endurance-qualified fingerprint. Both were repaired. The repaired fingerprint is stable through the closure campaign and all bounded gates, but it is not the fingerprint that completed the 4h01m11.855s endurance run. The earlier endurance remains valid historical evidence for the old build; it does not automatically qualify the repaired build. Per the closure specification, Phase 047 therefore remains blocked and no new endurance run was started.

## Requested final report (1–60)

1. Final verdict — `PHASE_047_BLOCKED`.
2. Closure run ID — `phase-047-visual-closure-20260925T111844718Z`.
3. Original block reason — missing retained human-readable visual proof for five actual-motion cases and no fresh exported-editor slope Tile authoring proof.
4. Product source changed? — Yes. Real browser acceptance found and repaired a flat-to-slope seam defect and an exported Editable Tileset reload defect.
5. Start source fingerprint — `3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6`; the prior endurance fingerprint was `f2ba97b8834629ecbed284b11690a25999fe7c0efb9b243e932329591d49b7ff`.
6. Final source fingerprint — `3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6`; unchanged during the final visual campaign.
7. Editable — 2,065,661 bytes; SHA-256 `c7a938532a14595af29ac74230e3696de5e61998d6231bd02c6c3eabff9d6234`.
8. Playable — 2,042,033 bytes; SHA-256 `c012c6eca795a8f300ea9dfaa5407bba4bf07142e2bc32c017c449b4625fa69c`.
9. Browser — Microsoft Edge/Chromium `153.0.4234.32`, isolated contexts.
10. Viewport — 1440×900.
11. Uphill visual result — PASS; actual Body 2D velocity moved the Character from flat ground onto the 30° scene ramp.
12. Uphill screenshots — `01-uphill-before.png`, `01b-uphill-mid.png`, `02-uphill-after.png`.
13. Uphill positions — start `[-4.8,-0.667,0]`; end `[0.2727500000596065,1.3657626628213602,0]`.
14. Uphill final state — grounded true, onSlope true, normal `[-0.5,0.8660254037844387]`, angle ~30°, support `uphill-ramp`, no wall.
15. Tile slope visual result — PASS using an actual Tilemap cell with slope collision, not a scene Box substitute.
16. Tile slope screenshots — `04-tile-slope-before.png`, `05-tile-slope-after.png`.
17. Tile slope support ID — `tile:closure-tile-map:closure-tile-layer:0:0`.
18. Tile slope angle/normal — 45°; `[-0.7071067811865475,0.7071067811865475]`.
19. Exported-editor Tile authoring — PASS through visible UI. `Closure Authored Slope` was duplicated, set to Slope / Up Left / One-Way, saved, reloaded, and retained with stable ID `tile-solid-copy`; screenshots `03-exported-editor-tile-slope-authoring.png` and `16-exported-editor-slope-authoring.png`.
20. One-way upward pass — PASS; Character moved from below to y=2.0192 with no ceiling or wall contact.
21. One-way upward screenshots — `06-one-way-slope-below.png`, `07-one-way-slope-passed-up.png`.
22. One-way downward land — PASS on the same slope Tile.
23. One-way landing screenshot — `08-one-way-slope-landed.png`.
24. One-way landing state — grounded true, onSlope true, angle 45°, no wall, support `tile:closure-one-way-map:closure-one-way-layer:0:0`.
25. Stair traversal — PASS across four sequential 0.25-unit steps by ordinary horizontal Body velocity.
26. Stair screenshots — `09-stairs-before.png`, `10-stairs-mid.png`, `11-stairs-after.png`.
27. Stair positions — start `[58.2,0.4,0]`; midpoint `[61.61879999995283,1.150101,0]`; top `[64.41220000004847,1.4,0]`.
28. Step-up evidence — midpoint support `stair-3`, top support `stairs-top`, grounded at both; discrete event count was not instrumented and is not invented.
29. Descent evidence — PASS; `12-stairs-descended.png`, final `[59.186600000143166,0.4,0]`, grounded on `stairs-floor`.
30. Too-steep result — PASS; horizontal motion was blocked with no climb.
31. Too-steep screenshots — `13-too-steep-before.png`, `14-too-steep-blocked.png`; Inspector explanation is `15-too-steep-character-setting.png`.
32. Character max slope angle — 20°.
33. Ramp angle — 30°.
34. Too-steep final state — y remained -0.667, onSlope false, wallRight true, grounded only on `steep-floor`.
35. Exported-editor Character v2 controls — PASS: Slope Handling Enabled, Max Slope Angle, Step Handling Enabled, and Max Step Height are all visible in `15-too-steep-character-setting.png`.
36. Exported-editor slope Tile controls — PASS: Slope Triangle, Rising Direction, One-Way Platform, and triangle preview visible in `03...` and persisted in `16...`.
37. Exported-editor Play proof — PASS; actual uphill movement `[-4.8,-0.667,0]` → `[-0.28299999982117746,1.0449002507880552,0]`, grounded/onSlope at 30° in `17-exported-editor-play.png`.
38. Screenshot inspection — PASS. Every retained original and the contact sheet was visually inspected; Characters and relevant surfaces are visible, before/after differences are readable, and no obvious corruption was observed. Pre-fix failure images were also inspected and retained.
39. Page errors — 0.
40. Console errors — 0.
41. Mandatory external requests — 0.
42. Phase 047 focused — 43/43 PASS (40 original plus three legitimate closure regressions).
43. Phase 046 — 44/44 PASS.
44. Phase 045 — 36/36 PASS.
45. Integrated total — 2,077 Phase 011–047 focused checks; `node tests/run-tests.js` exit 0 including stabilization, onboarding, and public-site integration.
46. Public games — 28/28 built; no Game 29.
47. Engine site — PASS; 28/28 examples, path safety and broken-link checks pass.
48. Games site — PASS; 28/28, path safety and broken-link checks pass.
49. Syntax — PASS, 314 repository JavaScript files checked (generated `dist/**` excluded).
50. JSON — PASS, 78 Phase 047 evidence JSON files parsed after closure.
51. Diff — `git diff --check` exit 0; only existing line-ending advisories.
52. Capability — Phase 010 validation 31/31 PASS.
53. Friction — Phase 004 validation 27/27 PASS.
54. Prior 4h endurance retained — retained as historical evidence, but **not applicable to the repaired fingerprint**; no new endurance was started.
55. Prior endurance duration — 14,471,855.0362 ms = 4h01m11.855s, 171 cycles, zero semantic mismatches/crashes, on fingerprint `f2ba...`.
56. Evidence-only block closed? — Yes. The exact visual/authoring evidence gap is closed.
57. Unresolved failures — no known focused, fuzz, browser, export, build, site, syntax, JSON, capability, friction, or visual failure. The unresolved qualification gate is fresh endurance for fingerprint `3cfde...`.
58. Phase 048 untouched — Yes; no moving-platform carry fields, Transform history, support displacement, or parenting work was added.
59. Phase 048 readiness — not promoted while Phase 047 remains blocked on repaired-build endurance qualification.
60. Exact roadmap state — Phase 047 implementation repaired; visual acceptance closed; bounded gates green; repaired fingerprint lacks a qualifying endurance run; Phase 048 remains untouched.

## Defects discovered by real visual acceptance

The pre-fix failures are retained as `failure-before-fix-uphill-blocked.png` and `failure-before-fix-tile-slope-blocked.png`, with structured details in `defect-discovery.json`. The Character stopped at a flush flat-to-slope seam because support candidacy sampled the current-X gap before the finite slope segment and then let the candidate solid reject its own projected motion. The repair evaluates the destination support geometry and excludes only that same candidate solid from its own clearance sweep, while retaining other obstacle clearance and strict flat-step bounds.

The exported Editable then proved save data contained the new slope Tile but full-project load retained the embedded Tileset with the same stable ID. Full-project Tileset loading now resets the project collection before restoring the save; additive bundle-import behavior remains separate.

## Canonical evidence

- Structured runtime evidence: `qualification/phase-047/visual-closure/phase-047-visual-acceptance.json`
- Contact sheet: `qualification/phase-047/visual-closure/contact-sheet.png`
- Exact Editable and Playable: `qualification/phase-047/visual-closure/phase-047-visual-editable.html`, `phase-047-visual-playable.html`
- Original screenshots: `qualification/phase-047/visual-closure/*.png`
- Defect record: `qualification/phase-047/visual-closure/defect-discovery.json`

No Phase 048 implementation, commit, push, or deployment occurred during visual closure.

## Repaired endurance completion addendum

The Stage 2 `PHASE_047_BLOCKED` verdict above was correct when this visual report was issued. It is now superseded by fresh repaired-build endurance run `phase-047-repaired-endurance-20260926T053517Z`, which qualified the exact repaired fingerprint `3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6` for 14,552.9621091 active seconds. The run completed with zero semantic mismatches or errors, and final post-endurance Playable and exported Editable rechecks passed with zero page errors, console errors, or mandatory external requests.

The current overall verdict is **PHASE_047_SLOPES_STEPS_READY**. See `PHASE-047-REPAIRED-ENDURANCE-CLOSURE.md` and `qualification/phase-047/phase-047-repaired-endurance.json` for the qualifying evidence. Phase 048 remains untouched.
