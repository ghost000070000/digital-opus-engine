# Phase 044 — Dynamic Body utility gate report

Verdict: **PHASE_044_DYNAMIC_BODY_NOT_JUSTIFIED**. The utility gate completed successfully and rejected premature product promotion. `UTILITY_GATE_DECISION: NOT_JUSTIFIED` was recorded before any canonical Body schema edit. This is not `PHASE_044_BLOCKED`. The list below mirrors the required 100 final-response fields.

1. Final verdict: `PHASE_044_DYNAMIC_BODY_NOT_JUSTIFIED`.
2. Utility gate decision: `NOT_JUSTIFIED`, recorded in `PHASE-044-DYNAMIC-BODY-UTILITY-GATE.md` before product promotion.
3. Baseline/final engine: 168,984 raw / 43,457 gzip bytes, 22 sources, unchanged.
4. Product runtime delta: 0 bytes and no Dynamic path.
5. Editor delta: 1,956 KB package before and after; no Dynamic UI.
6. Body version final: v1, Static/Kinematic only.
7. Prototype semantics: analytic world-XY acceleration, mutable runtime velocity, Static-only response, blocked-axis velocity zeroing.
8. Tested creator workflows: drop/rest, ballistic arc, Trigger hazard drop, horizontal gravity, zero gravity, diagonal floor slide.
9. Materially useful distinct workflows: two—drop/rest and ballistic arc; variants do not satisfy the required third.
10. Understandability: a “Dynamic Body” label would overpromise movable-body and Tilemap physical behavior.
11. Dynamic/Dynamic limitation: bodies pass through each other; unacceptable as an ordinary Dynamic expectation.
12. Dynamic/Kinematic limitation: no response, push, or carry; moving platforms remain nonphysical to Dynamic.
13. Tilemap-physics absence: objects fall through Tilemap collision metadata, a material 2D-world limitation.
14. Complexity: narrow mechanics are small, but a credible Dynamic product promise would require broader response semantics and documentation; no general solver was built.
15. Rationale: mechanical prototype passes, but the three-workflow value and product-clarity gates do not; promotion is deferred.
16. Integration equation: `delta = v*dt + 0.5*g*dt²`; `vNext = v + g*dt`.
17. Gravity policy: qualification-only per-body world-XY vector, default candidate `[0,-9.81]`, no product field.
18. Runtime velocity: mutable prototype copy initialized from authored-like `linearVelocity`; product Kinematic velocity unchanged.
19. Blocked-axis velocity: zero only the blocked X/Y component; retain tangential component.
20. Static response: reused Phase 043 conservative Static collision service through a qualification adapter.
21. Frame partition free fall: analytic ten-second position/velocity match at 30/60/120/144/240 Hz.
22. Frame partition floor contact: all five rates rest at equivalent legal pose within collision tolerance.
23. Resting contact: Box/Circle stable for 60 simulated seconds; 2,000 bodies / 240,000 rest ticks, zero rest caps.
24. Rotated Static: no penetration in focused cases and seeded shape fuzz.
25. Thin wall: 100,235 seeded high-speed thin-wall cases, no illegal final penetration.
26. Large delta: canonical 0.1-second clamp and high-speed thin-floor test pass.
27. Parent Transform: 1,000 rotated/scaled/mirrored world-motion conversions pass in qualification model.
28. Singular fallback: rejected translation leaves finite Transform and zeros unbounded velocity accumulation.
29. Trigger ordering: 1,000 fuzz checks and 20 browser cycles confirm post-movement detection.
30. Capped sweeps: 6,065 high-speed/grazing fuzz caps across all shape pairs, safe fail-closed final states; zero recurring resting caps. Phase 043's 20 historical hits lack per-event traces.
31. Body v2 migration: NOT IMPLEMENTED — utility gate rejected promotion.
32. Dynamic schema: NOT IMPLEMENTED — utility gate rejected promotion.
33. Dynamic Inspector: NOT IMPLEMENTED — utility gate rejected promotion.
34. Gravity fields: NOT IMPLEMENTED — utility gate rejected promotion.
35. Product help/limitations: NOT IMPLEMENTED — utility gate rejected promotion; gate documentation states limitations clearly.
36. Dynamic Save/Load: NOT IMPLEMENTED — utility gate rejected promotion.
37. Dynamic Prefab: NOT IMPLEMENTED — utility gate rejected promotion.
38. Dynamic Editable export: NOT IMPLEMENTED — utility gate rejected promotion.
39. Dynamic Playable export: NOT IMPLEMENTED — utility gate rejected promotion.
40. Dynamic Play/Stop product restoration: NOT IMPLEMENTED — utility gate rejected promotion; prototype browser cycles verified existing v1 restoration.
41. Falling Box: qualification prototype falls and rests on Static floor.
42. Falling Circle: qualification prototype falls and rests on Static floor.
43. Ballistic: initial XY velocity plus downward gravity follows analytic arc.
44. Falling Trigger hazard: browser prototype fires Enter/Stay/Exit before floor rest.
45. Horizontal gravity: `[9.81,0]` drives Circle into Static wall without bounce.
46. Zero gravity: initial velocity persists until collision.
47. Floor rest: 60-second focused rest and 240,000 rest-fuzz ticks pass.
48. Thin floor: high-speed movement cannot tunnel at clamped delta.
49. Dynamic/Dynamic: no response; qualification objects can overlap/pass through.
50. Dynamic/Kinematic: no response; qualification limitation explicitly evaluated.
51. Tilemap limitation: passive Tilemap metadata does not obstruct; this weighs against utility.
52. Movement fuzz operations: 500,595 deterministic cases.
53. Seeds: 20 fixed seeds.
54. Rest fuzz: 2,000 bodies / 240,000 ticks; zero rest-cap hits.
55. Partition fuzz: 1,000 equal-elapsed-time floor comparisons.
56. Thin-wall fuzz: 100,235 cases.
57. Body/Trigger fuzz: 1,000 final-position checks.
58. Capped-sweep count: 6,065 (Box/Box 926, Box/Circle 1,108, Circle/Box 1,896, Circle/Circle 2,135).
59. Recurring rest-cap count: 0.
60. 1×1,000 timing: 0.647 ms median.
61. 10×1,000 timing: 3.723 ms median.
62. 50×500 timing: 7.384 ms median, below 50 ms target.
63. 100-resting timing: 4.662 ms median, zero caps.
64. Soak duration: not run; utility/clarity rejection preceded conditional 30–60-minute Dynamic soak.
65. Memory: no long-soak trend claimed; 20 isolated browser contexts closed with zero page/console/network errors.
66. Unresolved failures: none in tested prototype invariants; 6,065 conservative cap events and product expectation gaps remain disclosed.
67. Phase 044 focused: 15/15 gate checks pass.
68. Phase 011–044 total: 1,954 checks pass.
69. Integrated total: 2,316 checks pass.
70. Phase 043: 24/24 focused and 500,607-case Kinematic fuzz pass.
71. Phase 042: 73/73 focused and 500,000-transition Trigger fuzz pass.
72. Phase 041: focused regression plus 500,000 geometry / 250,000 transform fuzz pass.
73. Phase 040: 10k Tilemap regression passes in integrated chain.
74. Phase 039: bundle regression passes in integrated chain.
75. Phase 038: chunk regression passes.
76. Phase 037: grid/spawn regression passes.
77. Phase 036: Terrain brush regression passes.
78. Phase 035: Auto-Tiling regression passes.
79. Phase 034: Tile collision metadata regression passes.
80. Phase 033: multi-layer Tilemap regression passes.
81. Phase 032: Tilemap paint/erase regression passes.
82. Phase 031: Tileset/Palette regression passes.
83. Stabilization: controls and collision suites pass.
84. Onboarding: registry/recovery and 10,000 transition checks pass.
85. Public games: 28/28 builds, no Game 29.
86. Engine-site: builds with path/link checks; editor package 1,956 KB.
87. Games-site: 28/28 public games and link/path checks pass.
88. Syntax: six touched/new JavaScript files pass `node --check`.
89. JSON: seven Phase 044/catalog evidence files parse.
90. Diff: `git diff --check` exits 0; no whitespace error.
91. Capability: catalog validates, Colliders remains B with explicit Dynamic deferral evidence.
92. Friction: registry validates; AFR-0026 records movable-body, Tilemap, expectation, gravity and cap limitations.
93. Tilemaps grade: A, unchanged; no Tilemap physics consumption.
94. Sprites / 2D grade: B, unchanged.
95. Physics evidence: narrow prototype is numerically stable and performant, but not product-promoted.
96. Dynamic utility conclusion: only two distinct substantial workflows; Dynamic label would mislead ordinary creators.
97. Remaining limits: no Dynamic, gravity, mass, force, impulse, friction, restitution, movable-body response, Tilemap physics, or character controller in product.
98. Phase 045 readiness: independent Kinematic/Collider foundation remains ready; Phase 044 rejection does not block it.
99. Recommended next phase: Phase 045 Character collision as a separate task, not implemented here.
100. Exact roadmap state: Phase 041–043 qualified; Phase 044 utility gate completed as NOT_JUSTIFIED; Phase 045–050 planned; no commit, push, deployment, DNS change, or Game 29.
