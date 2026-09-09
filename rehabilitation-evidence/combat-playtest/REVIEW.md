# Combat standalone playthrough review

The final tests use normal browser keyboard and mouse input. `page.evaluate` reads runtime state, camera, enemy health, equipment, objectives and counters for navigation/verification. It never teleports, grants inventory, changes health, disables AI, alters objectives, or invokes a win/lose action. Timings below are simulation seconds, not wall-clock duration. Screenshot pixels are actual standalone gameplay.

## Final results

| Game | Normal outcome | Progress evidence | Health at win | Restart |
| --- | --- | --- | --- | --- |
| Arsenal Run | Win at 40.51 seconds | First sentry 3.82; second 14.41; third 35.86; kill counter 3/3; extraction entered | 60/100 | Native Restart click after win passed; counter, enemies and active Sidearm reset |
| Signal Relay | Win at 34.57 seconds | Alpha 3.03; Beta 17.83; Gamma 30.46; all three consoles powered, two drones defeated; opened bulkhead crossed | 79/100 | Native Restart click after win passed; health, console counter and drones reset |

Arsenal additionally passed a normal loss trial: after Restart, the player stayed exposed without defending, received normal enemy damage, and lost at 17.41 seconds. The native Restart button then worked again. Pause/resume was verified in the successful Arsenal run. Final runs reported zero browser page errors.

The efficient Arsenal win uses the authored V weapon switch and sustained Q rifle fire. Earlier camera-fix validation also demonstrated Sidearm rounds dealing 18 damage and defeating the first sentry; that slower attempt lost while exposed. Both weapons were exercised, as were reload and active/inactive gun visibility. The historical frame name `sidearm-reloaded.png` in the efficient run shows the **Rifle** reloaded; the on-screen HUD and JSON equipment/weapon state are authoritative.

## First-person collision and presentation

`fps-collision/result.json` records an independent normal-input wall test in Signal Relay. W was held toward the west wall; the body stopped at X=-34.1, corresponding to the wall's inner face and the player's radius. S then moved away until the next divider at X=-20.9. Body visibility remained false, the equipped gun remained visible, and health stayed at 100. The test passed with no errors. This confirms that hiding the first-person physics body did not disable its collision.

The ending overlays now release pointer lock. Both normal Arsenal outcomes and the final Signal outcome allowed ordinary native mouse clicks on Restart. Fresh attempts restored their original enemies, objective state and equipment; no developer console restart was used.

## Evidence locations

- `arsenal-run-final-efficient/playtest.json`: full input trace, read-only state snapshots, standalone SHA-256, win, normal loss, two successful native restarts.
- `signal-relay-final-efficient/playtest.json`: full input trace, standalone SHA-256, all console/drone progress, win and native restart.
- `fps-collision/result.json`: physical collision and hidden-body/visible-weapon regression.
- `arsenal-run-aiming-baseline/`: historical pre-fix crosshair mismatch and normal loss evidence. It is not final-build acceptance evidence.
- `arsenal-run-camera-aim-fixed/`: intermediate aiming fix proved one kill; ending modal still intercepted Restart at that time. It is superseded by the final run.
- `signal-relay-baseline/`: earlier normal win at 52.65 seconds with 58 health; Restart was blocked by the subsequently repaired pointer-lock issue.
- `arsenal-run-initial/`: initial navigation/reload/switch pass with an incorrect telemetry enemy filter. It does not substantiate an enemy-free scene or a combat completion claim.

## Screenshot choices and quality assessment

Recommended representative gameplay screenshots:

- Arsenal Run: `arsenal-run-final-efficient/encounter-obj2010.png` shows live drone combat, the rifle, useful HUD and surrounding cover. `encounter-obj2009.png` provides a wider lane/extraction view.
- Signal Relay: `signal-relay-final-efficient/encounter-obj58.png` shows a live drone encounter, a relay landmark, the weapon and the facility lane. `gamma-console.png` provides a close interaction detail, though it is less suitable for the catalog thumbnail.

Both receive **visual 3, gameplay clarity 4, composition 3, audio 3, presentation 4, uniqueness 3**, and are recommended as **Public Samples**, not Featured. The synthesized audio inventory and separate event identities support the audio score; this is not a claim of professionally mastered audio. Repeated facility modules, sparse large surfaces and simple lighting remain visibly modest. Controls, objective counters, equipped weapons, enemy silhouettes and actual outcomes are readable and coherent.

Independent Relic Island screenshot review found readable original characters/landmarks but sparse composition and obvious terrain edges: visual 3, clarity 4, composition 3, audio 3, uniqueness 3. The reviewed `playthroughs/relic-island/` images had overlapping health/objective text at top-left, so presentation was 2 pending that repair. After resolving the overlap, a Public Sample role is appropriate. The gate screenshot is its strongest reviewed gameplay choice. No Featured recommendation is supported by these frames.

## Bugs reproduced during the pass

1. First-person camera aim and hitscan origin disagreed: the camera sat above the physics body, while the ray started at the body. Six camera-centered Sidearm shots failed to damage the close drone before the shared fix. With the camera-origin ray, normal shots damaged enemies and both games could be completed.
2. First-person end overlays retained pointer lock, preventing ordinary Restart clicks. The final modal release fix is verified through actual wins and a loss.
3. Historical enemy projectile prefabs still rendered orange cubes. Root replaced EnemyBolt/DroneBolt visuals with original kit projectiles before the final screenshot pass.

No game JSON was edited by these playtest tools. No public deployment, commit, push, or upload occurred.
