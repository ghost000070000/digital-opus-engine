# Phase 048 baseline characterization

Recorded 2026-09-26 before Phase 048 product edits.

- Git: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`, dirty worktree preserved (810 status entries).
- Engine: 168,984 raw bytes / 43,457 gzip bytes / 22 engine source files.
- Editor package: schema-driven component records embedded through the same Editable and Playable composer.
- Regression: `node tests/run-tests.js` passed; focused Phase 043–047 suites passed; 28/28 public game builds passed.
- Body update: stable-ID Kinematic enumeration; world-XY `linearVelocity * dt`; cached Static Body shapes; X-then-Y conservative movement; Character branch; Trigger Collider tick after Body tick.
- Support state: transient per-manager `groundSupportId`, `groundNormal`, `slopeAngle`, `onSlope`, grounded/wall/ceiling state. Scene supports use stable object IDs; Tile supports use synthetic cell IDs.
- One-way: Static Box/tile providers, relative top crossing for Character intent, slope classification through the Phase 047 surface helper.
- Transforms: collider shapes resolve from world matrices. Editor runtime translation converts world deltas through the parent inverse and rejects singular parents.
- Runtime clone: Play snapshots authored Body transforms, mutates runtime objects, and restores on Stop. Trigger lifecycle consumes final post-Body positions.

Phase 048 therefore extends the existing Body manager and stable support identity; it does not introduce another physics loop or hierarchy attachment.
