# Phase056 — Local variables and scoped variables in graphs

COMPLETED, 2026-10-09. Exact authoritative title; no expanded tracker prompt linked. Derived
bounded product contract: creators define named typed variables and select them
from Graph read/write nodes without raw IDs or Custom Script.

Scopes: Local (one invocation, retained across its Delay, isolated across overlap),
Object (existing owning item.variables), Game (existing session __gameState).
Explicit scope labels/help warn when sharing is intentional. Fresh Play resets
session state as before; local state never enters project records. Definitions/
starting values persist through history, duplication, Prefab capture, Save/Load
and Editable/Playable. Object writes preserve fresh-Play authored baseline.

Read/write types use Phase055 pins and validation; no silent cross-type cast.
Use existing canonical object-variable state/actions; don't replace legacy counters,
flags or typed graph flow. Scope IDs are stable while names are creator-facing.
Missing definitions, duplicate identities/keys, invalid defaults and wrong runtime
types fail safely with understandable diagnostics. Bounded variable count.

Qualify actual runtime ownership/overlap/Delay isolation, no runtime serialization,
native named authoring, rename/deletion recovery, all scopes, history/persistence/
exports/restart and proportional cost/full regression. Functions/macros remain057.

Native acceptance reopened the shared Play/Stop variable lifecycle: capture current
Inspector-authored Object values at Play and restore them on Stop before saving.
Runtime state does not become authored state merely because the creator tested it.
