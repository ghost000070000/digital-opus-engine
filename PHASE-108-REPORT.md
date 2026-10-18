# Phase 108 — Camera target groups and framing

COMPLETED — qualified2026-10-10T19:44:16Z on frozen
`6a1497c1a68d912851cf6ed3efa1fb510d44ddf3e82402986c90069e69d4b6bd`.
This bounded capability is not overall product readiness. Machine-readable
evidence: qualification/phase-108/qualification.json.

## Creator contract and scope

Ordinary Camera records gain an opt-in Fixed-camera target group. A creator uses
named membership controls or captures a multi-object selection with a named
Fixed Camera. Membership is independent of editor selection grouping. Add,
remove, padding and enable changes use changed-only history. Historical records
default independently disabled; neither Player movement nor content transforms
are rewritten to obtain a fit.

The canonical public Camera.computeFraming query consumes finite world corners,
aspect and per-edge padding. It fits actual perspective or orthographic geometry
while preserving the authored view basis, projection, FOV and clip policy. An
infeasible fit returns a diagnostic instead of silently expanding clips. The
existing host applies a successful result and recomputes opt-in Fixed framing
after movement/hierarchy updates. No competing follow or physics loop is added.

Supported geometry is ordinary Cube, static rendered mesh arrays and true Sprite
quad bounds through actual Entity model matrices. Parent transforms, nonuniform
scale and Sprite size/pivot/offset are included. Collision proxies are not used.
Missing, hidden, destroyed or unsupported members refuse a complete fit and
retain saved references. Membership is bounded at128 and static meshes at10,000
vertices each; this is not a broad large-group performance qualification.

## Product evidence and repairs

The real native baseline camera-target-groups-browser-20261010T184202883Z ran
on qualified107 source62fa. Two named visible objects were outside a manually
chosen height6 frame and inside height16. Manual framing worked; the gap was
discoverable reusable group authoring, not a fabricated baseline runtime failure.

Four genuine shared defects were then reproduced and preserved:

- f6ac: refusing an infeasible group acquisition restored Chase by reacquiring
  its target, changing a live smoothed eye from X0.72 to X12. Existing101 Scene
  Camera snapshots lacked the transient tracking journal. Canonical motion-state
  capture/restore now preserves independent vectors and target identity without
  reacquisition; the host still owns authored options. This reopens the bounded
  earlier restoration surface rather than defending its historical test status.
- 810340: eight real-source cases showed instant or positive-duration group
  refusal clearing/replacing an existing path or blend. Application now reports
  success and ownership changes only after successful acquisition. If an already
  acquired group later becomes unavailable, the blend retains its last valid
  endpoint with a visible diagnostic instead of sampling its own interpolated
  presentation as a new destination.
- 74d1: repeated group fitting sampled the shaken rendered eye and wrote it back
  as the base pose. Thirty actual host fit frames left33.541m displacement and
  changed orientation/framing after shakeclear. Canonical base-eye selection and
  basis calculation are now shared internally; framing uses the unshaken base,
  while public rendered eye/getBasis preserve additive shake and obstruction.
  Root independently reproduced the RED and confirms repaired residual0 oncb4e.
- cb4e native191150317: after ordinary Move Object and Restart, Stop leaves the
  runtime position8 instead of restoring savedauthor0. Restart's runtime survivor
  position is intentional; Stop's authoring leak is not. The shared recovery
  baseline is overwritten on each level preparation. Two actual-source cases
  reproduce Restart and A→B→A corruption while runtime Game Save remains correct.
  Earlier074/077 restoration is reopened; session/per-level authoring protection
  and independent Project Save/export views now pass five actual-source tests.
  Original baselines survive repeated preparation; dependency collection also
  reads independent original level views. Runtime Game Save is unchanged.
  The writer is closed; fresh integrated qualification and native acceptance
  must retain the strict Stop assertion, not redefine runtime Restart to hide it.

See qualification/phase-108/infeasible-acquisition-red.json and
refused-blend-acquisition-red.json and shake-framing-red.json. Root independently verified focused API11,
host8, refusal10, prior10116 and prior10720 PASS on repaired74d1. The two later
endpoint cases were added after repair and are not called prepatch RED executions.

Earlier browser attempts185813881 and185920303 stopped while locating controls
inside collapsed/remounted native details. They are preserved harness navigation
failures, not collision/framing product verdicts. Native details navigation was
repaired only in the qualifier. Fresh native evidence is still required.

## Qualification history and final gates

Final full193932004 passed all8 on matching6a1497 start/final, including integrated
suite,28 catalog builds,both sites,519syntax/40JSON/diff. Final native campaigns:
194202070 main39,194231085 perspective8,194248190 diagnostics5,194302328
rollback14 and194319834 session8; all same6a1497 and empty page/console/external
arrays. Root independently recomputed576 orthographic/288 perspective corners
again, inspected the actionable Near/Far warning screenshot and read six final
source/Editable liveB/Stop/reopened projects. No padding/depth violations; original
positions/references and uniquely destroyed mesh dependency remain intact.

The earlierbec442 compatibility run passed prior106native35+geometry6/input117
and sustained wall/restart input in Arsenal Run,Relic Frontier,Dungeon Descent
and Survival Arena, with no independently observed penetration or browser error.
Afterward only creator diagnostic wording and capability documentation changed;
full8 and all five108 campaigns were repeated. This is not new final-fingerprint
all28 gameplay acceptance. Public probe's historical characterization label is
not promoted into a standalone collision verdict.

Visible raw-code193551050 was a real creator-help gap, not a solver failure.
The host now translates stable public fit codes into actionable explanations
without changing settings, repeated-notification ownership or public API codes.
Permanent actual warning test preserves options/Camera and covers clearing.
Earlier open-gate notes below are retained as chronology, superseded only by
the final evidence above.

Fresh integrated192432771 passed all8 gates, syntax519/JSON40,28 builds and both
sites on unchangedbec442 start/final. Native main192654244 passed39, perspective
192734636 passed8, diagnostics193101283 passed5, rollback192920105 passed14 and
cross-level session193113208 passed8. Root independently recomputed576 ortho and
288 perspective corners: max NDC disagreement6.25e-8/4.12e-8, no padding or depth
violations. Root read all six source/Editable liveB/Stop/reopened project files:
original positions, destroyed object and unique mesh asset, and target references
remain authored, independently of live Game Save. All browser error/external
arrays empty. Bounded previous Camera/input/public-family compatibility remains
OPEN; these successes alone do not authorize the tracker transition.

The74d1 integrated8 run predates the third defect; cb4e integrated8 passed but
native Stop-after-Restart exposed the fourth. Neither qualifies the outstanding
authoring restoration repair. Required fresh integrated and native
gates include authoring, history, independent duplication and Prefab reference
remapping, Save/reopen, exact Editable/Playable and built-site output, independent
rendered-corner projection, portrait/landscape aspect, moving targets, lifecycle,
diagnostics, real Change Camera refusal and exact Scene View return. Root must
review raw proof and screenshots before this phase can qualify.

## Intentional boundaries

Fixed-only framing is not a new Chase group controller. Chase obstacle clearance
remains the separate106 policy; group fits do not promise obstacle clearance or
full-frustum geometry avoidance. Terrain, Tilemaps, skinned meshes, ramps and
billboards are not accurately fitted by this bounded initial policy. No raw-ID
free typing, Custom Script requirement, public Game29, future109 implementation,
deployment, new all28 acceptance or final gameplay soak is claimed.
