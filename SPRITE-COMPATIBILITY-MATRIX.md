# Sprite Compatibility Matrix

| Source form | Texture source | Sorting form | Load behavior | Canonical save | Loss policy |
|---|---|---|---|---|---|
| Phase 011 / Sprite Renderer v1 | direct `sourceTexture` | integer `layer` | Preserved; layer migrates | v3, Default layer ID + Order in Layer | No visual-order or geometry loss |
| Phase 012 / v2 | `spriteAssetRef` with direct Texture fallback | old integer `layer` | Asset ID preserved; layer migrates | v3 stable layer ID + order | No asset, size, pivot, tint, or order loss |
| Phase 013–015 / v3 | Sprite Asset preferred | stable `sortingLayerRef` + `orderInLayer` | Used directly | deterministic v3 | No canonical field loss |
| Phase 016 linked Sprite instance | shared Sprite Asset ID | stable layer ID | Prefab link and parameter overrides survive | same shared record path | No authoring-link loss |
| Newer component version | preserved record | preserved as supplied | Loaded inertly | preserved, not downgraded | Warning; repair/upgrade required |
| Missing Sprite Asset | dangling stable ID | unchanged | Project remains loadable; placeholder policy applies | offending ID retained | Error with object/prefab and field context |
| Sprite Asset missing Texture | Sprite Asset retained | unchanged | Asset remains inspectable/repairable | source Texture ID retained when supplied | Error with asset and field context |
| Missing Sorting Layer | unchanged | dangling stable ID | Phase 013 runtime fallback order | offending ID retained | Error; never map by display name |
| Editable Export | complete project data | complete registry | Reopens in editor | same project representation | Prefab semantics retained |
| Playable Export | dependency-pruned project | used registry | Same renderer/runtime path as Play | authoring UI not required | Used Sprite→Asset→Texture chain retained |

Copy/paste is not listed as supported because the editor has no existing object clipboard workflow. Phase 016 does not introduce one solely for Sprite.
