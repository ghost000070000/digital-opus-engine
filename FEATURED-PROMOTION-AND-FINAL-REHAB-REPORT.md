# Featured Promotion and Final Rehabilitation Report

Verdict: `FEATURED_PROMOTION_READY_FOR_HUMAN_REVIEW`

Date: 2026-09-08  
Scope: local pre-release review only; no deployment, DNS work, production ZIP, or Wave 10 work.

## Outcome

The catalog remains exactly 28 games. Four games genuinely clear the current Featured gate, 22 are public Samples, and two remain Internal. Automated tests were used for mechanics, packaging, visibility and evidence integrity; scores below rendered human-visible evidence and were not mechanically awarded.

Featured: Arsenal Run, Power Grid, Forest Range, Moving Temple.

Samples: Foglight, Signal Relay, Silent Sector, Relic Frontier, Relic Island, Iron Arena, Dungeon Descent, The Sanctum Key, Power Station, Relic Runner 2, Sentinel Maze, Signal Zero, Survival Arena 2, Survival Arena 3, Textured Adventure, Valley Run, Painted Wilds, Assembly Line, Blacksite, Shifting Facility, Skyway Trial, Temple Switch Puzzle.

Internal: Opus Arena, Survival Arena.

Human review: [public-showcase-review-v2/index.html](public-showcase-review-v2/index.html). The page places the seven primary candidates' baseline and current standalone frames side by side. Catalog-referenced public screenshot coverage is 34 real PNGs: three different captures for each of four Featured games and one for each of 22 Samples. SHA-256 source/destination records are in `public-showcase-review/screenshot-provenance.json` and the focused v2 copy.

## Candidate re-score

| Candidate | Before V/C/L/A/P/U | Current V/C/L/A/P/U | Result |
|---|---:|---:|---|
| Foglight | 3/4/3/3/4/3 | 3/4/4/4/4/4 | Sample — stronger layered vale, beacon courts, sanctuary, lighting and audio; the opening arch and compact objective route keep visual quality at 3. |
| Signal Relay | 3/4/3/3/4/3 | 3/4/4/4/4/3 | Sample — coherent facility thresholds, machinery, computers, storage, weapon framing and relay audio; dark repeated bays remain visible. |
| Arsenal Run | 3/4/3/3/4/3 | 4/4/4/4/4/3 | Featured — central reactor, three readable combat lanes, barricades, utilities, distinct weapon silhouettes and action-focused audio/lighting. |
| Silent Sector | 3/4/3/3/3/3 | 3/4/4/4/4/3 | Sample — stealth zones, alternate spatial reads, machinery and restrained audio improve identity; intentionally dark sparse areas do not consistently reach V4. |
| Power Grid | 3/4/3/3/3/3 | 4/4/4/4/4/4 | Featured — dense differentiated machine spaces, conduits, coolant stations, power-flow accents and offline/online sound identity. |
| Moving Temple | 3/4/3/3/3/4 | 4/4/4/3/4/4 | Featured — strong vertical silhouettes, depth, stairs, summit sanctuary, wind and warm focal lighting frame the moving-platform mechanics. |
| Forest Range | 3/4/3/3/3/4 | 4/4/4/3/4/4 | Featured — camera corridors, layered vegetation, landmark trees/rocks, ruin waypoints and a warm lookout create a distinctive readable route. |

## Gameplay evidence

- Arsenal Run: native keyboard/mouse route defeated all three guards and reached extraction at about 32.6 simulation seconds with 52 HP. A separate normal no-defense trial produced `You Went Down` at about 17.1 seconds. Pause and Restart passed with no console errors. Evidence: `rehabilitation-evidence/combat-playtest/arsenal-run-normal/`.
- Power Grid: native input carried the cell, activated the generator and coolant sequence, crossed the powered gate and won at 21.61 simulation seconds; Restart passed. Evidence: `rehabilitation-evidence/playthroughs/power-grid/playtest.json`.
- Moving Temple: native input crossed the slab, boarded and rode the lift, reached the summit, won at about 21.5 simulation seconds and restarted. Evidence: `rehabilitation-evidence/traversal-play/moving-temple/play.json`.
- Forest Range: normal native movement completed the grove route and reached the lookout. Evidence: `rehabilitation-evidence/sample-play/forest-range/play.json`. Its design has no authored normal-loss outcome; Pause is covered by the all-game standalone smoke.
- Foglight, Signal Relay and Silent Sector retained working native wins and Restarts after their composition pass. Their current evidence lives under `rehabilitation-evidence/playthroughs/` and `rehabilitation-evidence/combat-playtest/`.

Featured normal-win coverage is 4/4. Featured normal-loss coverage is 1/1 where an authored loss applies (Arsenal Run); Power Grid, Moving Temple and Forest Range do not define ordinary loss endings. Restart coverage is 4/4, using the recorded routes plus standalone restart checks. Pause and no-console-error coverage is 4/4 through targeted routes and final smoke. All four are self-contained standalone exports.

## Original asset expansion

`tools/showcase-assets.js` now generates 63 original meshes, 27 procedural PNG textures and 24 WAV clips (18,536 mesh triangles and 3,398,078 audio bytes). This pass added 27 meshes, 21 textures and 8 audio clips.

Mesh additions include three ruin-wall forms, pointed and broken arches, stairs, walkway, grand sanctuary, brazier, dead tree, stump, cliff spire, rope fence, corner wall, doorway, ceiling beam, railing, support, large machine, vent, conduit, computer bank, storage rack, blast door, modeled sidearm, barricade, ammo crate and a stylized hovercraft. The additions use deliberate code-generated silhouettes rather than resized-cube asset claims.

Texture additions cover fantasy grass/path/moss/clean/worn/dark stone, bark, foliage and relic emissive surfaces; facility clean/worn metal, panels, dark wall, machinery, terminal, grate and emissive strips; and differentiated arena floor/wall/cover/weapon surfaces. Existing hazard material remains part of the shared bank.

Audio additions are guardian call, relay pulse, combat rifle, stealth bed, offline machinery, online machinery, temple wind and forest bed. Featured ambience is not one identical loop reused everywhere: Arsenal is combat-forward, Power Grid has offline/online machinery, Moving Temple uses wind/stone atmosphere, and Forest Range has woodland ambience.

All assets are deterministic Digital Opus originals governed by the existing provenance/license record; no unknown-license downloads were introduced. Asset dependencies are trimmed per game so the full bank is not redundantly embedded in every standalone.

## Bounded hovercraft adapter

The adapter was implemented because three projects shared the same concrete product gap and the change remained small. `currentPlayerSettings.visual` now accepts an authored static or skinned mesh for Hovercraft. The original controller entity and seven craft parts continue driving physics and motion but become invisible while the authored mesh follows the authoritative transform, scale, rotation and position offset. With no valid authored visual, the primitive fallback remains unchanged; no migration or duplicated controller physics is required.

Runtime evidence for all three arenas records `visual: true`, authoritative body hidden, all seven fallback part render flags false, and zero errors. Survival Arena 2 and 3 completed normally with the adapter. This was a bounded rehabilitation fix, not Wave 10.

## Five Internal outcomes

| Project | Outcome |
|---|---|
| Opus Arena | Remains Internal. Cover, lighting and health tuning landed, but normal play still reached only 3/8 kills before loss; the goal was not weakened. Normal loss and Restart remain valid. |
| Survival Arena | Remains Internal. Relic-court composition and authored hovercraft visual landed, but the bounded native route reached only 3/4 orbs with one life remaining. |
| Survival Arena 2 | Graduated to Sample. Tidal/storm identity, authored hovercraft visual, 32.15-second native timed win with 90 HP, and Restart are verified. |
| Survival Arena 3 | Graduated to Sample. Transmitter-defense identity, authored hovercraft visual, 20.32-second native timed win with 100 HP, and Restart are verified. |
| Valley Run | Graduated to Sample. Cliff/arch landmarks and a visible sanctuary goal landed; native traversal reached the checkpoint and far ridge, won at 7.54 simulation seconds, and restarted. The guardian loss graph is authored, but this final route does not independently claim a guardian-caused loss. |

Evidence: `rehabilitation-evidence/featured-promotion/internal-play/` and the Opus Arena combat playtest records.

## Build, regression and performance

Baseline before this pass was clean: engine bundle 154,324 bytes (40,085 gzip), 31/31 API tests, 12/12 showcase tests, 1/1 public integration test, and 28/28 game builds. The baseline public set was 23 Samples and five Internal.

Final validation runs the same five required commands plus the 28-game standalone smoke. The final engine bundle remains 154,324 bytes (40,085 gzip). The standalone set is 97.0 MiB total. The public games-site package is 101.7 MiB. The Engine site is 163.4 MiB, including its 1,191 KiB editor and 162.2 MiB of embedded public examples. Featured HTML sizes are Arsenal Run 3.60 MiB, Power Grid 4.35 MiB, Forest Range 4.43 MiB and Moving Temple 3.96 MiB. Both public sites include 26 games and exclude both Internal games.

Public qualification checks cover role/visibility consistency, title identity, fixture-asset leakage, asset provenance, real screenshot dimensions/checksums, Featured screenshot uniqueness, public link resolution and absence of Internal entries. Final smoke loads Start, gameplay and Pause for every one of the 28 standalone files.

## Bugs and authoring friction

The material product bug was the Hovercraft controller's lack of an authored visual path; the adapter fixes it without disturbing physics. Final regression also caught a test harness dependency omitted when `setPlayerFallbackVisible` was introduced, and repeated execution exposed duplicated How To Play suffixes in the promotion script. Both were repaired at source and the content generator is now idempotent.

Authoring friction remains: standalone asset embedding makes file sizes sensitive to unused dependencies; rich procedural kit creation is code-heavy; level composition still requires manual transforms rather than prefab/instancing ergonomics; normal-input browser play routes require game-specific steering; and static hovercraft visuals do not yet support wheel/thruster sub-animation. These are observations, not a request to start another capability wave.

## Remaining visual weaknesses and release posture

Foglight's first view is arch-heavy and its gameplay remains shorter than the requested flagship ambition. Signal Relay remains dark and somewhat repetitive. Silent Sector's low-key stealth spaces are intentionally sparse. Arsenal Run is compact and would benefit from deeper enemy animation. Forest Range can still produce occasional close foliage camera views. The two Internal games retain concrete completion blockers.

A release ZIP may now be considered only after the user completes human visual review of the v2 page and accepts the four Featured judgments. This pass intentionally did not create one. `games.digitalopusadsolutions.com` was untouched, no deployment or DNS action occurred, and Wave 10 remains exactly: **not started**.
