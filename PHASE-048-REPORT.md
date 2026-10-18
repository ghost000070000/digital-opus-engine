# Phase 048 — Moving Platforms & Carry Behaviour

## Verdict

`PHASE_048_MOVING_PLATFORMS_CARRY_READY`

Run `phase-048-endurance-20260926T112807Z` completed with 10,834.704 active
seconds, zero semantic mismatches, zero crashes, zero browser errors, and one
unchanged product-source fingerprint at start, midpoint, two hours, and final.

## Baseline and package

- Repository: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`.
- Pre-existing dirty work was preserved; status entries moved from 810 at baseline
  to 826 after Phase 048 evidence and generated packages. Nothing was committed,
  pushed, deployed, cleaned, reset, or restored.
- Engine remained 168,984 raw bytes / 43,457 gzip bytes / 22 sources. Phase 048
  therefore added 0 raw bytes and 0 gzip bytes to the separate engine bundle; the
  feature lives in the no-code editor/runtime composition.
- Editor package moved from the Phase 047 final 2,008 KB to 2,025 KB: +17 KB.
- Public catalog remains exactly 28/28. No Game 29 was created.

## Architecture and component

`Moving Platform 2D` is a first-class, singleton, Physics / 2D component with
schema version 1 and one owned field, `enabled`. It reuses Body 2D's world-space
`linearVelocity`; there is no second velocity, path, reversal, speed, rider capacity,
mass, friction, impulse, gravity, input, jump, Dynamic Body, or filtering model.

Eligibility requires an enabled Kinematic Body 2D and enabled valid Box Collider 2D.
Missing, disabled, and wrong-type dependencies produce structured warnings without
silently changing authored data. Search finds the component by `moving platform` or
`platform`. The Inspector shows readiness, Body velocity, One-Way status, limitations,
and removal. Ordinary Kinematic Bodies still pass through one another.

The existing Body manager remains the single update owner. Its deterministic order is:

1. snapshot/probe previous Character support;
2. collect riders by stable platform object ID;
3. calculate the platform's Static-limited base translation;
4. reduce it by the minimum safe scalar fraction across all riders against Static and
   Tile obstacles;
5. apply that exact translation to the platform and every supported rider once;
6. apply each Character's own requested motion against current platform geometry;
7. finalize support state;
8. run Trigger lifecycle against final positions.

No parenting or hierarchy mutation is used. Moving Platforms do not respond to Tilemap
collision as Bodies and do not create general Kinematic-to-Kinematic response.

## Carry and safety

First-tick authored support, horizontal, vertical-up, vertical-down, diagonal, fast,
walk-with, walk-against, walk-off, and upward-leave cases pass. Carry uses actual
platform displacement rather than requested velocity. Character and platform authored
velocities remain unchanged.

Wall, ceiling, Tile-wall, and Tile-ceiling obstruction use one scalar fraction. One
constrained rider limits the platform and every rider equally, preserving relative
offsets and preventing ordinary carry penetration. Singular parent conversion fails
closed. No crush/damage behavior or recurring sweep-cap pathology was introduced.
Unsupported side contacts are intentionally not pushed.

Transient Character state exposes stable `groundSupportId`, `onMovingPlatform`,
`groundNormal`, `slopeAngle`, and frozen `groundSupportVelocity`. Support velocity is
actual platform delta divided by `dt`; Static support reports `[0, 0]`. Walk-off,
upward leave, disable, removal, Play Stop, and manager reset clear stale support.

Moving one-way platforms preserve pass-up, relative descending landing, established
top carry, and no-side-wall semantics. Authored rotated Boxes retain their walkable
slope normal and angle while translating. Too-steep platforms are not acquired as
support. Runtime rotation/scale does not generate rotational/scaled carry in v1.

## Persistence, dogfood, and exports

Save/Load, object and Level duplication, Prefab-style application, history snapshots,
Play/Stop, Editable export, and Playable export use the shared component record and
runtime dependency routes.

The internal `Phase 048 Moving Platform Carry Lab` covers horizontal, elevator-up,
elevator-down, diagonal, obstruction/low-ceiling, two-rider, walk-off, one-way,
moving-slope, Trigger, and 10,240-cell Tilemap scenes. Its refreshed campaign contains
10 Editable and 10 Playable artifacts. Representative sizes are 2,092,251 Editable
bytes and 2,068,623 Playable bytes. The final isolated Edge review ran 30 cycles
(10 Editable / 20 Playable), captured five screenshots, and recorded zero page,
console, or external-request errors.

## Fuzz and performance

- 20 deterministic seeds.
- 500,000 exact carry operations.
- 250,000 obstruction operations.
- 500,000 support-transition operations.
- 100,000 one-way relative-crossing cases.
- 1,350,000 total operations; zero mismatches.
- Frame partition proof covers 30, 60, 120, 144, and 240 Hz; endurance repeated
  664,584 comparisons.
- Zero-platform median/p95: 0.001/0.002 ms.
- 100 riderless platforms median/p95: 2.093/2.995 ms with zero carry work.
- 100 platforms + 100 riders median/p95/max: 11.664/27.677/40.324 ms, within the
  50 ms p95 gate.
- 10,240-cell sparse query median/p95: 0.099/0.210 ms with 2,160 candidate cells.

## Active endurance

- Target: at least 10,800 seconds; configured target 10,830 seconds.
- Actual active duration: 10,834.704 seconds; excluded pause time: 30.540 seconds.
- Cycles: 690; simulation ticks: 16,555,585.
- Carry moves: 15,451,637.
- Horizontal: 828,242; vertical: 1,655,283; diagonal: 827,592.
- Shared obstruction clamp cases: 3,311,117.
- Multi-rider cases: 3,311,117.
- Support changes: 2,207,655; walk-offs: 1,103,948; upward leaves: 1,103,707.
- Moving one-way cases: 5,518,286; moving-slope cases: 3,311,117.
- Trigger-order checks: 3,311,117; save/reload cycles: 3,311,117.
- Browser cycles: 180; Editable: 60; Playable: 120.
- Memory observations: 702. The transient rider map stayed at zero between ticks.
  V8 reserved heap expanded during warm-up; the final 30 RSS samples stayed in a
  narrow 293.8–299.0 MB band rather than growing per rider/tick.
- Initial plus periodic plus forced-final heartbeat checkpoint cadence completed.
- Midpoint: 5,425.754 active seconds. Two-hour: 7,200.665 active seconds.
- Fingerprint at start, midpoint, two-hour, final, and post-closure:
  `0f61aec064311e66aacaa484b58a9e7a7f7f81b74974971c1bef6648d93d435a`.
- Semantic mismatches: 0; crashes: 0; unresolved failures: 0.

## Post-endurance closure

- Phase 048 focused: 37/37.
- Integrated Phase 011–048 and legacy public API suite: PASS.
- Phase 047: 43/43; Phase 046: 44/44; Phase 045: 36/36;
  Phase 044 remains `DYNAMIC_BODY_NOT_JUSTIFIED`; Phase 043: 24/24;
  Phase 042: 73/73; Phase 041: 83/83.
- Phase 031–040, stabilization, onboarding, and showcase gates: PASS.
- Control stabilization: 8/8; collision stabilization: 100,000 deterministic cases.
- Public site integration: 28 public / 0 internal leaked.
- Engine build, 28/28 standalone games, engine-site, and games-site: PASS.
- Engine-site: 2,025 KB editor, 28 examples, 233.4 MB total, link/path safety PASS.
- Games-site: 28/28, 153.2 MB, link/path safety PASS.
- Syntax, all Phase 048 JSON, capability 31/31, friction 27/27: PASS.
- `git diff --check`: exit 0; only known LF/CRLF notices.

## Scope and roadmap

Tilemaps remain production-grade for the qualified 2D workflows and Sprites/2D remain
at their evidence-backed dashboard grades. The genuine remaining limitations are
unsupported side pushing, translation-only carry, no general moving-body/crush solver,
and no collision filtering. The Phase 049 filtering seam, Phase 050 debug seam, and
future controller use of `groundSupportVelocity` are documented but not implemented.

Roadmap state: Phase 048 QUALIFIED; Phase 049 PLANNED; Phase 050 PLANNED. The
recommended next phase is Phase 049 only under a new explicit instruction.
