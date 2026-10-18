# Phase 046 — One-Way Platform 2D report

Final qualification passed. This report has the requested 138 numbered fields. The exact-final 30-minute active soak was performed against unchanged product source after the browser, fuzz, query, and full regression gates.

1. Verdict: `PHASE_046_ONE_WAY_PLATFORMS_READY`.
2. Engine baseline/final: 168,984 raw / 43,457 gzip bytes; 22 sources.
3. Engine delta: 0 raw / 0 gzip bytes.
4. Editor package: 1,971 → 1,984 KB (+13 KB).
5. Character integration: Character-only top support before existing solid Y resolution.
6. Phase 045 reuse: Static/Tile provider, accepted X, contact state, solid X→Y response.
7. Component: singleton one-way-platform-2d v1.
8. Enabled: Boolean true by default; false reverts to solid.
9. Static requirement: enabled Static Body; otherwise warning/inactive.
10. Box requirement: valid enabled Box Collider; Circle alone is insufficient.
11. Invisible platform: render alpha zero remains physical.
12. Inspector: readiness, warnings, Enabled, help, removal.
13. Add Component: Physics / 2D search and singleton guard.
14. Orientation: world transform of local +Y Box edge.
15. Unsupported fallback: rotated/invalid is ordinary solid.
16. Tileset: v5 (from v4).
17. Metadata: Tile.collision.oneWay Boolean.
18. Migration: missing historical field becomes false.
19. Default: false.
20. None: canonical oneWay false.
21. Palette: direct toggle.
22. Preview: badge and selected top-edge affordance.
23. Full Cell: transformed cell top.
24. Custom Rectangle: transformed maxY.
25. Terrain: resolved Tile identity controls oneWay.
26. Auto-Tile: resolved Tile identity controls oneWay.
27. Layer flag: collisionEnabled independent of visibility/locking.
28. Previous position: support bottom before move drives crossing.
29. Character support: lowest ordinary Collider bottom; Circle center-minus-radius.
30. Platform top: Box local +Y or Tile collision top.
31. Eligibility: downward crossing and overlap at crossing fraction.
32. Upward: passes.
33. Horizontal: passes side.
34. Underside: no ceiling.
35. Downward: Y capped at top.
36. High speed: analytic swept crossing.
37. Diagonal land: accepted X locates crossing footprint.
38. Diagonal miss: no overlap, no landing.
39. Nearest: earliest crossing fraction.
40. Tie: stable obstacle ID.
41. Support tolerance: 0.000101 world units.
42. Grounded: top contributes.
43. Ceiling: top does not contribute.
44. Wall: one-way sides do not contribute.
45. Wall slide: one-way alone does not contribute.
46. Persistence: zero-Y remains grounded on top.
47. Leave edge: grounded clears.
48. Solid combination: neighboring solid wall retains contact.
49. Velocity: authored Body velocity retained.
50. Dogfood: phase-046-project.json and extended sibling in qualification/phase-046.
51. Scene platform: Static+Box+One-Way.
52. Invisible: alpha-zero platform.
53. Full Tile: authored oneWay.
54. Custom Tile: authored oneWay.
55. Upward pass: focused/browser verified.
56. Downward land: focused/browser verified.
57. High-speed land: focused/fuzz verified.
58. Zero-Y stand: focused/browser verified.
59. Walk across: focused/browser verified.
60. Walk off: focused/browser verified.
61. Diagonal land: focused/fuzz verified.
62. Diagonal miss: focused/fuzz verified.
63. Stacked: nearest top and stable tie verified.
64. Solid wall: adjacent contact verified.
65. Trigger: detects after upward pass.
66. Disabled Layer: omits support.
67. Hidden Layer: still supports when collision enabled.
68. Terrain: resolved Tile supports.
69. Auto-Tile: resolved Tile supports.
70. Negative coords: fixture and test.
71. Rotated fallback: scene/Tilemap warning and solid response.
72. Prefab: component round-trip.
73. Save/reload: browser and JSON round-trip.
74. Editable: 2,036,340 bytes.
75. Editable authoring: component retained.
76. Editable Tile metadata: oneWay retained.
77. Editable pass-up: standalone verified.
78. Editable landing: standalone verified.
79. Playable: 2,012,713 bytes.
80. Playable semantics: standalone Tile landing verified.
81. Bundle: 2,633 bytes; SHA-256 7400bfcdf2433b3736fc3588c00c5c6682e906afd6b948c77a38f23feda2e0ed.
82. Browser errors: zero page/console/network.
83. Focused: 44 passed.
84. Phase 011–046 aggregate: 2,034 passed (Phase 045 baseline 1,990 + 44).
85. Integrated: 2,396 passed (Phase 045 baseline 2,352 + 44).
86. Fuzz: 500,000 operations passed.
87. Seeds: 20 fixed.
88. Query: 100,000 transformed Tile comparisons passed.
89. Frame rates: 30/60/120/144/240 Hz and high-speed partition pass.
90. Browser: 20 isolated cycles passed.
91. Soak duration: 1,800,099 ms (30m 0.099s), 161,030 active ticks.
92. Upward passes: 48,309 soak; 249,564 fuzz.
93. Landings: 64,412 soak; 23,121 fuzz.
94. Grounded ticks: 96,618.
95. Edge departures: 16,103.
96. Tile candidates: 20,209,265 coordinate slots and 32,206 collision shapes during soak; 49 slots for one Character and 4,900 for 100 on the 10,240-cell benchmark.
97. Platform candidates: 128,824 scene-shape resolutions during soak; 100-scene-platform benchmark passes.
98. High-speed crossings: 16,103 soak cases; focused/fuzz pass.
99. Solid fallback: 16,103 rotated-scene solid collisions; rotated Tilemap focused test passes.
100. Memory: GC heap 5,261,896 → 6,360,152 bytes (+1,098,256 / 20.87%); bounded at 6.36 MB after 161,030 ticks, with no persistent contact registry.
101. Unresolved failures: none; soak assertions, browser errors, tests, and qualification gates all pass.
102. Phase 045: pass.
103. Phase 044: pass.
104. Phase 043: pass.
105. Phase 042: pass.
106. Phase 041: pass.
107. Phase 040: pass.
108. Phase 039: pass.
109. Phase 038: pass.
110. Phase 037: pass.
111. Phase 036: pass.
112. Phase 035: pass.
113. Phase 034: pass.
114. Phase 033: pass.
115. Phase 032: pass.
116. Phase 031: pass.
117. Stabilization: game control/collision suites pass.
118. Onboarding: stability suite passes.
119. Games: 28/28 packaged.
120. Engine-site: path and 28+8 link checks pass; editor 1,984 KB.
121. Games-site: 28/28 and path/link checks pass.
122. Syntax: 16 JS files pass.
123. JSON: 10 Phase 046/catalog files parse, including soak proof.
124. Diff: git diff --check exits zero; only line-ending warnings.
125. Capability: 57 rows, A6/B32/C18/D0/N/A1; check passes.
126. Friction: 26 records, 21 open canonical; check passes.
127. Tilemaps grade: A, retained.
128. Sprites / 2D grade: B, retained.
129. Physics evidence: Character-only Static/Tile support, no Dynamic promotion.
130. Genuine friction: AFR-0001/0026 remain for controller/general physics.
131. Phase 047 seam: slopes/steps documented, not implemented.
132. Phase 048 seam: moving carry documented, not implemented.
133. Phase 049 seam: filtering remains deferred.
134. Drop-through seam: future temporary ignore documented, not implemented.
135. Limits: horizontal-only; Box-only scene; Character-only; no input/gravity/jump/carry/filtering/Dynamic/events.
136. Phase 047 readiness: top-edge/contact boundary documented; no Phase 047 code.
137. Recommended next phase: Phase 047 after this gate closes.
138. Exact roadmap state: Phase 046 ready; Phase 047 implementation untouched.
