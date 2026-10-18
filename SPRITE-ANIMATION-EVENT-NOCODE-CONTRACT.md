# Sprite Animation Event No-Code Contract

`On Sprite Animation Event` is a dedicated source in the existing Behavior vocabulary. Its picker stores a stable `{ targetId, clipId, eventId }` triple while showing creator-facing Object, Clip, event, and frame names.

Matching is exact and target-specific; wildcard listeners are intentionally unsupported. When a match occurs, the listener runs through the ordinary Behavior action path. A listener can therefore launch any established action, a Node Graph, or `Play Sequence` without embedding actions in Clip data.

Validation reports missing/ineligible targets, Clips not assigned to the target Sprite's named states, missing Clips, and missing events. Clip/event deletion warns when listeners exist. Save/Load, Prefab cloning, object duplication, level duplication/remapping, Editable export, and Playable export preserve references.

This phase does not add generic signals, payload schemas, arbitrary callbacks, transition graphs, or a second action language.

