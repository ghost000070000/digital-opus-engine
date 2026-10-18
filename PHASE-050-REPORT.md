# Phase050 — 2D physics debug overlay and regression harness

Status: COMPLETED. Final source fingerprint:
`ef64799c8879048e51f7b82b6b7c9226837e2312d0f3c023288c9b9bbf33dfee`.
This is a scoped phase closure, not the full240-product readiness verdict.

The editor and Editable exports provide an opt-in modernXY overlay, distinct from
legacyXZ Show Colliders. Named object and mutual-mask comparison pickers expose
canonical Collider/Trigger geometry, actual Character ground/wall/slope/support/
carry state, authored step/slope limits, actual moving-platform delta/riders,
Trigger pair counts and aggregate sparse-query/carry counters. Comparison names
its two shapes and never claims mask acceptance alone proves blocking.

The public immutable read model is OpusPhysicsDebug2D.snapshot/filterPolicy.
It neither ticks nor queries collision, mutates physics, authors project data nor
adds entities. Off performs no traversal/getter calls. On is capped at128 shapes,
1024 objects and10Hz UI refresh, with selected-scene-object priority and visible
truncation. Parented geometry uses canonical world XY/Z. Hide works during Play.
Stop shows no stale active support; cumulative counters are labelled separately.
Debug remains transient through history, duplicate, Prefab, Save/Load and exports;
Playable boot suppresses it even though the shared implementation is embedded.

## Actual evidence

- Native browser `debug-browser-20261009T195434474Z`:18 observations PASS,
  zero page/console/external-request errors. Native import, off/on, accepted/rejected
  masks, Play carry/public getter correspondence, platform delta, Hide, Stop,
  Duplicate/Undo/Redo, Prefab, local Save/browser reload/Load, actual Editable/
  Playable download/reopen, Editable live carry and Playable debug-off.
- Reviewed source-debug, source-runtime-carry and editable-debug screenshots in
  that run. Current orthographic gameplay geometry aligns with canonical outlines;
  source authoring perspective also projects real geometry. No hidden state writes.
- Focused model regression: disabled laziness/getter safety; bounds; canonical Box,
  Circle Trigger, parent transforms/Z; masks/invalid references; immutable ownership;
  actual Body-manager state correspondence and no ticks caused by inspection.
- debug-cost.json at identical fingerprint:100000 disabled reads/zero traversals;
 10000-object dense/sparse scenes bound to128 shapes/1024 scans. Observed timings
  are machine-specific, not portable FPS or forced-GC stability claims.
- Full gates `regression-direct-20261009T195624346Z`, ended19:57:36.9043534Z:
  tests/run-tests.js, build/build.js, build-games, engine-site, games-site all0;
  28/28 public catalog;332JS syntax/JSON/diff PASS; start/final fingerprint identical.
  Includes041–049, actual legacy-controller repairs, stabilization/onboarding,
  publicAPI, capability/friction and site integration. No new public game.
- Targeted native Playable `probe-20261009T195152802Z` observes sustained wall/corner
  in Arsenal Run, Power Grid, Signal Relay, Silent Sector, Relic Frontier and
  Dungeon Descent. Default hover route missed sustained contact (coverage only);
  explicit known-wall `probe-20261009T195519793Z` at final fingerprint passes
  Survival Arena wall/corner/native restart with zero page/console/external errors.
  This supplements, not replaces or transfers time from, the b57 collision closure.

## Failures preserved and repaired

Native runs193856802Z/193948395Z exposed new wrong play-state/vector identifiers;
repaired using actual playMode and Opus.Vec3, then native reruns passed. First-run
dialog interference handled via visible Skip, not force click. Strict persistence
comparison found only empty Prefab parameters [] versus omitted; actual runtime
uses both as no parameters. Only that documented default is normalized; all other
fields and nonempty definitions remain strict. Updating capability evidence made
the generated dashboard stale; preserved195512099Z gate failure, regenerated the
canonical view and reran the entire chain successfully.

## Epoch and limits

EPOCH-05-CREATOR-REVIEW.md records the coherent author→Play→inspect→persist→export
workflow and intentional044 NOT_JUSTIFIED Dynamic gate. Dedicated2D input/jump,
general Dynamic physics/events, drop-through, unbounded world/Tile diagnostics,
per-contact tracing and full profiler are not quietly claimed. Multiple shapes
remain individually listed; mask comparison explicitly uses first canonical shape
per named object. Legacy3D is separate. Large-scene coverage is intentionally
bounded/disclosed. Dark FPS presentation remains product friction.

No commit/push/deployment or incompatible migration. Continue exact051 under the
master mission; the full product program is not READY merely because this phase is.
