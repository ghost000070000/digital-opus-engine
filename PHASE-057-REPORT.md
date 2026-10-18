# Phase057 — Reusable graph functions/macros

COMPLETED, 2026-10-09. Qualified fingerprint:
8aeba21a9d1bb8b4a3eb2ecacd85ad3f0e9bb407561a85398f8da251923f0d19.

Creators publish named project-local Functions from editable graphs, choose them
from Call Function nodes, and edit one shared definition for multiple callers.
Calls use existing canonical Action/Condition/value execution. Each call has its
own Local values; Object means caller Self; Game remains shared. A callee Delay
waits before caller continuation. Iterative call/return avoids JS stack growth;
depth8, recursive-identity rejection and shared2000 work bound protect gameplay.
Missing/recursive dependencies are diagnosed without deleting saved call data.

Library changes have independent history, explicitly disclosed. Nested definition
editing retains the parent draft; removal cannot orphan an actively edited
definition. Save resolves the current definition identity instead of writing a
stale pointer after history changes. Definitions persist in full project/history/
Tilemap transaction snapshots and exact Editable/Playable assemblies. Canonical
dependency collection includes Function-only Audio and Prefab references, even
currently uncalled authored definitions. No competing scripting/runtime system.

Permanent tests run the actual graph runner and Delay scheduler: two callers,
independent locals3/9, waiting return flow, repeated call-cycle work bounds,
recursion/missing-reference validation and editing-draft protection. Actual
canonical dependency collector regression proves Audio/Prefab retention.
Native functions-browser-20261009T214836724Z16 observations pass: publish/reuse,
edit-once/two-call effects, independent duplicated owner, Delay/return, library
UndoRedo, parent draft, protected definition, Prefab capture, missing-definition
Undo recovery, Save/reload/Editable/Playable.0page/console/external requests.
Filtered native screenshot reviewed. Earlier selector214423349Z and disclosure
214517743Z failures preserved separately; no product failure inferred.

Full regression-direct-20261009T214854534Z8 gates PASS: integrated suite, engine,
all28/both site builds,351JSsyntax/JSON/diff and matching start/final fingerprint.
Extra actual-source packaging regression passes after that suite run. Probe
215016544Z natively starts/drives/restarts all five mandatory high-risk games,
Dungeon Descent and Survival Arena: seven games/four families, post-restart
movement in every game,0page/console/external errors. Compatibility smoke, not
a new full collision route/soak verdict. Original frozen collision closure separate.

Limits: no typed argument/return pins yet; Local defaults and existing Object/Game
state configure reusable blocks. Definitions are project-local, not independent
cross-project Function bundles. Prefab capture plus full-project persistence
tested; external Prefab portability still requires its project definitions.
No runtime tracing059 or automatic graph migration060 claim. No changed games,
Game29, commit/push/deployment. Continue058 automatically.
