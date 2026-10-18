# Phase 047 — Slopes and steps qualification

Verdict: **PHASE_047_SLOPES_STEPS_READY**. The repaired fingerprint `3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6` completed a fresh 14,552.9621091-second active endurance campaign, all required evidence thresholds, final real visual/exported-editor checks, and 37 post-endurance gates. The earlier 4h01m11.855s endurance remains historical evidence for superseded fingerprint `f2ba97b8834629ecbed284b11690a25999fe7c0efb9b243e932329591d49b7ff` and contributed no time. No Phase 048 work, commit, push, or deployment occurred.

Evidence: `qualification/phase-047/phase-047-endurance.json`, `browser-runtime-campaign.json`, `export-campaign.json`, `phase-047-export-proof.json`, `post-endurance-performance.json`, and the post-endurance isolated site builds. “Verified” below means a direct automated test or browser observation; “authored” means present in the dogfood fixture but not independently traversed in the browser. This distinction matters.

## Baseline (1–8)

1. Verdict — PHASE_047_BLOCKED (visual acceptance evidence outstanding).
2. Run ID — `phase-047-endurance-20260925T025105088Z`.
3. Engine baseline/final — 168,984 raw / 43,457 gzip bytes at both points.
4. Engine raw/gzip delta — 0 / 0 bytes; Phase 047 changes are editor/export-side.
5. Editor package — 1,984 KB baseline to 2,008 KB final, +24 KB.
6. Baseline Character — Phase 045 Kinematic Character movement with sparse Tile query and read-only contact; Phase 046 horizontal one-way tops.
7. Baseline Tiles — Tileset v5 None/Full Cell/Custom Rectangle; sparse v5 Tilemap layers and resolved Tile IDs.
8. Major choices — Character v2 migration, finite transformed Static Box top edges, internal Tile triangles, transient sparse geometry, atomic bounded steps, stable support identity; no global solver replacement.

## Character v2 (9–17)

9. Schema — Character Collision 2D v2.
10. v1 migration — slope and step flags remain off for migrated v1 instances, preserving old behavior.
11. Fresh defaults — slope and step handling enabled; author limits are validated.
12. Slope enable — `slopeHandlingEnabled` controls slope following.
13. Max slope angle — per-Character walkability threshold, shown and editable in exported Inspector.
14. Step enable — `stepHandlingEnabled` controls bounded step-up/down.
15. Max step height — per-Character world-unit limit, shown and editable in exported Inspector.
16. Validation — schema and focused tests reject/clamp invalid authoring values.
17. Inspector/help — exported editor displayed both controls and explanatory help; browser changed angle 50→45 and height 0.5→0.25, toggled slope off/on, then entered and stopped Play.

## Scene slopes (18–29)

18. Top edge — only the authored local horizontal Box top is extracted, preventing steep side-as-ground classification.
19. Normal — upward-facing normal from transformed finite edge.
20. Angle — derived from world-up dot normal.
21. Mirror — full transform includes negative scale; geometry fuzz covers it.
22. Parent — parent transform is included; dogfood has a rotated/scaled parent.
23. Walkable — upward-facing finite support within the Character threshold.
24. Threshold — each Character's max angle is tested independently.
25. Uphill — horizontal request is projected onto accepted support; motion rises along the finite segment.
26. Downhill — bounded probe follows supported descent instead of immediately losing ground.
27. Flat transition — finite-edge contact hands off to flat support.
28. Slope transition — contact/support is reclassified on the next valid finite surface.
29. Steep — remains a solid wall, not a climbable support; focused/fuzz tests pass.

## Tile slopes (30–42)

30. Tileset schema — v6.
31. Migration — v5 collision definitions preserve their semantics.
32. Slope mode — authorable slope collision for a Tile.
33. Up-right — 45° triangular solid Tile.
34. Up-left — mirrored 45° triangular solid Tile.
35. Solid region — triangle narrow phase, not a full-cell rectangle.
36. One-way — only downward top crossings block; upward movement passes.
37. Geometry — ephemeral transformed triangle/edge geometry in Character queries; no creator-facing Triangle Collider.
38. Preview — both diagonals and one-way label visually inspected in Tileset editor after a clipped-label repair.
39. Terrain — uses resolved cell Tile ID.
40. Auto-Tile — uses resolved cell Tile ID.
41. Transform — sparse query handles translated, rotated, and mirrored Tilemaps.
42. Non-square — world geometry derives from independent cell width/height; fuzz tested.

## Contact (43–52)

43. Projection — Character bottom is projected to a support top.
44. Finite rule — projection is clipped to the edge segment; an early plane-overreach defect was fixed before the qualifying run.
45. Probe — short ground probe only, with collision-aware acceptance.
46. `onSlope` — transient read-only contact flag.
47. `groundNormal` — world XY support normal.
48. `slopeAngle` — degrees from world-up; flat contact reports zero.
49. `groundSupportId` — scene ID or stable synthetic Tile cell ID.
50. Flat — retains Phase 045/046 grounded semantics.
51. Cliff — leaving support beyond max step-down becomes airborne.
52. Wall slide — walkable slope contact is excluded from wall-slide classification.

## Steps (53–63)

53. Precondition — grounded Character and blocked horizontal motion.
54. Search — bounded candidate heights through the author maximum.
55. Clearance — swept destination and overhead clearance, including multiple colliders.
56. Commit — step-up is atomic only after full clearance succeeds.
57. Exact limit — included; authored limit remains strict against floating overrun.
58. Too tall — remains blocking.
59. Step-down — follows only a nearby valid lower support.
60. Airborne — no snap to a distant floor.
61. Ascent — repeated small steps are covered by focused tests/fixture.
62. Descent — repeated bounded downs are covered by focused tests/fixture.
63. Mixed — slope and step support handoff is tested.

## One-way (64–71)

64. Rotated scene top — walkable rotated Box top may be one-way.
65. Tile top — one-way slope Tile may support a Character.
66. Upward — pass-through from below.
67. Downward — land when previous bottom crosses accepted finite top.
68. Fast landing — crossing fraction guards high-speed descent.
69. Probe — grounded retention accepts one-way support from above.
70. Too steep — fails to solid blocker, not false one-way ground.
71. Flat regression — Phase 046 focused 44/44 still passes in integrated suite.

## Dogfood (72–97)

72. Project — `qualification/phase-047/phase-047-project.json`; Editable/Playable artifacts generated.
73. Character A/B — authored differing per-Character limits.
74. Migrated Character — authored opt-out; browser observed no slope contact/support ID.
75. 15° ramp — authored; automated geometry/movement tested, not individually screenshot-accepted.
76. 30° ramp — authored and runtime support ID observed.
77. 50° ramp — authored; angle-threshold tests pass.
78. 60° ramp — authored steep case; direct browser screenshot absent.
79. Uphill — deterministic movement test passes; visual traversal not retained.
80. Downhill — deterministic movement test passes; visual traversal not retained.
81. Transitions — deterministic contact test passes; visual traversal not retained.
82. Scene one-way — authored; browser observed airborne→grounded on rotated ramp.
83. Up-right Tile — authored; browser observed grounded 45° support after fixture-position repair.
84. Up-left Tile — authored; browser-booted variant, no standalone traversal image.
85. One-way Tile slope — authored and exported; no standalone traversal image.
86. 0.25 step — authored; browser observed Step Character grounded on quarter-unit ledge.
87. Max step — boundary covered by focused/fuzz tests.
88. Too tall — rejection covered by focused/fuzz tests.
89. Low ceiling — rejection covered by focused/fuzz tests; no browser image.
90. Step down — deterministic tests pass; no browser traversal image.
91. Cliff — deterministic leave-support tests pass.
92. Staircase — authored; no browser traversal image.
93. Mixed slope/step — authored and deterministic tests pass.
94. Trigger — post-motion trigger regression included.
95. 10k map — separate 10,000-cell query and 10,240-cell mixed performance fixtures passed.
96. Negative coordinates — transformed sparse Tile fuzz included.
97. Prefab — project includes prefabs; no independent exported-editor prefab edit/round-trip in final browser campaign.

## Export (98–107)

98. Editable — 2,063,833 bytes, SHA256 `3e7ee8c9779910bb5bab7cad9c43d5ea7387e9a8196560dbd7e3322605ece7d0`.
99. Editable Character — v2 Inspector visible; controls edited and Play/Stop verified in browser; earlier local Save/reload retained 45°.
100. Editable Tile — slope Tile authoring/preview verified in blank editor; exported project showed both slope Tiles; creation inside exported artifact was not repeated.
101. Editable slope movement — same bundled Character runtime; live support on scene/Tile variants observed.
102. Editable step movement — same bundled Character runtime; step support observed, traversal not visually retained.
103. Playable — 2,040,205 bytes, SHA256 `adb052b79e4ddc86b978277ef3995d5817cd05926c52b6e9025ba1da01f8c98e`.
104. Playable semantics — live support probes across exported variants; deterministic solver tests establish movement cases.
105. Bundle — 42 endurance bundle cycles passed; Tile slope metadata retained.
106. Chunk — 42 endurance chunk cycles passed; slope results retained.
107. Errors — 20/20 campaign artifacts booted; 40/40 later runtime probes; zero observed browser probe/console errors; no mandatory external network dependency was introduced.

## Fuzz/performance (108–122)

108. Surface geometry — 500,000 supplemental cases; 85.5m cumulative endurance geometry cases.
109. Triangle overlap — 250,000 supplemental; 42.75m cumulative endurance comparisons.
110. Slope movement — 500,000 supplemental; 85.5m cumulative endurance cases.
111. Steps — 500,000 supplemental; 85.5m cumulative endurance cases.
112. Tile query — 200,000 supplemental; 34.2m cumulative endurance comparisons.
113. Supplemental seeds — geometry `0x4700cafe`, movement `0x47aabbcc`, steps `0x47de57e9`, Tile query `0x47ca11ab`.
114. Frame partitions — independent frame-partition campaign passed before endurance; no regression found.
115. One Character/10,240 mixed cells — median 0.516 ms, p95 2.459 ms over 120 CPU-only ticks (targets <2/<5); 10,000-cell local-query run took 1,091 ms for 10,000 queries.
116. 100 Characters/10,240 mixed cells — mean 19.32 ms, median 18.247 ms, p95 26.555 ms per synthetic tick, under the <50 ms sanity target, not a full-render 60 Hz guarantee.
117. Candidates — 5,880 for one Character/120 ticks, 588,000 for 100; endurance 109.44m.
118. Triangle narrow tests — cumulative 42.75m endurance comparisons; exact per-tick mixed-map triangle subcount not instrumented separately.
119. Step attempts — 85.5m endurance step *cases*; attempt events not separately counted.
120. Successful steps — supplemental step fuzz observed 51,438 ascents and 88,246 descents; endurance event subcounts not separately instrumented.
121. Rejected steps — supplemental fuzz observed 82,403 ceilings; total tall-step rejects not separately instrumented.
122. Memory — 1,365 endurance samples, zero process failures; mixed-map single heap 8.1→19.4 MB and hundred 19.3→21.0 MB (GC/noise, not leak slope).

## Endurance (123–147)

123. Target — 14,400,000 ms qualified active time.
124. Actual — 14,471,855.0362 ms = 4h01m11.855s, excluding pause time.
125. Heartbeats — 171 completed cycles; 1,365 memory observations.
126. Midpoint — 2026-09-25 05:05:39.418 UTC.
127. Three-hour milestone — 2026-09-25 06:05:15.273 UTC.
128. Simulation ticks — 171,000 in-process ramp moves/grounded ticks, plus independent cycle workloads; no single all-simulations tick sum recorded.
129. Slope traversals — 171,000 in-process ramp moves; 85.5m slope movement cases.
130. One-way events — 42 trigger runs; distinct one-way contact event total not separately counted.
131. Step-ups — step suite ran 171 cycles; distinct endurance step-up event total not separately counted.
132. Step-downs — same; distinct event total not separately counted.
133. Tall rejects — tested in focused/step cases; distinct endurance reject count not recorded.
134. Ceiling rejects — tested in focused/step cases; distinct endurance reject count not recorded.
135. Support changes — focused/runtime tests pass; aggregate change count not recorded.
136. Save/load — earlier browser local Save/reload verified; no distinct endurance Save/load count.
137. Bundles — 42.
138. Chunks — 42.
139. Browser — endurance runner counter 0; separate post-run final-qualification browser campaign recorded 40 isolated runtime cycles. Do not conflate them.
140. Editable — 10 compositions, 20 runtime cycles in final browser campaign.
141. Playable — 10 compositions, 20 runtime cycles in final browser campaign.
142. Memory — 1,365 observations.
143. Source fingerprint — start, midpoint, finish all `f2ba97b8834629ecbed284b11690a25999fe7c0efb9b243e932329591d49b7ff`.
144. Semantic mismatches — 0 during qualifying run.
145. Crashes — 0.
146. Unresolved run failures — 0; earlier fixture/solver issues were repaired before fresh run.
147. Process cleanup — runner completed at 2026-09-25 07:06:09.796 UTC; no duplicate endurance process started.

## Regression (148–176)

148. Phase 047 focused — 40/40 at endurance qualification; 43/43 after three legitimate visual-closure regressions.
149. Phase 011–047 — 2,074 at original qualification; 2,077 after closure regressions, all passed in the integrated run.
150. Integrated — `node tests/run-tests.js` exit 0 after repaired-build closure; no failure total.
151. Phase 046 — 44/44 baseline focused, integrated pass after Phase 047.
152. Phase 045 — integrated pass.
153. Phase 044 — legacy gate preserved; Dynamic promotion remains rejected.
154. Phase 043 — integrated pass.
155. Phase 042 — integrated pass.
156. Phase 041 — integrated pass.
157. Phase 040 — integrated pass.
158. Phase 039 — integrated pass.
159. Phase 038 — integrated pass.
160. Phase 037 — integrated pass.
161. Phase 036 — integrated pass.
162. Phase 035 — integrated pass.
163. Phase 034 — integrated pass.
164. Phase 033 — integrated pass.
165. Phase 032 — integrated pass.
166. Phase 031 — integrated pass.
167. Stabilization — included in integrated suite; pass.
168. Onboarding — included in integrated suite; pass.
169. Public games — 28/28 in post-endurance and repaired-build closure builds; four Featured; no Game 29.
170. Engine site — repaired-build package and path/link checks pass with 28/28 examples.
171. Games site — repaired-build package and path/link checks pass with 28/28 games.
172. Syntax — `node --check` passed on 314 repository JS files after closure (generated `dist/**` excluded).
173. JSON — 78 Phase 047 evidence JSON files parsed after closure.
174. Diff — `git diff --check` exit 0; existing line-ending advisories are not whitespace errors.
175. Capability dashboard — Phase 010 dashboard checks included, 31/31.
176. Friction registry — Phase 004 authoring-friction checks included in integrated pass.

## Roadmap (177–188)

177. Tilemaps — sparse 10k-class collision query and resolved Tile slope authoring verified; no world streaming claim.
178. Sprites/2D — hybrid Sprite/Tilemap workflow remains operational in exported editor/builds.
179. Physics — robust Kinematic Character slope/step evidence; ordinary Dynamic Body remains out of scope/rejected at Phase 044.
180. Friction — the five-case visual and exported-editor Tile-authoring gaps are closed; the repaired fingerprint now requires qualification before promotion.
181. Phase 048 — stable `groundSupportId`/normal seam for future moving-platform carry; no carry implemented.
182. Phase 049 — filtering seam documented, not implemented.
183. Phase 050 — debug seam documented, not implemented.
184. Controller — future input/jump/gravity layer should consume read-only Character contact and request Kinematic motion.
185. Limits — only Static Box tops and 45° up-right/up-left Tile triangles are walkable slopes; no arbitrary polygons, Circle slopes, curves, Dynamic, filters, or full-frame 100-Character guarantee.
186. Phase 048 readiness — engineering seam exists, but formal promotion is blocked because the repaired Phase 047 fingerprint has not completed endurance qualification.
187. Next action — obtain explicit direction before any new endurance run; do not implement Phase 048 while Phase 047 remains blocked.
188. Roadmap state — Phase 047 visual acceptance and bounded gates pass on the repaired build; prior endurance belongs to the superseded fingerprint. Phase 048 untouched.

## Visual Acceptance Closure

The initial block was evidence-only: the five requested exported-runtime traversal images and fresh exported-editor slope Tile authoring proof did not exist. Closure run `phase-047-visual-closure-20260925T111844718Z` captured all five cases at 1440×900 in isolated Edge `153.0.4234.32` contexts with zero page errors, zero console errors, and zero mandatory external requests. The exact artifacts were Editable 2,065,661 bytes / SHA-256 `c7a938532a14595af29ac74230e3696de5e61998d6231bd02c6c3eabff9d6234` and Playable 2,042,033 bytes / SHA-256 `c012c6eca795a8f300ea9dfaa5407bba4bf07142e2bc32c017c449b4625fa69c`.

Uphill, actual Tile slope, one-way slope pass/land, four-step ascent/descent, and 20°-limit versus 30°-ramp rejection all pass with retained before/after state and screenshots. The exported Editable visibly authored a Slope / Up Left / One-Way Tile, saved it, reloaded it with stable identity, exposed all Character v2 slope/step controls, and performed an actual uphill Play traversal. Every retained PNG and the contact sheet was visually inspected.

This real acceptance also found two genuine defects that automated qualification had missed. Pre-fix screenshots are retained. The shared Character solver now handles flush flat-to-slope entry using destination support geometry without letting a candidate reject its own projection, and full-project load now replaces the embedded Tileset before restoring saved authoring. Three legitimate closure regressions bring Phase 047 focused checks to 43/43. Phase 046 is 44/44, Phase 045 is 36/36, integrated checks pass, 28/28 public games and both sites build, syntax/JSON/diff/capability/friction gates pass.

Because those semantic product changes moved the fingerprint from the endurance-qualified `f2ba...` to stable closure fingerprint `3cfde...`, the original endurance is not directly applicable. The visual evidence block is closed, but repaired-build endurance qualification is outstanding. Full details and requested fields 1–60 are in `PHASE-047-VISUAL-ACCEPTANCE-CLOSURE.md`; structured evidence is in `qualification/phase-047/visual-closure/phase-047-visual-acceptance.json`.

Exact verdict at the end of Stage 2: **PHASE_047_BLOCKED**. This historical statement is superseded by Stage 3 below.

## Three-stage qualification history

### Stage 1 — original engineering and endurance

The original engineering campaign and 14,471.8550362-second endurance run completed on fingerprint `f2ba97b8834629ecbed284b11690a25999fe7c0efb9b243e932329591d49b7ff`. Phase 047 remained blocked because the required real exported-runtime visual evidence was missing.

### Stage 2 — visual closure, defect discovery, and repairs

Real Playable and Editable acceptance closed the evidence gap but discovered two genuine product defects: flush flat-to-slope entry could be rejected by the candidate slope's own projected solid, and full-project reload could retain the embedded Tileset instead of the saved authored collection. Both were repaired. That semantic change produced fingerprint `3cfde...`, superseding the original endurance for promotion purposes.

### Stage 3 — fresh repaired-build endurance and final closure

Run `phase-047-repaired-endurance-20260926T053517Z` completed 14,552.9621091 active seconds on the exact repaired fingerprint, with 77,000 flat-to-slope transitions, 308 model save/reloads, 77 real exported Editable reloads, 77 Bundle and Chunk cycles, 77 isolated browser cycles, 885 memory observations, zero semantic mismatches, and zero errors. Final visual/exported-editor acceptance passed all scenarios. Phase 047 through Phase 031 focused gates, the integrated suite, builds, exactly 28 public games, both sites, onboarding, stabilization, syntax, JSON, diff, capability, friction, final Bundle additivity, and performance checks all passed. Full details are in `PHASE-047-REPAIRED-ENDURANCE-CLOSURE.md` and `qualification/phase-047/phase-047-repaired-post-gates.json`.

Final exact verdict: **PHASE_047_SLOPES_STEPS_READY**.
