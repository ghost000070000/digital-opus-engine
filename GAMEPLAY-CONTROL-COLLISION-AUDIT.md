# Gameplay Control and Collision Audit

Generated 2026-09-20T22:13:36.287Z. This is a reusable source and real-browser audit for all 28 shipped games. It intentionally qualifies existing movement and collision systems; it does not introduce Phase 041 physics authoring.

| Game | Controller | Speed | Accel | Bounds | Solids | Depth | Source gate | Browser gate |
|---|---|---:|---:|---|---:|---|---|---|
| Forest Range | thirdperson | 6.5 | 30 | yes | 3 | standard | PASS | PASS |
| Arsenal Run | firstperson | 6.5 | 42 | no | 30 | deep | PASS | PASS |
| Power Grid | firstperson | 6 | 40 | no | 17 | deep | PASS | PASS |
| Moving Temple | thirdperson | 6.5 | 30 | yes | 8 | standard | PASS | PASS |
| Foglight | thirdperson | 6.5 | 30 | yes | 25 | standard | PASS | PASS |
| Relic Frontier | thirdperson | 6.5 | 30 | no | 14 | deep | PASS | PASS |
| Relic Island | thirdperson | 6.5 | 30 | no | 4 | standard | PASS | PASS |
| The Sanctum Key | thirdperson | 6.5 | 30 | yes | 5 | standard | PASS | PASS |
| Relic Runner 2 | thirdperson | 6.5 | 30 | yes | 9 | standard | PASS | PASS |
| Valley Run | thirdperson | 6.5 | 30 | yes | 0 | standard | PASS | PASS |
| Painted Wilds | thirdperson | 6.5 | 30 | yes | 4 | standard | PASS | PASS |
| Textured Adventure | thirdperson | 6.5 | 30 | yes | 4 | standard | PASS | PASS |
| Temple Switch Puzzle | thirdperson | 6 | 28 | yes | 3 | standard | PASS | PASS |
| Signal Relay | firstperson | 6 | 40 | no | 26 | deep | PASS | PASS |
| Silent Sector | firstperson | 5.5 | 40 | no | 20 | deep | PASS | PASS |
| Iron Arena | firstperson | 6 | 40 | yes | 11 | standard | PASS | PASS |
| Opus Arena | thirdperson | 6.5 | 30 | yes | 11 | standard | PASS | PASS |
| Power Station | thirdperson | 6.5 | 30 | yes | 6 | standard | PASS | PASS |
| Assembly Line | firstperson | 6 | 40 | yes | 7 | standard | PASS | PASS |
| Blacksite | firstperson | 6 | 40 | yes | 16 | standard | PASS | PASS |
| Shifting Facility | firstperson | 6 | 40 | yes | 9 | standard | PASS | PASS |
| Signal Zero | thirdperson | 6 | 28 | yes | 8 | standard | PASS | PASS |
| Dungeon Descent | topdown | 6 | 24 | yes | 15 | standard | PASS | PASS |
| Sentinel Maze | thirdperson | 6.5 | 30 | yes | 8 | standard | PASS | PASS |
| Survival Arena | hovercraft | 6 | 28 | yes | 4 | standard | PASS | PASS |
| Survival Arena 2 | hovercraft | 11 | 10 | yes | 8 | standard | PASS | PASS |
| Survival Arena 3 | hovercraft | 11 | 10 | yes | 9 | standard | PASS | PASS |
| Skyway Trial | thirdperson | 6.5 | 60 | no | 6 | standard | PASS | PASS |

## Deep audit selection

The five higher-risk games are Arsenal Run, Power Grid, Signal Relay, Silent Sector, and Relic Frontier. They combine pointer-lock look, dense solids, or absent authored bounds. Collision dogfood uses Arsenal Run, Signal Relay, and Relic Frontier.
