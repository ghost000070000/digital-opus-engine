# Gameplay Feel Test Matrix

Generated 2026-09-20T21:39:30.526Z. Every row is a fresh built standalone driven with native keyboard and mouse input. Runtime evaluation was read-only telemetry.

| Game | Controller | Movement | Camera/look | Pointer lock | Collision observation | Move/accel | Result | Notes |
|---|---|---|---|---|---|---:|---|---|
| Forest Range | thirdperson | WASD pass | controller camera | n/a | 3 solids; clear | 6.5/30 | PASS | W 4.81u; enemy 1.5–4 |
| Arsenal Run | firstperson | WASD pass | mouse axes pass | release/reacquire pass | 30 solids; clear | 6.5/42 | PASS | W 4.23u; enemy 1.2–3.2 |
| Power Grid | firstperson | WASD pass | mouse axes pass | release/reacquire pass | 17 solids; clear | 6/40 | PASS | W 3.90u; enemy n/a |
| Moving Temple | thirdperson | WASD pass | controller camera | n/a | 8 solids; clear | 6.5/30 | PASS | W 3.90u; enemy n/a |
| Foglight | thirdperson | WASD pass | controller camera | n/a | 25 solids; clear | 6.5/30 | PASS | W 4.45u; enemy 1.4–3 |
| Relic Frontier | thirdperson | WASD pass | controller camera | n/a | 14 solids; clear | 6.5/30 | PASS | W 3.49u; enemy 0.8–3 |
| Relic Island | thirdperson | WASD pass | controller camera | n/a | 4 solids; clear | 6.5/30 | PASS | W 3.80u; enemy n/a |
| The Sanctum Key | thirdperson | WASD pass | controller camera | n/a | 5 solids; clear | 6.5/30 | PASS | W 3.80u; enemy n/a |
| Relic Runner 2 | thirdperson | WASD pass | controller camera | n/a | 9 solids; clear | 6.5/30 | PASS | W 3.27u; enemy 3–3 |
| Valley Run | thirdperson | WASD pass | controller camera | n/a | 0 solids; clear | 6.5/30 | PASS | W 3.80u; enemy 2.5–2.5 |
| Painted Wilds | thirdperson | WASD pass | controller camera | n/a | 4 solids; clear | 6.5/30 | PASS | W 3.80u; enemy n/a |
| Textured Adventure | thirdperson | WASD pass | controller camera | n/a | 4 solids; clear | 6.5/30 | PASS | W 3.83u; enemy n/a |
| Temple Switch Puzzle | thirdperson | WASD pass | controller camera | n/a | 3 solids; clear | 6/28 | PASS | W 3.52u; enemy n/a |
| Signal Relay | firstperson | WASD pass | mouse axes pass | release/reacquire pass | 26 solids; clear | 6/40 | PASS | W 3.90u; enemy 1.1–3.2 |
| Silent Sector | firstperson | WASD pass | mouse axes pass | release/reacquire pass | 20 solids; clear | 5.5/40 | PASS | W 3.87u; enemy 1–3.4 |
| Iron Arena | firstperson | WASD pass | mouse axes pass | release/reacquire pass | 11 solids; clear | 6/40 | PASS | W 3.90u; enemy 3–3 |
| Opus Arena | thirdperson | WASD pass | controller camera | n/a | 11 solids; clear | 6.5/30 | PASS | W 3.80u; enemy n/a |
| Power Station | thirdperson | WASD pass | controller camera | n/a | 6 solids; clear | 6.5/30 | PASS | W 4.45u; enemy n/a |
| Assembly Line | firstperson | WASD pass | mouse axes pass | release/reacquire pass | 7 solids; clear | 6/40 | PASS | W 3.90u; enemy n/a |
| Blacksite | firstperson | WASD pass | mouse axes pass | release/reacquire pass | 8 solids; clear | 6/40 | PASS | W 3.90u; enemy n/a |
| Shifting Facility | firstperson | WASD pass | mouse axes pass | release/reacquire pass | 9 solids; clear | 6/40 | PASS | W 3.90u; enemy n/a |
| Signal Zero | thirdperson | WASD pass | controller camera | n/a | 3 solids; clear | 6/28 | PASS | W 3.52u; enemy 2.5–2.5 |
| Dungeon Descent | topdown | WASD pass | controller camera | n/a | 15 solids; clear | 6/24 | PASS | W 3.33u; enemy n/a |
| Sentinel Maze | thirdperson | WASD pass | controller camera | n/a | 8 solids; clear | 6.5/30 | PASS | W 3.16u; enemy 3.5–3.5 |
| Survival Arena | hovercraft | WASD pass | controller camera | n/a | 4 solids; clear | 6/28 | PASS | W 4.20u; enemy 1.65–1.65 |
| Survival Arena 2 | hovercraft | WASD pass | controller camera | n/a | 8 solids; clear | 11/10 | PASS | W 2.75u; enemy n/a |
| Survival Arena 3 | hovercraft | WASD pass | controller camera | n/a | 9 solids; clear | 11/10 | PASS | W 2.71u; enemy n/a |
| Skyway Trial | thirdperson | WASD pass | controller camera | n/a | 6 solids; clear | 6.5/60 | PASS | W 4.30u; enemy n/a |

## Shared regression coverage

- Standard mouse signs, invert-Y, sensitivity response, and repeated extreme pitch clamp are covered in `tests/showcase-quality.test.js`.
- Thin-wall box/sphere sweeps, rotated walls, wall-slide velocity, thin-platform landing, terrain, and map boundary are covered in `tests/public-api.test.js`.
- Each first-person standalone releases Pointer Lock on pause, resumes, reacquires on the resume/canvas gesture, and exercises the persistent invert setting above.
