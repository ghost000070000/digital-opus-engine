# Phase089 — UI animation/tween authoring

Qualified locally on 2026-10-10. Exact roadmap title retained.

Final product fingerprint:
`6e20aaad12e0f51b5ce85c6bffa0f629b3863e29ee98167289a74f9e6e71056f`.

## Creator workflow

HUD Button Action picker and the canonical event/Action registry expose Move HUD
To, Fade HUD To and Scale HUD To. Named typed HUD references, finite endpoints,
seconds0–3600 (zero immediate) and four existing easing curves require no Script.
Read-only range preview uses canonical sampling, does not execute gameplay or
mutate authored data. Native edit/history/Save/reopen and both exports passed.

Runtime channels replace from current sampled values; independent properties
coexist. Existing tickTweens/easeValue own simulation time. Pause freezes effects,
Stop/restart/level changes clear them, deleted/missing references remain inert.
Opacity zero is inert for interaction. No authored tween presentation is saved.
Complete visual box scales inside a layout-owned anchor; focused Buttons retain
their node identity during redraw. No second clock, renderer or scripting system.

## Real failure and repair

Initial source/native RED proved no HUD tween authoring. An initial diagnostic
17-gate label-centered browser pass did not expose empty Panels: source review
proved the wrapper scaled only children, leaving Panel paint unchanged and
Health/Image containing blocks at risk. Complete painted-box clone boundary
repaired; fresh tests measure actual Panel paint2×, Health/Image dimensions and
fill, and unchanged scale1 legacy/responsive label geometry. Reset preview theme,
disabled Play controls and stale preview lifecycle were also repaired.

## Frozen evidence

- Native32: `qualification/phase-089/hud-tween-browser-20261010T102017773Z/proof.json`,
  10:20:17.779–10:20:44.788Z; actual Source/Editable/Playable Actions, intermediate
  motion, fade/scale/replacement, pause, focus, missing/future refs, level return,
  Stop/reload, read-only preview, native history and Save. Zero page/console/
  external-request errors. Main reviewed final Playable and authoring screenshots.
- Prior-core14: `qualification/phase-073/core-browser-20261010T102056463Z/proof.json`,
  10:20:56.464–10:21:07.655Z, same fingerprint, zero browser errors.
- Full8: `qualification/real-demo-collision/regression-20261010T101925580Z/results.json`,
  10:19:25.580–10:21:02.045Z; integrated suite, engine build, all28 games, both
  sites,448 JS syntax,40 canonical/program JSON and git diff check pass. Matching
  start/final fingerprint. Phase041–088, stabilization/onboarding/API/site suites
  remain covered by integrated regression.
- Pure9 plus actual-source registry/validation/lifecycle/paint seams are permanent
  integrated tests. Historical extracted081/082/083/087 fixtures received only
  new helper/template dependency seams; existing assertions retained.

Earlier diagnostic and failed Panel edge-oracle runs remain preserved. Center
alignment is measured against actual visual/logical centers; content-box border
convention is explicitly recorded, not a relaxed collision/layout claim.

## Intentional limits

HUD is level-owned, not an Object Prefab component. One Action per Button remains
the existing contract. Move endpoints are anchor offsets, not world coordinates.
Keep Inside constrains the logical layout box, not enlarged scaled paint; creators
must leave room for enlargement. General timelines/cinematics remain later scope.
Phase090 is next only after tracker transition. No Game29/deployment/commit/push.
