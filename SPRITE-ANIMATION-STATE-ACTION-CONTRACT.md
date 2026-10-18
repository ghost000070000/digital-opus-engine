# Sprite Animation State Action Contract

`Set Sprite Animation State` is one entry in the shared `ACTION_TYPES` vocabulary. Behaviors, Node Graph action nodes, and Sequence action steps therefore execute the same implementation.

The Action owns three explicit fields:

- `targetId`: an Object reference. Empty means Self where a caller has object context.
- `stateId`: a dynamically resolved stable local ID from the target Sprite Renderer; the UI displays the state name and ID.
- `restartIfActive`: a boolean that opts into restarting the already-active state.

The Action stores no clip name, clip ID, state display name, script, or expression. Renaming a state is safe because the stored ID is stable. Deleting the target state preserves the broken ID and Project Validation reports it. Missing targets, non-Sprite targets, missing state IDs, and state IDs absent from the target renderer are actionable errors. Runtime dispatch is inert rather than throwing when broken authoring data reaches Play.
