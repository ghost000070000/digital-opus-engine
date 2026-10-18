# Authoring Vocabulary Audit

## Audit basis

The audit reads the current editor metadata and opens Arsenal Run's Behavior, Visual Graph, Sequence, Inspector, and Palette surfaces in Microsoft Edge. Stable IDs are compared with displayed labels; runtime and serialization behavior are treated as compatibility boundaries.

## Current inventory

| Vocabulary | Current authority | Count | Finding |
|---|---|---:|---|
| Components | `OpusAuthoring.registry` plus canonical component metadata | 3 | `health` / Health, `trigger` / Trigger Volume, `particle-emitter` / Particle Emitter agree on noun labels. |
| Actions | `ACTION_TYPES` | 87 | One shared label/field authority already feeds Behavior, Graph, Sequence, HUD actions, item actions, and Animation Events. Phase 005 adds ID/category/help/alias metadata without moving execution. |
| Behavior Events | `OpusAuthoringLanguage.EVENTS` | 6 | Stable IDs remain `click`, `enter`, `exit`, `start`, `stay`, `interact`; every displayed label now starts with On. |
| Graph Conditions | `GRAPH_NODE_TYPES` enriched by canonical condition metadata | 27 | Historical node IDs remain intact; labels now read as states/questions. Scoped metadata prevents collisions with other condition surfaces. |
| AI Conditions | `AI_CONDITION_TYPES` plus canonical condition metadata | 9 | Raw camelCase IDs are no longer shown as the creator label. |
| Dialogue Conditions | Existing saved IDs plus canonical labels | 7 gated choices plus Always Show | Shared conditions use the same Flag, Health, Counter, and Has Item wording as Graph. |
| Graph action nodes | Generated from `ACTION_TYPES` | 86 shared Actions plus graph-only Delay / Wait | No separate graph Action label map exists. Custom Script remains excluded intentionally. |
| Sequence step types | Generated from `ACTION_TYPES` plus Delay / Wait | 87 shared Actions plus Delay / Wait | Shared Action labels and fields are identical to Behavior and Graph. |
| Palette entries | `PLACEABLE_TYPES` / `PALETTE_LABELS` and matching markup | 24 | Objects and gameplay-role Presets remain distinct groups. |
| Presets | Canonical preset metadata over existing palette IDs | 8 | Collectible, Health Pickup, Damage Hazard, Checkpoint, Sliding Door, Enemy, Moving Platform, Projectile Starter. |
| Inspector | Existing section markup and three schema-rendered Components | existing surface | No structural rewrite; roadmap annotations were removed from visible labels. |

## Conflicts found and normalized

| Conflict | Canonical creator label | Stable ID retained | Compatibility |
|---|---|---|---|
| Billboard could be mistaken for true Sprite support | World-Space Billboard | `billboard` | Label-only clarification. |
| Camera Shake was a noun phrase used as an Action | Shake Camera | `cameraShake` | Camera Shake alias retained. |
| Boost Pad described an Object while used as an Action | Apply Boost | `boost` | Boost Pad alias retained. |
| Relative implementation details leaked into Action names | Move Object / Rotate Object | `moveObject` / `rotateObject` | Prior labels retained as aliases. |
| Show/Hide Object combined two verbs ambiguously | Set Object Visibility | `setVisibility` | Prior label retained as alias. |
| Cutscene and Zone parentheticals over-specialized reusable Actions | Freeze Player / Set Ambient Audio | `freezePlayer` / `setAmbientAudio` | Prior labels retained as aliases. |
| Spawn Once lacked its owning context | Spawn Once from Spawner | `spawnOnceFromSpawner` | Prior label retained as alias. |
| Clear Save was terse and object/action ambiguous | Clear Saved Game | `clearSaveGame` | Prior label retained as alias. |
| Count Tagged Into Counter exposed implementation shape | Count Tagged Objects | `countTagged` | Prior label retained as alias. |
| Advanced: Custom Script was classification-first rather than verb-led | Run Custom Script | `script` | Prior label retained as alias. |
| On Enter / Exit / Stay did not identify trigger semantics | On Trigger Enter / Exit / Stay | `enter` / `exit` / `stay` | Prior event labels retained as aliases. |
| AND, OR, NOT and comparison symbols read as implementation operators | State-style phrases such as All Conditions Are True and Counter Is At Least | existing graph node IDs | Historical labels retained as aliases. |
| Is Flag True / False varied across Graph and Dialogue | Flag Is Set / Flag Is Clear | `isFlagTrue` / `isFlagFalse` | Historical labels retained as aliases. |
| Door and Projectile did not clearly identify composed Presets | Sliding Door / Projectile Starter | `door` / `projectilePreset` | Door and Projectile retained as aliases. |
| Wave/Priority annotations appeared in Inspector and Project labels | Plain capability names | every DOM/control ID | Twenty-four creator-facing annotations removed; comments/history remain in source. |

## Intentional distinctions

- Object is scene identity; Component is attached capability; Preset is a configured composition.
- Event starts logic; Condition observes; Action requests change.
- Behavior is compact local reaction; Sequence is ordered/time-based; Visual Graph is branching/state orchestration.
- Variable stores state; Signal is reserved communication terminology and is not implemented yet.
- Play Sound is the Action label. Play Audio remains a lookup/search alias for the stable `sound` ID.
- Graph Delay / Wait is intentionally graph-specific because it is a sequencing primitive rather than an executable `ACTION_TYPES` operation.
- The same legacy Condition ID may be scoped separately for Graph and AI metadata when its meaning differs. Saved IDs are not renamed.

## Compatibility result

No stable Action, Event, Condition, Component, Palette, or Preset ID changed. Existing project JSON, Prefabs, graphs, sequences, animation events, and exported games continue resolving their old identities. The new language module is embedded into both Editable and Playable exports.
