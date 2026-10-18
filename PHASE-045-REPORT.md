# Phase 045 — Character Collision 2D report

Verdict: `PHASE_045_CHARACTER_COLLISION_WALL_SLIDE_READY`. This report follows the requested 141-field order.

1. Verdict: `PHASE_045_CHARACTER_COLLISION_WALL_SLIDE_READY`.
2. Baseline/final engine: 168,984 raw / 43,457 gzip bytes and 22 sources at both points.
3. Raw/gzip delta: 0 / 0 bytes; editor/export runtime owns this bounded addition.
4. Editor package delta: 1,956 KB → 1,971 KB, +15 KB.
5. Character architecture: first-class v1 component plus Phase 043 Body manager path and direct Tile query module.
6. Phase 043 reuse: X→Y conservative Kinematic mover, shape separation, swept AABB, hit IDs, parent-world translation.
7. Schema/version: singleton `character-collision-2d` v1.
8. Enabled: authored Boolean, default true; disabled state is inactive.
9. Wall Slide Enabled: authored Boolean, default true.
10. Wall Slide Max Speed: positive finite world units/second, default 3.
11. Kinematic requirement: enabled Kinematic Body 2D; missing/Static Body produces warning and no Character path.
12. Collider requirement: enabled ordinary Box/Circle; Trigger alone is not a shape.
13. Validation: malformed fields rejected and dependency warnings remain non-destructive.
14. Add Component: Character search finds one Physics / 2D component; second add is denied.
15. Inspector/help: fields, world-down explanation, dependency readiness, and removal appear in editor.
16. Tilemap schema change: v4→v5.
17. Layer collision flag: `collisionEnabled`, default true.
18. Migration: historical Layers missing flag normalize to true.
19. Full Cell: normalized rectangle covers entire cell.
20. Custom Rectangle: Phase 034 normalized rectangle determines physical quad.
21. None: no physical candidate.
22. Terrain: current resolved `cell.tileId` remains physics authority.
23. Auto-Tile: current resolved `cell.tileId` remains physics authority.
24. Hidden Layer: may collide while invisible.
25. Locked Layer: may collide while authoring-locked.
26. Disabled collision Layer: cells render/save but are omitted from Character physics.
27. Negative coordinates: sparse key and stable ID preserved.
28. Rotated Tilemap: inverse broad bounds and transformed world quad used.
29. Scaled Tilemap: nonuniform and mirrored scale tested.
30. Non-square cells: widths/heights remain independent in collision rectangles.
31. No per-cell Body objects: direct ephemeral geometry only.
32. Candidate query architecture: one conservative candidate set per Character move serves X, Y, and probes.
33. World→Tilemap local broad bounds: four corners inverse transformed after transformed-cell-footprint inflation.
34. Sparse-index usage: `ensureTilemapCellIndex(...).byKey` O(1) coordinate lookup.
35. Candidate coordinate count: 49 for one warmed 10,240-cell benchmark Character tick.
36. Collision-bearing cell count: 2 in that single-Character tick.
37. Deterministic Tile hit IDs: `tile:<map>:<layer>:<x>:<y>`.
38. Query fuzz: 100,000 comparisons / 20 seeds equal brute-force world-AABB reference.
39. 10k-map timing: conservative contended warmed one-Character median 0.702 ms, p95 1.135 ms; uncontended replay 0.321/0.668 ms.
40. 100-character timing: conservative contended aggregate median 16.614 ms, p95 29.955 ms; uncontended replay 9.447/15.492 ms.
41. Probe architecture: four read-only world-axis shifts around final ordinary Collider shapes.
42. Probe-distance rule: `min(1e-6 + 1e-4, max(2e-6, 0.1*minimum world AABB extent))`.
43. Grounded: tiny down shift would overlap eligible obstacle.
44. Ceiling: tiny up shift would overlap eligible obstacle.
45. Wall Left: tiny left shift would overlap eligible obstacle.
46. Wall Right: tiny right shift would overlap eligible obstacle.
47. Persistent contact: zero-velocity floor/wall/ceiling and narrow-passage tests pass.
48. State reset: Play start/Stop/level switch/removal/deletion clear; disabled state queries inactive immediately.
49. Runtime query: `getCharacterCollision2DState(objectId)` returns frozen copy.
50. Activation conditions: enabled valid Character, wall slide enabled, downward request beyond max, side contact, not grounded.
51. World-down convention: negative world Y.
52. Max-speed clamp: requested Y displacement limited to `-maxSpeed*dt`.
53. Existing-wall contact: pre-movement probe enables clamp without X request.
54. Same-tick wall impact: X resolution precedes Y clamp decision.
55. Leave-wall behavior: final state clears sliding; full downward request resumes next tick.
56. Grounded behavior: grounded + wall does not slide.
57. Upward behavior: no clamp.
58. Disabled behavior: no clamp.
59. Body velocity retention: authored `linearVelocity` is unchanged.
60. Frame-rate proof: 0.1-second single tick and 10 × 0.01-second wall-slide partitions agree.
61. Dogfood project: internal `qualification/phase-045/phase-045-dogfood.json`, ten objects, 10,240-cell scale map, zero validation issues.
62. Static floor: included as a Body/Box Collider fixture.
63. Static wall: wall impact and wall-slide browser/focused tests pass.
64. Ceiling: Static fixture and world-up contact test pass.
65. Wall slide: real browser state reports `wallRight` and `wallSliding`.
66. Leave wall: focused final-probe and next-tick speed tests pass.
67. Tilemap floor: hidden/locked Layer grounds Character in browser and exports.
68. Custom rectangle: bounded normalized shape is tested and included in dogfood.
69. Tilemap wall: high-speed Tile wall anti-tunneling focused test passes.
70. Disabled collision Layer: omitted by query; dogfood contains one.
71. Hidden Layer: still collides in browser and focused test.
72. Negative coordinates: focused query ID and dogfood Layers include them.
73. Rotated Tilemap: focused query and expanded dogfood map cover transformed quads.
74. 10k-map dogfood: extended project loads 10,240 populated cells as one Tilemap in browser; Character remains grounded with 7 Body obstacle candidates in the sampled tick.
75. Combined Static/Tilemap: same Character service enumerates both obstacle sources.
76. Trigger behavior: behind-wall Trigger suppressed; wall-slide Trigger may enter after movement.
77. Parented Character: browser fixture confirms +0.1 world-X movement converts through rotated/scaled parent to a mixed local-XY delta.
78. Prefab: shared deep-copy component record path exercised by focused test and internal dogfood Prefab.
79. Editable bytes: 2,022,009; executed in a standalone local browser origin.
80. Exported Character authoring: v1 component fields and Inspector retained.
81. Exported Tilemap Layer flag: v5 serialized flag retained.
82. Exported collision behavior: Editable standalone grounded against Tilemap floor.
83. Playable bytes: 1,998,382; executed in a standalone local browser origin.
84. Playable Character behavior: standalone runtime grounded against Tilemap floor.
85. Bundle Layer flag: checksummed round-trip preserved `[true,false]`, 2,090-byte bundle.
86. Page/console/network errors: zero across final 20-cycle browser campaign and standalone export checks.
87. Focused count: 36 passing.
88. Phase 011–045 total: 1,990 checks (prior 1,954 + Phase 045 36).
89. Integrated total: 2,352 checks (prior 2,316 + Phase 045 36); runner exits 0.
90. Character fuzz operations: 500,000 invariant-checked moves.
91. Seeds: 20 fixed deterministic seeds.
92. Tile query fuzz comparisons: 100,000 versus brute-force reference, zero mismatch after broad-phase repair.
93. Frame-rate tests: wall-slide partition and inherited Phase 043 movement tests pass.
94. Browser cycles: 20 isolated cycles pass final fixture, including save/reload, Stop restoration, parent movement, and one-Undo Layer toggle.
95. Soak duration: 1,800,042 ms, a bounded 30-minute active run on exact final product code.
96. Character moves: 162,850 active simulation ticks/moves.
97. Grounded ticks: 40,713.
98. Wall ticks: 20,356.
99. Wall-slide ticks: 20,356.
100. Tile candidates inspected: 6,106,878 coordinate slots; 81,426 actual Tile collision shapes.
101. Static candidates: 366,414; blocked X/Y counts 0 / 40,713.
102. Narrow tests: 122,138; Trigger events recorded to a 1,000-event cap.
103. Memory: post-GC heap 5,969,216 → 10,569,624 bytes across 30 minutes; separate 30-second post-GC sample 5,230,544 → 6,108,576 bytes. Candidate storage is transient; no persistent cell-object expansion observed.
104. Unresolved failures: none in focused, fuzz, query-reference, browser, build, or soak gates.
105. Phase 044 gate: prior `NOT_JUSTIFIED` decision unchanged and integrated suite passes.
106. Phase 043: prior Static/Kinematic regression suite passes.
107. Phase 042: Trigger lifecycle suite passes.
108. Phase 041: Collider geometry suite passes.
109. Phase 040: 10k Tilemap performance suite passes.
110. Phase 039: portable Tilemap bundle suite passes.
111. Phase 038: Chunk suite passes.
112. Phase 037: Spawn Marker suite passes.
113. Phase 036: Terrain suite passes.
114. Phase 035: Auto-Tile suite passes.
115. Phase 034: Tile collision metadata suite passes with evolved Layer-policy assertions.
116. Phase 033: multilayer suite passes with v5 Layer assertions.
117. Phase 032: Tilemap Paint/Erase suite passes with v5 assertions.
118. Phase 031: Tileset/Palette suite passes.
119. Stabilization: control/collision stabilization suites pass.
120. Onboarding: editor onboarding stability suite passes.
121. Games: 28/28 public games build; no Game 29.
122. Engine site: package/path/link checks pass; editor package 1,971 KB.
123. Games site: 28/28 package/path/link checks pass.
124. Syntax: changed JS passes `node --check`.
125. JSON: Phase 045 project and generated dogfood JSON parse and validate; dogfood issues 0.
126. Diff: `git diff --check` exits 0; Windows LF→CRLF advisories only.
127. Capability: Colliders remain B, with Character Tilemap response and contact state; Body v1 remains Static/Kinematic.
128. Friction: AFR-0001, AFR-0002, and AFR-0026 now record the scoped improvement; Layer collision participation is visible in Layer Inspector with one Undo and concise help.
129. Tilemaps grade: A, last improved in Phase 045; physical Tile metadata serves eligible Characters, not general Body physics.
130. Sprites / 2D grade: B unchanged; Sprite objects may author Character Collision with ordinary Collider/Body.
131. Physics evidence: 500k moves, 100k Tile queries, 10,240-cell benchmark, browser and soak qualification.
132. Genuine friction: parented/rotated world-axis contacts are physically conservative but not slope/carry semantics.
133. Phase 046 seam: one-way top-plane and downward-motion filtering documented only.
134. Phase 047 seam: slope normals, step height, and ground continuity documented only.
135. Phase 048 seam: support identity/platform displacement interaction documented only.
136. Phase 049 seam: Static/Tile obstacle filtering extension documented only.
137. Later Controller seam: future input/jump/gravity should request Kinematic movement and query Character state.
138. Remaining limitations: no input, gravity, jump, one-way, slope/step, carry, masks, collision events, or global overlay.
139. Phase 046 readiness: Phase 045 gates complete; no Phase 046 product code started.
140. Recommended next phase: Phase 046 one-way platform work may begin as a separate scoped phase.
141. Exact roadmap state: Phase 045 READY; Phase 046 untouched; no deploy, DNS, commit, or push.
