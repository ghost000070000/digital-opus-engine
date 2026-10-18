# Phase 083 — Anchors, responsive constraints and safe areas

COMPLETED on `57436b1587d5fa0d884877ea38d78405070e9d54ef8ce53a28ef827233e914e7`, 2026-10-10T08:16Z. This qualifies083, not the full240-phase product.

The existing level HUD now has opt-in Safe Area/device insets plus creator padding, Keep Inside, signed offsets and Image/Panel percent widths with optional pixel bounds. Historical fixed records retain their original CSS behavior. One canonical pure resolver uses actual HUD containers in preview and gameplay; the existing stable renderer continues to own input. Desktop/Tablet/Phone previews are view-only. Mutations retain independent Undo/Redo, per-level ownership, Save/reopen and both exact export tiers.

Real evidence:

- Native22: `qualification/phase-083/hud-layout-browser-20261010T081412035Z/proof.json`,08:14:12.037–08:14:29.168. Nine anchors, three previews/nine runtime viewport observations, safe padding, percent/min-max, signed/invalid editing, long Text wrapping, stable button focus, ordinary Action level switching, Save/reopen, Source/Editable/Playable. Zero page/console/external errors; start/final fingerprint identical.
- Prior-core14: `qualification/phase-073/core-browser-20261010T081415851Z/proof.json`; native Transform/visual/Collider/hierarchy/Prefab/persistence/export remain green.
- Focused14: `tests/phase-083-hud-layout.test.js`; actual DOM/history/packaging plus positive inset algebra and legacy preservation.08110 and0828 actual-source checks also pass.
- Full8: `qualification/real-demo-collision/regression-20261010T081403470Z/results.json`; integrated suite, engine,28 public artifacts, both sites,424 syntax files,40 canonical/program JSON files and normal diff check. Frozen start/final fingerprint identical.

Repairs before final acceptance: packaging regression caught a missing development loader; preview Text inherited outer-window42vw rather than canonical device width; native geometric22 checks passed but screenshot review showed portrait bottom anchors clipped. Preserved `hud-layout-browser-20261010T081157015Z`/`VISUAL-FRICTION.json`; modal sizing now budgets actual controls/margins/padding/borders against92vh. Fresh Phone screenshot shows the entire stage and help visible; containment is now a permanent native assertion. Initial full run081221584Z exposed stale generated capability Markdown after inventory reconciliation; normal generator refreshed it, then full gates passed. No failed-run time/evidence transferred as final qualification.

Limits: browser device-env insets may be zero; physical-notch behavior is not claimed. Positive device inset algebra is tested; creator padding is actually observed. Constraints do not automatically avoid intentionally overlapping authored elements. Rich typed HUD binding UI is exact084, not hidden inside083. HUD is level-owned, not an Object Prefab component. No public Game29, commit, push or deployment; preexisting dirty work preserved. Automatically continue084.
