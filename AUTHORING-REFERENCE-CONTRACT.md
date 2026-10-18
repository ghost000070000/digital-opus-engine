# Digital Opus Authoring Reference Contract

## Scope

`editor/src/00-authoring-plumbing.js` provides one authoring-only reference service and index for structured project relationships. It never interprets Custom Script, dialogue prose, arbitrary strings, or unknown extension/plugin data.

## Descriptor

A schema or existing structured action field can declare:

| Property | Meaning |
|---|---|
| `referenceType` | `asset`, `object`, `level`, `objective`, or `prefab` |
| `required` | Empty is a validation error when true and not nullable |
| `nullable` | Empty is an intentional value |
| `allowedAssetTypes` | Restricts an asset reference to registered types |
| `allowSelf` | Includes/excludes the current object in object choices |
| `scope` | Currently supports `current-level` where appropriate |

Broken values are preserved. Validation never substitutes or clears a target.

## Option service

`getReferenceOptions(type, context, descriptor)` returns sorted `{ value, label }` choices. Values use stable object, level, objective, and asset IDs. Prefabs retain their current name identity. Labels use creator-facing names/titles. Asset options unify the existing Mesh, Texture, and Audio collections and honor `allowedAssetTypes`.

The schema renderer and existing Action field renderer both call this service. Existing collections remain authoritative; there is no second picker or asset store.

## Reference index and issues

`buildReferenceIndex(project, options)` inventories levels, objects, objectives, prefabs, and assets, records supported schema/action/direct usages, detects duplicate prohibited identities, and identifies required, dangling, and wrong-asset-type references.

Only structured fields are indexed: registered component reference fields and explicitly adapted existing fields such as Action targets, level/objective/prefab choices, asset references, parent IDs, AI target/path/prefab fields, Spawner prefab, ambient/UI audio, and supported Sequence actions.

An issue retains `scope`, `levelId`, `objectId`, `componentId`, `field`, `referenceType`, and `referenceValue`, allowing the editor to navigate without retaining arbitrary project objects in the issue payload.

## Rename behavior

| Resource | Classification | Behavior |
|---|---|---|
| Objects | A — stable ID | Display-name edits need no propagation. |
| Levels | A — stable ID | Name edits preserve ID references. Legacy level-name fallbacks remain compatibility-only. |
| Objectives | A — stable ID | Title edits preserve objective IDs. |
| Mesh/Texture/Audio | A — stable ID | Rename changes labels only. |
| Prefabs | C/B boundary — name identity | Existing references are name-based. There is no general Rename Prefab command; Save with an existing name updates that prefab. |
| Free-typed legacy strings | C | Not guessed or rewritten. |
| Custom Script/dialogue prose | D — deliberately unindexed | Never searched or rewritten. |

`propagateStructuredRename` is the bounded propagation primitive for a future explicit rename command: it updates only supplied typed usage owners and keys. It does not search JSON or prose. Current stable-ID resources do not need it; prefab identity remains documented migration pressure.

