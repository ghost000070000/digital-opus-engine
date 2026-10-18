# Phase077 — Checkpoint component

The bounded reopening below closed under108 on6a1497: original per-level authoring
survives Restart/switch/Project Save/export/Stop/reopen, while intentional runtime
Game Save/Restart retain live positions. Actual session5/fresh full8/final native
session8 PASS; qualification/phase-108/qualification.json governs new evidence.

2026-10-10 bounded reopening under Phase108: Restart's intentional runtime
survivor position must not redefine the original authoring baseline. A native
Stop-after-Restart RED and actual A→B→A RED require session/per-level recovery.
Focused repaired tests preserve runtime Game Save while recovering independent
Project Save/export and Stop views. Fresh integrated/native gates remain OPEN;
this does not change checkpoint activation or claim new historical acceptance.

COMPLETED. Final source fingerprint:
`84dd7539a27cdf00f0c24a5f941dfb67f27f19ba0c4fcfe01e49bf40704c7744`.

The concrete Cube/Sprite component configures enabled state, an optional named
respawn marker, a finite world XYZ offset and optional exact Trigger2D activator.
Activate Checkpoint composes the canonical Set Checkpoint Action; existing
Respawn At Checkpoint, automatic void-fall recovery and Game Save/Load retain
their actual Player semantics. Adding component data alone performs no Action.
The marker's position is cloned at activation; later movement cannot drag it.
No hidden per-object controller or new save system. Inspector explicitly explains
that modern named overlap activates the existing Player checkpoint, not a named
actor respawn. Invalid/future/disabled/missing-marker policies are inert.

Legacy Set Checkpoint keeps firing-owner position with no new offsets/filtering.
Legacy Respawn intentionally teleports and clears Player velocity. Existing
checkpoint state is session-wide across level transitions and stored in runtime
saveFormatVersion3; this phase does not silently change that historical promise.
Creators must choose safe locations outside solid geometry; no global collision
depenetration conceals a bad respawn marker. Stop/project Save own authored data;
Game Save owns reached checkpoint/Player state independently.

Permanent tests execute actual activation and canonical Set/Respawn code,
covering marker cloning, velocity reset, finite offsets, missing/future/disabled,
wrong exact Trigger actor and absent Player. Registry test was red before concrete
registration; existing full schema/discovery assertions add the concrete schema
without weakening prior eligibility or lifecycle invariants.

## Real product qualification

Native `checkpoint-browser-20261010T060335816Z`:9 observations. Actual keyboard
activation/movement and HUD respawn; velocity reset; Game Save/Load with an
80-unit marker-height change; marker snapshot independence; disabled and deleted
marker inert; Remove/Undo, duplicate independence, Prefab, project Save/reopen;
exact downloaded Editable and Playable match Source. All browser/console/mandatory
external-request errors zero. Authoring screenshot reviewed: typed marker/actor,
world offset, explicit safe-position and existing Player help.

Native Sprite `trigger-checkpoint-20261010T060032921Z`:7 observations. Native
drag placement, component/reference/Event/Action authoring, wrong overlap inert,
named overlap snapshots[8,3,6]/threshold-27; both downloaded tiers independently
exercise wrong and correct actors. Zero page/console/external errors.

The tests uncovered and repaired three shared product defects:

- HUD replaced its entire DOM every frame, detaching focused/pointer-down buttons.
  Stable keyed elements preserve native input even while timer text changes.
  Genuine red055115493Z retained; final HUD060102719Z4PASS proves Enter/Space,
  pointer held12frames, current Action/params, kind/removal/Stop cleanup.
- Game Load restored checkpoint but not its void-fall threshold. Reconcile after
  level/world/player restoration. Actual-source same/cross-level/no-checkpoint
  reds captured; permanent regressions pass.
- Ordinary runtime Set Position leaked marker transforms into authoring after
  Stop. Native055543105Z failed an exact export; actual-source Stop red captured.
  Project/Stop transform view now uses independent authored world/local/quaternion
  records while preserving other survivor component edits. Explicit runtime level
  view keeps historical mid-play movement; canonical teleport and Game Save are
  unchanged. Permanent hierarchy/mirror/deep-independence regressions pass.

Full `regression-20261010T055945895Z`:normal suite, engine,28games,bothsites,
403 JavaScript syntax,40 canonical/program JSON,diff and frozen start/final
fingerprints PASS. Later usage helper has its own syntax check; no product drift.
Prior native core055958804Z14 and Pickup060014755Z16 PASS. Fresh rebuilt public
`probe-20261010T060122252Z`:seven games include mandatory five plus Dungeon
Descent and Survival Arena, all four families; actual movement and native restart
with post-restart movement PASS,zero errors. This is compatibility evidence,
not a new full28 acceptance or new60-minute soak claim.

Limitations: existing shared Player checkpoint/session semantics; not per-object
respawn. Choose safe marker ground/clearance explicitly; no global depenetration.
Cross-level runtime movement preservation remains historical. No public game
content changed, Game29, commit,push,deployment or new external dependency.
