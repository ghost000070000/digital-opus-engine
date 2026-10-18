# Gameplay Feel Hardening Report

1. **Executive summary.** The all-28 controls, collision, and pacing pass is complete. The release-packaging recommendation remains deferred only to the required human feel-review checkpoint; the engineering candidate is ready for that review.
2. **Scope completed.** All 28 public games were rebuilt and replayed from fresh standalone contexts with native keyboard/mouse input and read-only telemetry.
3. **Baseline.** Before edits, `build/build.js`, `tests/run-tests.js`, and `build/build-games.js` passed; the catalog contained 28/28 playable standalones.
4. **Dirty-worktree policy.** Existing `.claude/`, `build/build-live-local-preview.js`, `live-local-preview/`, and the pre-existing catalog change were preserved. No reset, clean, commit, push, ZIP, deployment, DNS, Game 29, or Wave 10 work occurred.
5. **Reproduced mouse defect.** The shared look function subtracted both browser deltas. In the engine quaternion convention this made mouse-right look left and mouse-up look down.
6. **Mouse horizontal fix.** Positive horizontal mouse delta now increases yaw, so mouse-right turns the view right.
7. **Mouse vertical fix.** Negative browser Y delta now decreases pitch, so mouse-up looks up with inversion disabled.
8. **Invert Mouse Y.** A shared Boolean preference reverses only the vertical response and defaults to OFF.
9. **Mouse Sensitivity.** A shared persistent preference defaults to `0.0018` radians per pixel and is bounded in the UI from `0.0006` to `0.0040`.
10. **Authored sensitivity compatibility.** Per-project first-person sensitivity remains a relative authoring multiplier against the established `0.0022` baseline; legitimate title-specific overrides are not discarded.
11. **Pitch clamp.** Pitch remains clamped to `+-1.5` radians (about 86 degrees). Extreme repeated-input regression coverage confirms it cannot flip.
12. **Orientation ownership.** Mouse, touch, and right-stick look still converge on one `applyFirstPersonLook` path; entity aim, camera target, hitscan, and rendered view remain aligned.
13. **Settings placement.** Mouse Sensitivity and Invert Mouse Y are present on both the Main Menu and Pause Menu settings rows.
14. **Settings persistence.** Both preferences use the engine `SettingsManager`/localStorage namespace and synchronize across the two menus.
15. **Pointer Lock acquisition.** First-person play requests lock and an ordinary canvas click reacquires it after browser Escape/unlock.
16. **Pointer Lock release.** Pause, end state, and first-person despawn release lock immediately.
17. **Pointer Lock resume.** Resume attempts reacquisition inside the Resume gesture; the canvas gesture remains the browser-safe fallback.
18. **Pointer Lock evidence.** All 8 first-person standalones passed release/reacquire checks in the native-input matrix; win/lose modal Restart also passed.
19. **Default mappings.** WASD, arrows, Space, interact, attack, reload, switch weapon, crouch, sprint, and inventory still route through the existing action system.
20. **Rebinding.** Player overrides remain separate from author defaults, persist through settings, and have a new regression proving save/reload survival.
21. **Gamepad/touch.** Existing gamepad simulated-key routing and touch controls were retained. Their first-person look path inherits corrected axes, pitch clamp, and invert-Y behavior.
22. **Controller inventory.** The library contains 8 first-person, 16 third-person, 1 top-down, and 3 hovercraft games.
23. **First-person movement.** Authored base speeds span 5.5–6.5 units/second; no cross-title outlier required a project-data rewrite.
24. **Third-person movement.** Authored base speeds span 6–6.5 units/second. Skyway Trial keeps its deliberate 60 acceleration for precise platform response while retaining the same 6.5 speed cap.
25. **Top-down movement.** Dungeon Descent remains at 6 speed / 24 acceleration and passed cardinal-input replay.
26. **Hovercraft root cause.** The runtime previously ignored authored hovercraft `moveSpeed` and `acceleration`, using fixed 16/24 speed caps and fixed acceleration.
27. **Hovercraft correction.** Hovercraft now reads its authored settings. The shared default is 11 speed / 10 acceleration with a 17 boost cap; Survival Arena's authored 6 speed / 28 acceleration is now honored.
28. **Hovercraft steering.** Steering rate, tap impulse, drag, boost impulse, boost acceleration, and boost cap are configurable through the same player-settings object.
29. **Movement replay.** 27 games showed forward-aligned W displacement. Forest Range's W route was immediately blocked by authored geometry while alternate directions moved correctly; it is recorded as collision-blocked, not direction-reversed.
30. **Full input replay.** Every game received W, S, A, D plus applicable Space/interact/attack/reload input; first-person games additionally received real locked mouse deltas and menu-setting interaction.
31. **Collision architecture.** `entity.solid` remains the collision master switch; explicit box/sphere collider data remains independent from visible mesh data.
32. **Box collision.** Destination overlap resolution is unchanged for normal speeds and continues to remove only inward velocity.
33. **Sphere collision.** Destination overlap resolution is unchanged and uses combined radii in XZ.
34. **Rotated colliders.** Oriented boxes continue resolving in collider-local space, so the physical footprint follows actual yaw rather than an axis-aligned proxy.
35. **High-speed box tunneling.** A new segment sweep expands an oriented box by mover radius and finds the earliest XZ contact when a whole-frame move crosses a thin wall.
36. **High-speed sphere tunneling.** A new segment-versus-expanded-circle sweep closes the equivalent gap for sphere colliders.
37. **Wall sliding.** Sweeps remove the inward normal component but preserve tangent velocity. A regression verifies a fast diagonal impact stops at the wall and continues sliding.
38. **Corner stability.** The pre-existing nearest-edge/corner overlap solver remains the fallback for embedded or ordinary overlap cases; no oscillatory correction appeared in the 28-game replay.
39. **Thin platforms.** Existing vertical travel-scaled landing tolerance continues to catch a 40-unit/second fall across a 0.3-unit platform at `dt=0.15`.
40. **Floors and terrain.** Terrain collision, grounded correction, steep-slope response, and map bounds remain active. Replay waits for spawn/terrain settling before attributing movement to input.
41. **Ramps.** A new regression confirms midpoint slope landing, grounding, vertical-velocity cancellation, and preservation of horizontal velocity.
42. **Steps/stairs.** A new regression verifies a grounded mover steps onto a 0.4-unit rise and cancels downward velocity.
43. **Crouch clearance.** A new regression verifies feet remain planted and a low ceiling prevents standing-body expansion.
44. **Moving platforms.** A new regression verifies XZ carry follows platform delta while vertical box snap remains authoritative.
45. **Visible-model alignment.** Runtime inspection covered 277 active solid colliders across the catalog with zero residual player overlaps after the input routes.
46. **Decorative props.** Non-solid landmarks remain intentionally pass-through; they were not bulk-converted into invisible blockers.
47. **Spawn safety.** No game began in a residual solid overlap after settling. Cinematic player freezes were allowed to complete before movement measurement.
48. **Boundary safety.** Authored rectangular play bounds preserve Y velocity, while legacy radial map-boundary warning/correction remains regression-covered.
49. **Enemy speed audit.** Observed AI movement values span 0.8–4 units/second, below the corresponding player base speeds; no enemy-speed spike required mutation.
50. **Contact-damage audit.** Repeating contact hazards/enemies use explicit cooldowns. Enemy contacts are generally 3–10 per 0.8–1.8 seconds; the larger 15–30 values belong to authored lava/void/hazard surfaces rather than ordinary enemy touch.
51. **Combat timing.** Existing weapon/projectile speeds and authored damage were retained because real-input sessions produced no instant unavoidable first-contact loss or reaction-window failure.
52. **Per-title record.** `GAMEPLAY-FEEL-TEST-MATRIX.md` contains one row per game with controller, movement, camera/look, Pointer Lock, solid-collider observation, tuning values, result, and notes.
53. **Automated regression result.** `tests/run-tests.js` passes 33/33 engine tests, 15/15 showcase-quality tests, and 1/1 public-site integration test.
54. **Native gameplay result.** `tools/audit-gameplay-feel.js` passes 28/28 built standalones with zero page errors and zero residual solid overlap.
55. **Focused wall result.** Signal Relay's real keyboard/mouse wall route stops at the west wall, moves away normally, keeps the first-person body hidden, and keeps the weapon visible.
56. **Build and site result.** Engine bundle, 28/28 standalone build, engine site, games site, path-safety checks, and broken-link checks pass. Five presentation surfaces report no broken images, HTTP errors, internal-game leaks, or desktop/mobile overflow.
57. **Limitations and residual risk.** Automated sessions validate directions, response, representative opening routes, pause/settings lifecycle, and collision invariants; they do not replace subjective human evaluation of comfort over long sessions or a full win-condition playthrough of every title. Gamepad and touch retain the corrected shared paths but were not exercised with physical hardware in this pass.
58. **Prior checkpoint.** The broad hardening pass advanced to the requested final human-feel cleanup.

## Human-Feel Cleanup

1. **Forest Range root cause.** The opening spawn sat immediately below a steep terrain lip, while the original validator measured key holds in wall-clock time. Under two heavyweight concurrent standalones, some nominal 700 ms presses contained too few simulation frames and produced the misleading `W blocked` record.
2. **Forest Range correction.** Only the authored spawn moved, from `[-8, -0.36273782170077007, -6]` to `[-7, 0.01926061005623662, -5.5]`, placing the ranger directly on the visible route. The existing 60-degree yaw, terrain, props, colliders, route, and shared collision rules were retained.
3. **Forest Range result.** A fresh-start native W run advances `4.81` units with a positive `3.81` forward dot. Three repeated focused openings also pass, and the path comes within `0.30` units of the intentionally non-solid waypoint before continuing through it.
4. **Audit reliability correction.** `tools/audit-gameplay-feel.js` now holds native keys for measured simulation time (or until the game ends), preventing render-load artifacts from being reported as controller failures. No gameplay state is injected.
5. **Representative FPS result.** Arsenal Run, Signal Relay, and Power Grid pass native mouse/keyboard replay. Mouse right/left and up/down have standard signs; the slow sample is `0.0144` radians, the large turn is `2.9376` radians (about 168 degrees), and repeated extreme input clamps at `+-1.5` radians. WASD, diagonal movement, sprint, jump, attack, reload, interact, pause/resume, Pointer Lock release, and reacquisition pass. Signal Relay deliberately stops at the west wall and then moves away cleanly; Power Grid completes its authored objective route.
6. **Invert/settings result.** Fresh defaults are sensitivity `0.0018` and Invert Mouse Y OFF. A Pause-menu change to `0.0019` and invert ON persists after reload and appears on the Main Menu; the same downward mouse input changes from `+0.108` pitch to `-0.114`, proving only the vertical sign flips.
7. **Third-person result.** Foglight completes its authored route. Forest Range's opening, reverse, strafe, jump, terrain, and decorative pass-through checks pass. Moving Temple's camera-forward agreement, jump traversal, solid surfaces, and animated crossing platform pass; the platform moved from X `5.624` to `6.558` during observed play. No shared third-person tuning changed.
8. **Hovercraft result.** Survival Arena honors its authored `6/28` speed/acceleration profile, reaches its `6` speed cap, turns `0.649` radians, brakes to `1.649`, reverses with a negative forward dot, and reaches `15.874` during boost before the intentionally solid north landmark stops it. Survival Arena 2 uses the shared `11/10` profile, turns `0.437` radians, brakes to `0.126`, reverses, and reaches `12.637` under boost. Both remain inside authored bounds with camera/vehicle alignment intact; the legacy `16/24` hardcoding was not restored.
9. **Skyway Trial result.** The deliberate `60` acceleration remains. Native input ramps from `3.882` to `6.320`, releases to `1.790`, and traverses the five-platform line to Z `27.256`, Y `5.55`. It is responsive without requiring title-specific retuning.
10. **Opus Arena result.** A normal native-input combat run reaches all eight kills and `Courtyard cleared` in `29.21` simulation seconds with `113/180` health remaining. Win presentation and Restart both pass with zero browser errors.
11. **Collision intention result.** Signal Relay's visible west wall and Survival Arena's north landmark block as intended; tangent/return movement remains available. Forest Range's visible waypoint/decorative route marker remains pass-through. These are player-intention checks, not collider-count claims.
12. **Controls copy result.** Representative start/help copy accurately names mouse look, WASD/arrows, jump/boost, attack, reload, switch, sprint/crouch, interact, and Escape pause where applicable. No additional settings or control labels were introduced.
13. **Final verification.** `node build/build.js`, `node tests/run-tests.js`, `node build/build-games.js`, `node build/build-engine-site.js`, and `node build/build-games-site.js` all pass. Automated coverage is 33/33 engine, 15/15 showcase-quality, and 1/1 public-site integration; the final simulation-timed gameplay audit passes 28/28 standalones with zero page errors and zero residual solid overlaps.
14. **Scope boundary.** No global collision weakening, broad speed retune, visual redesign, Wave 10 work, deployment, release ZIP, or production packaging was performed.
15. **Final verdict.** `GAMEPLAY_FEEL_CANDIDATE_READY_FOR_HUMAN_HANDS`
