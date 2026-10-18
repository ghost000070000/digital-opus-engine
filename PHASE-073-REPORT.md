# Phase073 — Transform, Visual, Collider and Trigger components

COMPLETED. Final source03ddd1ceaf274e40321a364c83b1d3ac0d5c679db4d2e78ec3295d9b28e5fbd2.

Intrinsic Transform for Cube/Sprite and Visual for Cube join the existing concrete
registry (13 definitions). Existing controls and public engine fields are reused,
not duplicated. Transform records reflect world position/full XYZ degrees/scale;
legacy transform, hierarchy/local quaternion and Prefab placement fields remain
authoritative. No applyTarget/load override from copied component mirrors, so
duplicate and drop offsets cannot teleport back to capture positions. Visual keeps
legacy mesh/color/Texture/Material authority; native named Texture choice remains,
descriptor limits references to Texture assets. Sprite Renderer is the existing
2D Visual role. Existing Collider2D/Trigger2D and legacy Trigger roles remain;
legacy 3D solid/controller collision is not forcibly migrated to XY physics.

Observed product defects repaired with permanent regression:

- Unsupported future Health record99/current999 serialized as live legacy25.
  Newer records now bypass legacy merging; future data preserved, not executed.
- Native025706006Z core position4→2 then Tab+Undo left2 because untouched focus
  pushed a no-op snapshot. Core Cube/Sprite field sessions capture on first change.
- Native025815272Z parented requested world X3 reverted to2 next hierarchy tick.
  Requested world pose is captured before resolution, then existing parent/socket
  inverse math updates canonical local offsets/full quaternion/scale.

Permanent `tests/phase-073-core-components.test.js`: canonical non-overriding
placement/copy/Visual/future semantics, actual input-history helper and actual
commit/resolve source with public engine math across80 rotated/nonuniform parent/
socket frames and Cube/Sprite partition. Existing Phase002 exact registry expectation
expanded to concrete13; original ownership/copy/Prefab assertions retained. Integrated
field-help assertion caught missing descriptors and was satisfied, not weakened.

Final native030509486Z14 observations PASS: one existing control set, intrinsic
removal disabled, exact root field history, full rotation/nonuniform scale/tint,
parented position/rotation/scale across frames, native Collider fit, duplicate offset,
Prefab drop-position authority, Sprite drag/history/full Transform/parented edit/
Trigger2D attachment, exact Save/reopen and native Editable/Playable downloads and
rendered Play loops. No page/console/external errors. Core and Sprite screenshots
inspected in preceding030159006Z; final labels/ordering improve component context.

Final qualification COMPLETED on03ddd1ceaf274e40321a364c83b1d3ac0d5c679db4d2e78ec3295d9b28e5fbd2.
Full regression030520753Z:8 gates PASS,389 syntax checks,40 canonical JSON checks,
integrated suite,28 builds,both sites and diff checks; start/final fingerprint equal.
Prior071 registry030608644Z14 and072 workflow030618849Z11 native checks PASS.
Fresh public probe030707903Z:seven actual games started,moved,restarted natively and
moved again across all four controller families;zero browser/console errors.
Historical failed runs remain preserved and do not count as acceptance.

Limits: intrinsic adapters are currently Cube/Sprite Transform and Cube Visual;
other Object kinds retain existing specialized controls. Materials remain existing
authoring rather than a new material component. 2D shapes retain XY conventions;
not arbitrary3D collision conversion. Native field/Prefab/Play evidence, not a new
full gameplay soak or polished genre kit. Grade remainsB; no Game29/public changes.
