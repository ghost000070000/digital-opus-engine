# Game Elevation Friction

This is evidence from the 28-game elevation campaign, not a Wave 10 roadmap.

| Recurring limitation | Games affected | Exact symptom | Workaround / authoring result | Shared engine fix justified? | Status |
|---|---|---|---|---|---|
| Opening camera composition depends on authored spawn/yaw | Several third-person games, especially Foglight and Forest Range | Large foreground forms can occlude a new landmark | Positioned non-solid landmarks forward and offset from spawn; reviewed rendered contact sheets | No; authoring solved most cases | Deferred per-game camera polish |
| Small levels exhaust prop vocabulary quickly | Assembly Line, Dungeon Descent, Shifting Facility, Temple Switch Puzzle | Repeated cubes/modules weaken identity | Added unique silhouette, material split, color grade and ambient bed | No; asset/content issue | Improved, residual noted |
| Dark facility readability | Signal Relay, Silent Sector, Blacksite, Signal Zero | Distant geometry merges into a single value band | Emissive routes, landmark key lights and differentiated sky grades | No; lighting authoring was sufficient | Improved |
| Trigger colliders may belong to visible actors | Survival Arena 3 | Naive helper audit flags a spawned enemy because its damage volume is a trigger | Evidence now excludes tagged gameplay actors while retaining marker checks | No; audit distinction was the correct fix | Solved in validation |
| Normal-route reliability can lag technical correctness | Opus Arena, Survival Arena | A game can build and smoke cleanly without a repeatable normal win | Kept both Internal and preserved explicit gaps | No; game tuning/content decision | Deferred; blocks promotion only |
| Standalone assets are embedded per game | All 28 | Richer art raises individual HTML size | Existing dependency pruning retains only referenced assets | No streaming work allowed or warranted here | Controlled |
