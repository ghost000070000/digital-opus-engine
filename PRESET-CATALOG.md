# Gameplay Preset Catalog

Phase 008 ships seven bounded presets. Each configures a selected ordinary scene object; none adds a new runtime system.

| Preset | Category | Parameters | Ordinary output | Existing runtime capability |
|---|---|---|---|---|
| Collectible | Pickups | Counter/item name; destroy on collect | On Enter → Increment Counter; optional Destroy Object; visible pickup styling | Behaviors, counters, overlap events, object destruction |
| Checkpoint | World | Checkpoint-pad appearance | On Enter → Set Checkpoint; optional visible styling | Behaviors and existing checkpoint/respawn state |
| Damage Zone | Hazards | Damage; cooldown | On Enter → Damage Player | Damage Player action and its cooldown |
| Opening Door | World | Axis; distance; duration | Solid flag; On Enter → Move To tween targeting the same object | Solid collision, overlap event, Move To action |
| Moving Platform | Movement | Axis; distance; one-way duration | Editable ping-pong position clip; On Start → Play Animation; Solid flag | Property animation and Play Animation action |
| Basic Enemy | Characters | Speed; detection radius; health; contact damage; cooldown | Follow AI; enemy tag; Health Component; On Enter → Damage Player | Existing follow AI, component Health, tags, damage action |
| Spawn Point | World | Make default spawn | `isSpawnPoint` and `isDefaultSpawn` fields; visible marker styling | Existing spawn resolution |

All seven are eligible for `scene-object` targets (`kind: cube`). Search also matches stable IDs, categories, and descriptions.

## Deliberate exclusions

- **Health Pickup** remains an older palette convenience, not a registry preset in this bounded first catalog. Collectible proves optional self-destruction and Basic Enemy proves Health Component composition.
- **Audio Zone** and **Fog Zone** were not added merely to raise the count. AFR-0017 remains open until each underlying zone workflow receives a dedicated live capability and validation audit.
- **Pickup Item** with Inventory, generalized item definitions, sound/effect references, and richer UI is excluded because those cross-project dependencies need a stronger reference/validation contract.
- **Projectile Starter** is a prefab starting object rather than a gameplay role applied to an existing object.
- No new engine feature, Custom Script, opaque preset runtime, or Preset Prefab format was introduced.

The older drag-in object shortcuts remain available for compatibility. The Phase 008 searchable browser is the authoritative extensible registry path for new creator-facing gameplay recipes.

