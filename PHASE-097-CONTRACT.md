# Phase 097 — Input prompts that auto-switch by device

COMPLETED. Exact authoritative title;096 qualified before implementation.
Extend the canonical085 Action Prompt and093 mappings, not a separate binding
store, input poller, vendor glyph pack or script workflow.

## Creator and compatibility contract

HUD Action Prompt exposes a readable Binding display choice: Keyboard/mouse
(historical default) or Last used device. Missing deviceMode preserves085
semantics. New automatic option is explicit, history-backed and portable through
Save/reopen, duplication, UI templates/Prefab and exact Editable/Playable.
Author preview is deterministic using authored keyboard/mouse defaults, never
recent editor activity or local player overrides. Unknown/future prompt values
remain retained and visibly unavailable, not silently rewritten.

## Runtime contract

One transient last-used-device fact in existing Input transport, defaulting to
keyboard/mouse at Play lifecycle. Real keyboard/mouse, accepted touch controls
or look, and meaningful gamepad edges/changed axes update it. Connected idle pads,
noise within effective095 deadzone and repeated simulateKeyDown polling do not
steal ownership. Source leases/Pressed and canonical gameplay remain unchanged;
no new polling loop or persisted last-device preferences. Clear/Stop/restart
remove stale transient ownership; disconnect must not retain misleading pad
guidance. Pause/Close retain existing navigation semantics.

Automatic prompts resolve actual093 configured gamepad/touch sources by Action,
not internal virtual codes or fabricated vendor names. Readable standard button/
axis guidance, bounded by existing source limits. Missing, disabled, malformed
current-device mappings are honestly unavailable; no misleading keyboard fallback.
Keyboard/mouse prompts continue respecting effective local rebinds during Play.
Explicit gameplay Actions and legacy raw-key Conditions are unchanged.

## Gates

Permanent pure resolver and actual transport/poll tests for ownership, idle/noise,
shared leases, disconnect/reconnect, lifecycle and missing mappings. Native
creator option/history/Save/reopen/template reuse and real keyboard/mouse→touch→
keyboard switching in Source and both exact exports. Gamepad real-poll fixtures
are separate from physical hardware acceptance, which remains unavailable.
Prior095/096 and input/HUD regressions plus normal integrated builds/sites/
syntax/JSON/diff on final source. No098 joystick/layout or099 conflict work.
