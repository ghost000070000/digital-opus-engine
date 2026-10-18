# Phase 043 baseline characterization

- Repository: `main` at `f1dc3516b585ebf5aa868006792c1dc1b9039da9`; the existing worktree is dirty and is preserved.
- Phase 041 qualified passive Box/Circle Collider 2D world shapes and overlap queries. Phase 042 qualified separate Trigger Collider 2D lifecycle, `73/73` focused assertions, `1,915` Phase 011–042 assertions, and `2,277` integrated assertions.
- Baseline `node build/build.js`, `node tests/run-tests.js`, and `node build/build-games.js` pass. Engine bundle: 168,984 raw bytes, 43,457 gzip bytes, 22 sources. Public catalog: 28 games.
- `engine/src/03-time.js` supplies `dt` in seconds and clamps it to 0.1 second. The editor's main `app.onUpdate((dt, elapsed) => ...)` in `editor/src/01-editor.js` runs only during Play and does not run while paused.
- The main update moves existing gameplay objects, then calls `updateHierarchyTransforms()`, then `trigger2DManager.tick(...)`. Body integration belongs between hierarchy resolution and Trigger 2D evaluation, with a second hierarchy resolution after Body commits parented movement.
- The scene object list is `placed`; `addPlaced`, `removeItemFromScene`, and `loadScene` are the insertion, deletion, and reload seams. `entity.position` is the live world Transform, while a parented object's `localPosition` is the authored local Transform. `resolveWorldTransform` recomposes world fields from the parent each hierarchy pass.
- Play start and Stop reset the Trigger pair manager. The editor currently keeps placed objects live across Play/Stop; Body movement will require a bounded authored Transform snapshot/restore so simulation motion does not leak into edit content.
- Current exported Editable and Playable pages embed the same editor/runtime source through `build/export-template.js` and the site/game build pipelines. Phase 043 must add its module to all of those lists.
