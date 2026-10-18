# Phase 094 — Player rebind screen generator

COMPLETED — qualified on frozen source
`11947b382447b3da966eea55922fa19d9d95bf549ac049aa402fc7845b3e663c`.

The existing Controls screen is now an authored per-level generator with named
title/explanation/launcher, enabled toggle and inert creator-default preview.
Save/Reset reuse independent project history. Canonical Open Controls works
through existing HUD Button/behavior Actions and existing modal pause ownership.
Player keyboard/mouse rebinds remain local, not author defaults or scripts.

## Evidence and repairs so far

- Native RED115459616Z: Project A K rebind contaminated distinct Project B;
  real K fired B's interaction despite authored F. Zero browser errors.
- Scoped preference subkeys use portable project identities. New projects use
  secure UUIDs; original historical payload derives deterministic local SHA-256.
  Historical global preferences are retained unmodified, not auto-attributed.
- Actual-source ownership/authoring regressions cover prior pause, disabled/future
  configuration, preview/default separation and scoped local preferences.
- Review repaired device-only preview leaking retained player override; explicit
  null future scope lost on Save; retained extension no-op creating history;
  merged configuration size overflow; Pause launcher stale with Start disabled.
- Bare-array legacy projects remain supported. An initial level-normalization
  alias hypothesis was retracted after reading fresh level wrapper construction.
- Pure module10 groups pass, including SHA vectors/Unicode, secure randomness,
  unsupported identity/config retention and no accessor execution.
- All28 canonical project payloads derive valid preference scopes; this is local
  migration characterization, NOT fresh gameplay acceptance.

## Final qualification

- Native18: `qualification/phase-094/rebind-generator-browser-20261010T121104327Z/proof.json`,
  12:11:04.334–12:11:25.476Z. Creator configuration/Undo/Redo/inert preview,
  real keyboard/mouse capture and gameplay/reset/lifecycle, independent A/B
  preferences and same-project reopening, Source/exact Editable/Playable pass.
  Future configuration remains unavailable and preserved. Actual128 named Action
  rows scroll to the last binding; on390px portrait the Close button stays reachable.
- Main coordinator inspected native-generator-authoring.png and phone-128-controls.png.
  Native visual review reopened a preliminary green behavioral run: default-white
  fields/buttons and unbounded Controls rows were repaired with scoped styling
  and bounded scrolling, then requalified. Static CSS tests are not visual proof.
- Same frozen source: prior091 native12 (`121235100Z`), prior092 native20
  (`121253526Z`), prior093 native19 (`121139367Z`), core native14 (`121215865Z`).
  Every browser proof has empty page/console/external-request error arrays;
  all browser runners closed. Core's historical proof format lacks a final hash;
  surrounding frozen runs and the coordinator's final hash bracket it unchanged.
- Fresh full8: `qualification/real-demo-collision/regression-20261010T120852605Z/results.json`,
  12:08:52.606–12:10:32.679Z. Integrated suite, engine,28 catalog artifacts,
  engine/games sites,472 JS syntax files,40 JSON files and diff checks pass;
  start/final hashes agree. Pure10 and actual-source host/history/schema/CSS
  regressions are registered. This build is not a new28-game gameplay campaign.
- Selector/import timing/whole-editor-width misses remain preserved automation
  diagnostics, not product collision verdicts. The first full run's stale generated
  authoring inventory was regenerated and the fresh full run above passed.

Machine-readable closure is `qualification/phase-094/closure.json`.
No multi-hour soak is claimed or required for this bounded shared-screen adapter.

Intentional limits: player rebinding is keyboard/mouse, not gamepad/touch source
editing; copies retaining project identity share preferences; unavailable future
identity has session-only preferences; old ambiguous preferences require one new
per-project rebind.095–099 remain later roadmap work. No physical gamepad claim,
external service, Game29, commit, push or deployment.
