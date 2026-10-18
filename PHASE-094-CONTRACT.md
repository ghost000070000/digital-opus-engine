# Phase 094 — Player rebind screen generator

COMPLETED; frozen evidence in PHASE-094-REPORT.md. Exact authoritative title.
Reuse the canonical Controls screen,
Input Action identities, effective binding path and local SettingsManager.

## Proven prerequisite

Native RED rebind-generator-browser-20261010T115459616Z: distinct imported/saved
projects A/B on one origin; A rebinds Interact to K, B authored F but inherited K,
and real K fired B's interaction. Actual-source6790b2 also reproduces custom-ID
aliasing. Preserve original global inputOverrides data; do not automatically
attribute ambiguous historical preferences to a project. Scope ONLY this local
preference subkey, not audio/quality. Tell players historical unscoped bindings
remain stored but must be rebound once for this project.

## Ownership and portability

Project-level playerPreferenceScope is a version1 identity record, independent of
level authoring/history and never contains player preferences. New blank/starter
projects receive fresh local UUID identities. Historical projects without an
identity deterministically derive a SHA-256 scope from the original imported
project payload once, then persist it through Save/Editable/Playable. Same
project and its exports share preferences; independently created projects do
not. Copies retaining identity intentionally share it; later project-management
fork workflows may expose explicit identity regeneration. Invalid/future scope
records are retained, not overwritten; persistence unavailable rather than
falling back to the global key. No uploads/accounts/new services.

## Creator capability

UI tab exposes Generated Controls: enabled, title, explanatory text, launcher
label, Save configuration, Reset and read-only Preview. Version1
PlayerRebindScreen record lives under per-level ui.rebindScreen; absent means
historical enabled Controls/title/launcher defaults. Unsupported/future records
retained visibly unavailable. Named generated rows reuse current controller
membership/custom Actions and default key labels; no raw IDs/config editing.
Preview shows defaults only, cannot capture input/write player prefs/pause Play.
Valid changed Save/Reset produces one independent Undo entry; no-op/invalid none.
Level duplication and project Save/reopen keep authored config. HUD templates
retain their Open Controls launcher Action, not unrelated level-screen settings.

Runtime uses existing Controls overlay with authored escaped title/text and
launcher label. Enabled gates Main/Pause and new Open Controls Action. The Action
is canonical ACTION_TYPES, reusable by existing HUD Button/behavior UI, not a
new runtime. Acquire/release existing controls pause owner; preserve preexisting
pause and other screen owners. Close/Escape/Stop/level/reset cancel capture.
Keyboard/mouse player rebinding changes local preferences only; Reset restores
author defaults, never erases another project. Device source authoring remains
093, not player gamepad/touch rebinding. No095 tuning/096 context/097 dynamic
prompts/098 layout/099 diagnostics extension.

## Qualification

Pure strict bounded schema/identity/SHA known vectors, actual-source Controls
generation/history/preview/capture/local preference isolation/pause ownership;
native creator Save/Undo/Redo/reopen, actual keyboard/mouse rebind/reset and
actual gameplay input, distinct-project preference isolation, restart lifecycle;
exact Editable/Playable and prior091–093 browser plus ordinary integrated,
engine/catalog/sites/syntax/JSON/diff gates. No phase advancement before final
frozen evidence; no mandatory multi-hour soak for this thin shared-screen adapter.
