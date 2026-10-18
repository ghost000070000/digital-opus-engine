# Phase060 — Graph versioning/migration and clean serialization

COMPLETED after059; see PHASE-060-REPORT.md. Exact authoritative title; expanded tracker prompt absent.
Characterize actual historical graphs first. Canonical versioned graph persistence
must preserve historical node/edge order, IDs, positions, parameters, unknown data,
typed Variables and Function references. Migration deterministic, copy-based,
idempotent and non-destructive; no new dispatcher or silent topology rewrites.

Creator-readable schema/version diagnostics, clean authored serialization without
runtime scopes/trace/Delay state, compatibility across history/duplicate/Prefab/
SaveLoad/Editable/Playable and actual historical gameplay required. Unsupported
future versions must remain recoverable, not downgraded merely by browsing/saving.
Bound malformed input safely without hiding it behind invented defaults. No mass
public-content rewrite simply to stamp a version. Real browser gates, actual-source
regression and epoch-boundary integrated no-code creator review before061.
