# Phase 079 — Moving Platform component

COMPLETED — 2026-10-10. Final source fingerprint:
`d6bb79248cbb1b4952e32af00f3667df5f3a6bfefa14a0b30cfb3f31b5dc2d88`.

Creators can add Moving Platform 3D to a solid Cube, choose signed world-axis
travel and duration, and start through canonical Events/Start Platform Motion or
explicit opt-in autoplay. Playback uses the existing Property Animation clock,
with transient independent tracks; it does not overwrite authored clips or create
hidden Start records. Modern Moving Platform 2D continues to compose Kinematic
Body 2D velocity and the qualified Phase 048 carry/obstruction solver.

## Actual product evidence

- `qualification/phase-079/platform-browser-20261010T070217003Z/proof.json`:
  19 native creator/runtime cases PASS, including strict edit→Tab→Undo,
  duplication, Prefab, Save/reopen, parented world motion, actual standing rider
  carry, walk-off, pause and Stop restoration; Source/Editable/Playable.
- `qualification/phase-079/modern-platform-browser-20261010T070224884Z/proof.json`:
  15 native Sprite/Body/platform cases PASS, including actual carry, walk-off,
  elevator ceiling clamp, history, Prefab, persistence and exact exports.
- Both final campaigns retain matching start/final fingerprints and zero page,
  console or mandatory external-request errors. Screenshots and downloaded
  Editable/Playable artifacts accompany their proof files. Modern Playable still
  framing does not show every fixture simultaneously; individual runtime records
  and native interactions, not that still alone, establish the scenario results.
- `qualification/phase-073/core-browser-20261010T070239891Z/proof.json`:
  14 prior core native authoring/history/persistence/export cases PASS.
- `qualification/real-demo-collision/regression-20261010T070055671Z/results.json`:
  all eight normal command gates PASS, integrated suite, engine build, all 28
  game builds, both sites, 413 JavaScript syntax checks, 40 JSON checks and diff
  check; matching final fingerprint. Command success is not gameplay acceptance.
- `qualification/real-demo-collision/probe-20261010T065710056Z/results.json`:
  Moving Temple and Skyway Trial actually started, moved and restarted without
  browser errors. This compatibility observation was on the preceding a2bf
  candidate, before the shared Inspector-only history repair, not a final-source
  full catalog soak. Historical collision qualification remains separate.

## Repairs and permanent regressions

Actual-source tests: four characterization, nine runtime and seven mounted field
history cases. Shared defects observed RED then repaired include invalid axis
options, undefined pause state, nonfinite travel endpoints and parent/socket
hierarchy overwriting requested world motion. Component-only canonical world-to-
local commit preserves historical authored animation behavior.

Real native acceptance reopened Phase 006: focusing an untouched Inspector field
created an empty Undo snapshot. The mounted editor now captures history before
the first valid changed mutation and coalesces typing within a field session.
Invalid/no-op edits, Reset and mask bulk operations have permanent regressions.
The original native edit→Tab→Undo assertion passes; it was not weakened.
Failed product candidates and separate selector/timing automation failures remain
preserved in the Phase 079 campaign directories. No failed evidence was counted
as successful qualification.

## Boundaries

No new controller clock, 2D ping-pong route, rotational/scaled carry, arbitrary
dynamic physics or Game Save playback-phase resume is claimed. Solid remains an
explicit 3D prerequisite; enabled Body 2D rejects competing 3D motion ownership.
Estimated Chromium heap observations were 8.04–13.02 MB, not forced-GC leak proof.
Public game content was not changed. No commit, push or deployment occurred.

Next authoritative phase: 080 — Component preset save/share workflow. Epoch 08
integrated creator review is required before moving into Epoch 09.
