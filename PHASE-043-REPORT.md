# Phase 043 — Static/Kinematic Body 2D qualification report

Verdict: **PHASE_043_STATIC_KINEMATIC_BODIES_READY**. The 30-minute active soak, isolated browser campaign, deterministic fuzz, focused/integrated regression, public builds, and package checks pass. Paths below are relative to the repository root. The list mirrors the required 129 reporting fields.

1. Verdict: `PHASE_043_STATIC_KINEMATIC_BODIES_READY`.
2. Baseline/final engine: 168,984 raw / 43,457 gzip bytes at both baseline and final build; 22 engine sources.
3. Raw/gzip delta: 0 / 0 bytes; Phase 043 runs in the editor/export runtime.
4. Editor package delta: 1,938 KB baseline to 1,956 KB final, +18 KB.
5. Body architecture: pure `editor/src/00-body-2d.js` manager, authored component in schema, no engine-core dependency.
6. Update-loop integration: hierarchy update, Body movement, then Trigger lifecycle.
7. Schema/version: singleton `body-2d`, version 1.
8. Enabled: disabled Body is inert.
9. Body Type: `static` or `kinematic` only.
10. Static semantics: immovable solver obstacle only when paired with enabled ordinary Collider 2D.
11. Kinematic semantics: velocity-driven mover; responds to Static Body geometry.
12. Linear velocity: finite two-component world-XY vector in units/second.
13. World-space policy: integrate velocity with clamped tick delta.
14. Parent conversion: inverse parent rotation and scale map world delta to local Transform.
15. Validation: shape/type/velocity and singular-parent checks in authoring schema.
16. No-collider warning: warning, not authoring rejection; no-Collider Kinematic moves freely.
17. Type-switch behavior: Static velocity is retained in data but ignored until Kinematic again.
18. Physical pair eligibility: enabled Kinematic ordinary Collider versus enabled Static Body ordinary Collider.
19. Static shape resolution: Phase 041 Box/Circle shapes cached once each tick.
20. Kinematic shape resolution: each enabled ordinary Collider on moving Body participates.
21. Multi-collider policy: all valid shapes participate; self pairs excluded.
22. X/Y axis order: resolve X first, then Y for deterministic generic sliding.
23. Broad swept AABB: reject obstacles outside the full axis sweep.
24. Anti-tunneling algorithm: conservative advancement against the shape separation function.
25. Search/substep bounds: finite bounded sweep iterations and contact search.
26. Epsilon: small contact offset prevents numerical penetration or sticking.
27. Move result: requested/actual delta, blocked-axis flags, hit IDs, initial-overlap flag.
28. Hit-ID ordering: deterministic object-ID order, deduplicated.
29. Initial-overlap policy: conservative; no automatic teleport depenetration.
30. Direct-Transform teleport policy: authored/manual Play edits are respected; next tick resolves motion conservatively.
31. Straight wall proof: browser and focused test show X stop at wall.
32. Slide proof: blocked X retains clear Y travel.
33. Corner proof: focused geometry coverage; no qualified post-motion penetration.
34. Rotated wall: SAT/separation tests and dogfood rotated Static wall.
35. Box/Box: covered in focused tests and seeded fuzz.
36. Box/Circle: covered in focused tests and seeded fuzz.
37. Circle/Box: covered in focused tests and seeded fuzz.
38. Circle/Circle: covered in focused tests and seeded fuzz.
39. Thin-wall proof: over 100,000 fuzz thin-wall cases.
40. Large-delta proof: high-speed movement checked at capped delta.
41. Frame-rate proof: 30/60/120/144/240 partition checks in qualification.
42. Static immobility: Static authored Transform unchanged by solver.
43. Velocity retention: blocked requested velocity persists.
44. Kinematic/Kinematic policy: no response, no obstruction.
45. Collider-without-Body policy: ordinary Collider alone is not a Static obstacle.
46. Tick ordering: Body manager runs before Trigger manager.
47. Enter after movement: qualified in browser and focused tests.
48. Blocked-before-Trigger: wall prevents overlap and event.
49. Pass-through Trigger: detection never blocks Body motion.
50. Trigger velocity mutation: callback changes apply to next Body tick.
51. Phase 042 regression: 73/73 focused checks pass, plus 500,000 trigger-transition fuzz cases.
52. Dogfood project: `phase-043-dogfood.json`, internal-only scene.
53. Static wall: present and qualified.
54. Rotated Static: present and qualified.
55. Static circle: present and qualified.
56. Kinematic box: present and qualified.
57. Kinematic circle: present and qualified.
58. Dual-collider Body: present and qualified.
59. No-collider Bodies: Static and Kinematic examples present.
60. Diagonal slide: blocked axis plus free axis qualified.
61. High-speed test: thin-wall anti-tunneling qualified.
62. 30/60/120/144/240 result: partition checks are in focused/fuzz evidence.
63. Parented Kinematic: browser checks world-X displacement under rotated/scaled and mirrored parents.
64. Singular-parent fallback: browser checks zero actual displacement, no invalid Transform.
65. Play/Stop restore: browser checks authored position restored.
66. Prefab: Body component captured/instanced and round-tripped.
67. Editable bytes: 2,008,698 in browser export proof.
68. Exported authoring: Editable Body Inspector and save/reload qualified.
69. Exported movement: Editable Body tick qualified.
70. Exported blocking: Editable wall block and slide qualified.
71. Playable bytes: 1,985,071 in browser export proof.
72. Playable movement: Playable Body tick qualified.
73. Playable blocking: Playable wall block qualified.
74. Trigger lifecycle: Enter/Stay and blocked-before-region browser checks pass.
75. Page/console/network errors: 20 isolated cycles report none.
76. Phase 043 focused count: 24/24.
77. Phase 011–043 total: 1,939 passing checks.
78. Integrated total: 2,301 passing checks.
79. Movement fuzz operations: 500,607, zero failures.
80. Seeds: 20 fixed seeds.
81. Frame-partition fuzz: 517 cases.
82. Anti-tunneling fuzz: 100,207 thin-wall cases.
83. Body/Trigger fuzz: 1,000 checks.
84. Performance fixture: 0×1000, 1×1000, 10×1000, 50×500 Body/Static configurations pass; medians 0.194, 9.112, 13.812, and 8.924 ms under active soak load.
85. Browser cycles: 20/20 isolated cycles pass.
86. Soak duration: 30.0034 active minutes, with 10/20/30-minute heartbeats.
87. Simulation ticks: 1,361,600; 6,788,822 Kinematic moves.
88. Blocked-X count: 979,606.
89. Blocked-Y count: 2,723,000.
90. Candidate pairs: 30,384,882.
91. Broad rejects: 26,682,216.
92. Narrow tests: 3,702,666; 2,939,938 conservative sweep steps and 20 fail-closed capped sweeps.
93. Memory: 1,361 samples; late-window low-water marks stayed about 11–12 MB, peak 42.77 MB plateaued in the final ten minutes, and Stop ended at 13.89 MB. No persistent growth or retained contact registry observed.
94. Unresolved failures: zero; 15 Save/reloads, 10 Play restarts, 20 Prefab cycles, six Editable and six Playable builds; no page, console, or network errors.
95. Phase 042: 73/73, plus transition fuzz pass.
96. Phase 041: focused regression and 500,000 geometry / 250,000 transform fuzz pass.
97. Phase 040: focused regression passes.
98. Phase 039: focused regression passes.
99. Phase 038: focused regression passes.
100. Phase 037: focused regression passes.
101. Phase 036: focused regression passes.
102. Phase 035: focused regression passes.
103. Phase 034: focused regression passes.
104. Phase 033: focused regression passes.
105. Phase 032: focused regression passes.
106. Phase 031: focused regression passes.
107. Gameplay stabilization: control and collision suites pass.
108. Onboarding: registry, recovery and 10,000 transitions pass.
109. Games: 28/28 public builds pass, with no Game 29.
110. Engine-site: package builds with path/link checks; 28 game links resolve.
111. Games-site: 28/28 public games, path/link checks pass.
112. Syntax: 14 touched JavaScript files pass `node --check`.
113. JSON: eight Phase 043/catalog evidence JSON files parse.
114. Diff: `git diff --check` exits 0; existing Windows LF/CRLF notices only.
115. Capability: colliders grade B; Body semantics and limits updated.
116. Friction: AFR-0025 updated and AFR-0026 added for real v1 limitations.
117. Tilemaps grade: A, unchanged; Phase 043 does not consume Tile collision.
118. Sprites / 2D grade: B, unchanged; Body adds physics role without regrading sprite authoring.
119. Physics evidence: focused tests, 500,607-case fuzz, 20-cycle browser campaign, performance fixtures, and completed 30-minute active soak.
120. Genuine friction: no Dynamic/character/contact/filtering/Tilemap physics; Kinematic/Kinematic pass-through.
121. Tilemap seam: `TILE-COLLISION-TO-2D-BODY-SEAM.md` documents future integration.
122. Phase 044 Dynamic utility seam: `PHASE-044-DYNAMIC-BODY-UTILITY-SEAM.md` only; not implemented.
123. Phase 045 character seam: `PHASE-045-CHARACTER-COLLISION-SEAM.md` only; not implemented.
124. Phase 048 carry seam: `PHASE-048-MOVING-PLATFORM-CARRY-SEAM.md` only; not implemented.
125. Phase 049 filtering seam: existing `PHASE-049-COLLISION-FILTERING-SEAM.md` remains future work.
126. Remaining limits: Static/Kinematic only, no gravity/forces/mass/friction/restitution or collision-event lifecycle.
127. Phase 044 readiness: Phase 043 qualification gate passes; no Phase 044 implementation started.
128. Recommended next phase: Phase 044 Dynamic Body utility, as a separate scoped phase.
129. Exact roadmap state: Phase 043 ready, Phase 044 untouched, 28-game public catalog unchanged, no deploy/commit/push.
