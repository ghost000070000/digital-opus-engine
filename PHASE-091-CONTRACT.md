# Phase091 — Input Action asset editor

IN PROGRESS. Exact authoritative title preserved; adjacent092 controller-specific
sets and093 device-mapping authoring remain separate. Derived executable contract
from the original roadmap/master no-code product vision, not invented numbering.

Existing author inputActionMap remains the binding store; existing app.input and
effectiveInputMap remain runtime transport/override paths. Add bounded versioned
project-local logical Action assets with stable IDs and readable name/description.
Protected built-ins remain discoverable and compatible. Custom IDs are not free
typed; names may change without breaking references. Preserve unsupported future
records, but do not execute them. Do not leak player overrides into authored data.

Asset create/rename/description/delete/default binding mutation participates in
history, Save/Load, Editable and Playable. References are project-local, including
in Object Prefabs; missing/deleted actions remain explicit and fail closed. Expose
custom Actions in existing HUD prompts and a canonical typed inputActionRef field.
Add Input Action Pressed/Held Conditions to the existing graph condition registry
and evaluator; On Update plus ordinary gate/Action proves useful no-code gameplay.
No separate polling loop, no controller ability automatically invented by naming
an Action. Invalid input/missing reference must not become true through NOT.

Use current real keyboard capture to set a default and warn on intentional shared
bindings. Full per-device mapping/gamepad/touch UI and controller sets are093/092,
not prerequisites to claim all those later capabilities in091. Fix misleading
existing help saying movement keys remain fixed while rebind controls are visible.

Gates: preserved actual-source/native RED, stable-ID rename, invalid/future/deleted
record safety, one-history operations, Save/reopen, exact both exports, no-code
pressed/held input response, distinct author default/player override and reload
lookup, built-in compatibility, local Prefab reference preservation, prompt picker,
permanent regression and proportional prior browser/full regression. No Script,
Game29 or publication. A record-only asset list is not phase qualification.
