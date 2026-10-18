# Phase089 — UI animation/tween authoring

IN PROGRESS after088 real qualification. Exact authoritative title retained. Add bounded discoverable no-code HUD animation/tweens through canonical HUD references/Actions and existing easing/simulation-time semantics. Initial architecture characterization precedes implementation: Object moveTo/rotateTo/scaleTo operate entities; HUD owns anchors/layout and authored versus transient session UI, so do not blindly reuse entity transforms or add a competing scripting/animation/game-loop system.

Target ordinary creator workflow: select a named HUD element, author a Move/Fade/Scale tween with finite validated values/duration/easing, preview safely, use canonical events/Actions during Play, Undo/Redo, Save/reopen and export. Preserve historical default presentation when no tween authored. Runtime effects must not persist into authored Save/Stop; repeated tween on same element/property has explicit replacement semantics, missing/deleted/future refs remain inert and visible. Respect actual anchor/layout transform ownership, pause/delta time, level change/restart/Stop cleanup, rendering focus and interaction. General cinematics/timeline work remains later roadmap, not this boundedphase.

Gates: actual-source/native missing authoring RED; read-only author preview, actual no-code tween input and observed intermediate/final presentation, replacement/zero/nonfinite/ref safety, pause/resume/Stop/history/Save, Source/Editable/Playable and proportional full regression. No Game29 or deployment.090 UI template/prefab library and export QA is next only after089 qualifies.

## Implemented semantics under qualification

Move HUD To uses the existing anchor-relative offsets, not screen-world or Object
Transform coordinates. Fade HUD To controls transient opacity; opacity zero is
inert to pointer/keyboard interaction. Scale HUD To scales the complete visual
box inside the unchanged layout-owned anchor. Responsive Keep Inside constrains
the logical positioning box, not a newly enlarged scaled visual; creators must
leave space for enlargement. It does not silently resize authored constraints.

Duration is finite seconds0–3600; zero is immediate. Four existing canonical
easings are linear/easeIn/easeOut/easeInOut. Same property channel replaces from
its current sampled value; Move, Fade and Scale channels coexist independently.
Simulation pause freezes channels. Level switch, restart and Stop clear runtime
and preview presentation. Missing/deleted targets are inert; records are retained.
Scrub preview uses the same pure sampling math, never invokes the Action, writes
history, or changes the project. Save stores authored Action parameters only.
HUD remains level-owned, not an Object Prefab component. No alternative clock,
animation scripting system or renderer is introduced.

Source review caught a real empty-Panel visual defect after numerical/native-label
diagnostic gates had passed. Qualification now requires complete painted-box
Panel and Health/Image dimensions plus legacy/responsive anchor evidence. The
diagnostic17 gate run does not qualify this phase.
