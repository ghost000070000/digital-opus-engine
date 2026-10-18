# Phase090 — UI template/prefab library and export QA

Qualified locally2026-10-10. Exact authoritative phase title retained.
Final fingerprint: `2e7fe93a1741e0b91edd2b6bf276415f73c6836b9cc810c31de3c2b63494ec2c`.

Creators capture the current authored HUD as a named project-local reusable group,
preview without executing Actions, insert independent copies with optional offsets,
and import/export group JSON. Canonical level UI/history owns each insertion;
screens and menus are not replaced. Internal typed HUD references remap, literal
text does not. Images and registered Action dependencies survive library-only
Save/Editable. Playable ships ordinary placed HUD, not an authoring library.

Shared review repairs: unresolved external HUD references now refuse insertion
before history mutation; internal Move HUD endpoints shift with placement;
unavailable future HUD kinds remain preserved/exportable but explicitly disable
whole-group insertion. Invalid offsets and malformed/future versions are atomic.
Native theme/316px sidebar fit and read-only preview are verified.

## Frozen acceptance

- Native13: `qualification/phase-090/ui-templates-browser-20261010T104318017Z/proof.json`,
  10:43:18.020–10:43:44.762Z. Real capture/history/Save/reopen/library-only Image,
  exact JSON import/export, missing/future target safety, two independent internal
  tween targets and combined Epoch09 gameplay in Source/Editable/Playable. Actual
  completed paint endpoints align. Zero page/console/external-request errors.
- Prior core14: `qualification/phase-073/core-browser-20261010T104406706Z/proof.json`,
  10:44:06.707–10:44:17.249Z, same fingerprint and zero browser errors.
- Full8: `qualification/real-demo-collision/regression-20261010T104153775Z/results.json`,
  10:41:53.776–10:43:23.819Z. Integrated previous-phase/stabilization/onboarding/API/
  site tests, engine/all28 games/both sites,452 JS syntax,40 JSON,diff all pass;
  fingerprint matches. Core7 plus actual-source mounted-control/history/refusal/
  dependency/independent-instance regressions are permanently registered.
- Epoch09 integrated review: `qualification/phase-090/EPOCH-09-REVIEW.md`.
  Coordinator inspected themed authoring and final Playable screenshots.

Preserved diagnostic runs are not substituted for final proof. Initial native
missing-library RED, same-frame binding read and incomplete-y tween sampling
attempts remain recorded; the latter two were harness predicates, not product
failures. First full command attempt104125043 caught stale generated capability
Markdown; regeneration followed by fresh full acceptance fixed that gate.

## Boundaries

HUD groups are level-owned reuse, not Object Prefab components. Capture currently
uses the entire current HUD. JSON carries settings/project-local references, not
foreign assets. Max128 saved groups/elements per group; unsupported retained
records stay repairable. One Action per Button and existing responsive-layout
contracts remain. No renderer/runtime rewrite, external service, Game29, commit,
push or deployment. Phase091 is next after verified tracker transition; full
240-phase product readiness is not claimed.
