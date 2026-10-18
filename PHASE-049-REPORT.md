# Phase 049 — Collision Layers and Masks

Verdict: `PHASE_049_COLLISION_LAYERS_MASKS_READY`.

See `PHASE-049-CHARACTERIZATION.md` for verified work and remaining gates, and `COLLISION-LAYERS-MASKS-CONTRACT.md` for architecture and user-facing semantics.

Baseline and final independent engine bundle: 168,984 raw / 43,457 gzip bytes / 22 files; raw/gzip delta **0 / 0 bytes**. The editor/runtime composition embeds the new filtering module. Final post-soak editor package: 2,054 KB versus 2,025 KB baseline (+29 KB rounded). Frozen source fingerprint: `28ab7aa8acef6654042756d02e613aa542b89fa2f66feea0921e6c16da1422b0`. Exactly 28 public games remain in scope; the Filtering Lab is internal.

## Implemented acceptance surface

Project registry: maximum 32 including immutable, undeletable Default. Stable IDs survive Add, explicit Rename, Reorder, and confirmed Delete. Primary references require an explicit surviving replacement; deleted mask memberships are removed; current scene, off-scene levels, and Prefabs participate in one Undo transaction. Separate primary/mask usage counts refresh after Undo and Load.

Geometry owns policy: Box/Circle/Trigger v2 and each Tilemap v6 Layer. Historical schemas migrate to Default / All. Named Inspector Layer selection, All/Custom, searchable membership checkboxes, Select All/Clear All, defaults, and missing-reference validation are present. All includes future layers; empty Custom rejects everything; invalid primary identities fail closed. Mutual acceptance is required on actual geometry pairs, not tags or an object-wide approximation.

The shared predicate runs before physical, Trigger, and Tile geometry work. Kinematic/Static and Character response, accepted mixed-collider pairs, object-pair event dedup, slopes, steps, and one-way surfaces retain their geometry behavior. Mask changes cause next-tick Trigger Exit and clear support before carry; restored eligibility causes re-Enter. Rider-specific Static and Tile obstruction filters are respected. Hidden/locked Tile Layers retain collision policy; collisionEnabled still gates collision. Terrain/Auto Tile authoring remains separate from physical eligibility.

Project/model history, Prefabs, clean deterministic Bundles and colliding-ID imports preserve policy. Bundle dependency closure includes marker Prefab references; reserved Default is reused and nonreserved colliding IDs are remapped without name-based identity merging. Editable/Playable compositions embed the runtime before its consumers.

The internal Lab has Default, World, Character, Enemy, Projectile, Pickup, Sensor and Ghost, independent Trigger policy, a moving platform/rider, slopes/one-way examples, and a distant 10,000-cell Tilemap. Dedicated renamed/reordered and missing-reference exports exercise those variants. The normal Lab validates with zero issues. No public catalog entry was added.

## Verified before soak

18 focused tests; 20 fuzz seeds (1M predicates, 1M registry mutations, 500K physical decisions, 250K Trigger ticks, 100K Tile queries, 100K carry decisions); 1,000 model roundtrips and 100 each Prefab/Bundle/history-model checks; five performance fixtures; 20 exact exported HTML files; 30 isolated browser cycles (20 Editable / 10 Playable); zero captured browser warnings/errors. Native exported-editor authoring, one Delete/Undo, real Save/Reload/Load, three persisted policy owners, refreshed usage, and Play passed separately. Model history tests are not reported as native Undo repetitions.

Evidence lives under `qualification/phase-049`: `phase-049-browser-campaign.json`, `phase-049-visible-authoring.json`, `phase-049-filter-fuzz.json`, `phase-049-portability.json`, `phase-049-performance.json`, `phase-049-export-proof.json`; screenshots include `final-10.png` through `final-30.png` and `final-live-lab.png`. Harness/fixture failures are retained and described in the characterization; they are not qualifying successes.

Final acceptance completed: fresh 3,603.044 active seconds, 148 cycles / 703 real workloads, zero semantic failures, eight in-run browser checks (four Editable / four Playable), 1,408 runner memory observations, unchanged start/midpoint/final fingerprint, and complete post-endurance gates. Earlier partial runs, wall time, composed exports, and model roundtrips were not substituted for these requirements.

## Completed qualification

The 54 pre-soak and 54 post-soak command gates passed. Exactly one qualifying runner started at **2026-10-02T17:48:23Z**, run ID `phase-049-soak-20261002T174823Z`, PID **46168**, and completed at **2026-10-02T18:48:47.398Z**. `phase-049-soak.json` matches the active state and contains monotonic workload time. Eight in-run cycles are saved separately from the 30 pre-soak cycles; two additional post-soak tier checks also passed.

Memory review: five actual browser observations showed used heap 28,966,653 → 19,725,837 → 19,510,952 → 18,562,784 → 18,664,616 bytes. Registry size stayed 8 entries / 475 serialized bytes. Runner RSS ranged 47,882,240–79,699,968 bytes and ended at 62,992,384; heap ranged 5,277,792–11,627,784 and ended at 7,520,280. The runner intentionally retains its evidence samples, explaining growing parent-process quarter medians. No runaway trend was observed. These are Chromium estimates and parent-runner measurements, not forced-GC, child-process aggregate, GPU, or universal memory guarantees. The shared predicate retains no mutation-key cache; valid identity sets are rebuilt per tick/move. See `phase-049-memory-review.json`.

Post-soak native acceptance created and explicitly renamed a fresh layer, assigned Box / independent Trigger / active Tile Layer policies, saved `phase-049-post-soak-acceptance`, reloaded the page and loaded the saved project. All three owners restored the identical stable ID `collision-layer-murbm869-y2n6olkq`; Box retained World + self membership, Trigger and Tile retained Character membership. The sensor's ordinary Box remained Ghost. Usage refreshed to 3 primary / 1 mask reference, validation found no issues, and native Play entered. A browser-control connection stall during Load was recovered by resetting the control session; the actual Load had succeeded. This was not counted as a product pass before observation or as a product semantic failure.

The integrated post-soak suite covers Phases 011–049 (and earlier authoring foundations), stabilization, onboarding, public API/showcase/catalog; engine-site and games-site rebuilt with 28 public games. Product JavaScript syntax, project/catalog/game JSON, diff whitespace, capability dashboard and friction report passed. Capability grades remain B for the broad Collider/Tilemap rows; unrelated friction remains open. No deployment occurred.

Performance observations on this host: 100×1,000 physical pairs produced 90,000 filter rejections before 10,000 AABB tests (~32.96 ms); 100×1,000 Trigger targets produced 99,900 rejected candidates, 10,000 AABB / 100 narrow tests and 100 Enter events (~34.37 ms). Sparse 10K-cell queries visited 4,900 candidates / 596 collision cells while rejecting 100 Layers (~17.83 ms); 100 Characters visited 6,400 candidates (~12.12 ms); 100 platforms carried 100 riders (~32.23 ms). These are fixture timings, not frame-rate guarantees.

The internal role policies are Character→World, World→Character, Enemy↔Projectile, Sensor→Character with matching Character→Sensor, Pickup→Character with matching Character→Pickup, and Ghost→empty Custom. Actual geometry pairs must still pass both sides. Default remains the historical All migration target. Hidden/locked state does not override Tile collisionEnabled or masks; Full/Custom Tile shapes, slopes and one-way eligibility use the same policy. Accepted contacts preserve existing hit/event dedup and matched collider types; rejected one-sided masks suppress geometry work. Mask loss clears support before carry, and Static/Tile carry clearance is evaluated against each rider's geometry. Phase 048 carry regressions passed unchanged.

The final machine-readable index is `phase-049-final-evidence.json`; dogfood and export proofs are qualified. The qualification heartbeat is deactivated on closure. The browser-control skill surfaced and verified explicit Rename and immediate usage refresh; neither is a cosmetic-only change. Phase 050 is a documented seam only.

No Dynamic role, gravity, global collision matrix, general controller, global debug overlay, Phase 050 implementation, Game 29, deployment, commit, or push is authorized or implemented.
