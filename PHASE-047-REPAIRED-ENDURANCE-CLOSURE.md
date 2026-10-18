# Phase 047 repaired-build endurance closure

Exact verdict: **PHASE_047_SLOPES_STEPS_READY**.

The fresh qualifying campaign exercised the repaired product fingerprint continuously for 14,552.9621091 active seconds. This rerun was mandatory because visual acceptance found and repaired two semantic defects after the original endurance run: the flat-to-slope seam could reject its candidate slope's own projected motion, and full-project reload could retain an embedded Tileset instead of restoring the saved authored collection. The older `f2ba...` campaign remains historical evidence only; this closure qualifies `3cfde...` directly.

## Requested final report (1–70)

1. Verdict — `PHASE_047_SLOPES_STEPS_READY`.
2. Repaired run ID — `phase-047-repaired-endurance-20260926T053517Z`.
3. Source fingerprint — `3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6`.
4. Target duration — 14,430 active seconds, above the mandatory 14,400 seconds.
5. Exact active duration — 14,552.962109100008 seconds; start `2026-09-26T05:35:17.648Z`, end `2026-09-26T09:37:56.729Z`.
6. Prior old-build endurance retained — yes; 14,471.8550362 seconds on `f2ba97b8834629ecbed284b11690a25999fe7c0efb9b243e932329591d49b7ff`, historical only and not counted.
7. Flat-to-slope seam transitions — 77,000.
8. Seam failures — 0.
9. Tile slope traversals — 38,500 dedicated Tile transitions; 32,414,074 total slope traversals.
10. One-way slope passes — 19.
11. One-way slope landings — 19.
12. Stair ascents — 3,960,726 bounded step-ups.
13. Stair descents — 6,794,942 bounded step-downs.
14. Too-steep rejects — 5,545,078.
15. Support-state checks — 80,850; 77,000 support changes.
16. Save/reload cycles — 308.
17. Exported Editable save/reload cycles — 77 real isolated browser cycles.
18. Saved slope-Tile persistence checks — 385.
19. Tileset collection count checks — 385; canonical collection remained 2 and key Tile count remained 3.
20. Stable-ID checks — 385; no duplication mismatch.
21. Bundle cycles — 77.
22. Bundle additive checks — 77 during endurance plus a final independent Phase 039 recheck; all passed.
23. Chunk cycles — 77.
24. Browser cycles — 77 isolated cycles.
25. Editable cycles — 77.
26. Playable cycles — 385 scenario executions.
27. Final visual recheck — PASS for uphill, Tile slope, one-way slope, stairs, and too-steep rejection; compact final PNGs retained under `qualification/phase-047/visual-closure/final-*.png`.
28. Final exported-editor reload recheck — PASS; authored Slope / Up Left / One-Way Tile retained its stable ID and metadata after fresh full-project reload, then Play passed.
29. Simulation ticks — 77,080,850.
30. Candidate Tile checks — 49,280,000 during endurance; final 10k audit checked 640,000 sparse candidates for 10,000 queries.
31. 10k-map timing — 837 ms for 10,000 bounded queries over 10,000 cells; no full-map scan.
32. 100-character timing — 17.631 ms aggregate per tick, median 16.531 ms, p95 23.857 ms across 120 ticks on the 10,240-cell fixture; below the practical 50 ms aggregate target.
33. Memory observations — 885.
34. Late-run memory behavior — bounded: first/last 100-observation median RSS 65,005,568 / 71,147,520 bytes and heap 8,744,824 / 9,467,160 bytes; maxima 83,398,656 RSS and 13,715,472 heap; final Tileset count 2, Tile count 3, persistent support-state count 0.
35. Heartbeats — 25, written on the required active-time cadence.
36. Midpoint — recorded at 7,206.426363200005 active seconds on `2026-09-26T07:35:26.691Z`.
37. Three-hour milestone — recorded at 10,809.057409700004 active seconds on `2026-09-26T08:35:31.000Z`.
38. Transient locks — 0.
39. Semantic mismatches — 0; 308 deterministic semantic checksum checks passed.
40. Page errors — 0.
41. Console errors — 0.
42. External requests — 0 mandatory external requests.
43. Crashes — 0 in the qualifying run.
44. Unresolved failures — 0.
45. Phase 047 focused — PASS, 43/43.
46. Phase 046 — PASS, 44/44.
47. Phase 045 — PASS, 36/36.
48. Phase 044 gate — PASS, 15/15 qualification-only utility checks; ordinary Dynamic promotion remains NOT JUSTIFIED.
49. Phase 043 — PASS.
50. Phase 042 — PASS.
51. Phase 041 — PASS.
52. Phase 040 — PASS.
53. Phase 039 — PASS, including final additive Bundle import recheck.
54. Phase 038–031 — every focused suite PASS.
55. Integrated total — PASS, unchanged 2,077-test integrated corpus plus stabilization/public-site checks; exit 0.
56. Public games — PASS, exactly 28/28; four Featured; no Game 29.
57. Engine site — PASS, 28/28 examples, path safety and broken-link checks.
58. Games site — PASS, 28/28 games, path safety and broken-link checks.
59. Onboarding — PASS, Phase 009 37/37 plus editor onboarding stability.
60. Stabilization — PASS, controls 8/8 and collision 100,000 deterministic cases.
61. Syntax — PASS, 276 non-generated repository JavaScript files checked.
62. JSON — PASS, 89 Phase 047 evidence JSON files parsed.
63. Diff — PASS, `git diff --check` exit 0; only existing LF/CRLF advisories.
64. Capability — PASS, Phase 010 31/31.
65. Friction — PASS, Phase 004 27/27.
66. Final source fingerprint — `3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6`, identical at start, one hour, midpoint, three hours, endurance end, and post-gates.
67. Process cleanup — PASS; qualifying runner exited normally, post-gate worker exited, browser/server handles closed, closure-owned orphan count 0.
68. Phase 048 untouched — confirmed; no Phase 048 files changed and no moving-platform carry implementation was added.
69. Phase 048 readiness — Phase 047 now satisfies its promotion gate; Phase 048 may begin only after human/controller review, not in this closure task.
70. Exact roadmap state — Phase 047 repaired implementation, visual acceptance, fresh repaired-build endurance, and post-endurance gates are complete; Phase 048 remains untouched.

## Evidence

- Endurance: `qualification/phase-047/phase-047-repaired-endurance.json`
- Post gates: `qualification/phase-047/phase-047-repaired-post-gates.json`
- Final visual/exported editor: `qualification/phase-047/visual-closure/phase-047-visual-acceptance.json`
- Heartbeat and final state: `qualification/phase-047/repaired-endurance-heartbeat.json`, `qualification/phase-047/repaired-endurance-state.json`
- Historical interrupted/invalid campaign evidence is retained separately and contributes no time to the qualifying result.

No commit, push, deployment, roadmap mutation, or Phase 048 implementation occurred.
