# First-Run Onboarding Contract

## Purpose and boundary

Digital Opus presents a lightweight welcome only on a true local first run. It offers **Start Blank**, **Guided First Game**, and **Open Example**, plus an explicit **Skip for now** action. This phase teaches the engine's current 3D workflow. It does not claim Sprite or 2D capability, create accounts, send telemetry, or build a genre-template catalog.

The preference and tutorial record live only under `digital-opus:onboarding:v1` in browser local storage. They are excluded from project serialization and runtime game state. Embedded games and `?game=` example launches do not show the first-run experience.

## Returning-creator behavior

Any first-run choice records that the welcome was seen. A creator can also select **Do not show this welcome again**. Neither path traps returning users. Help remains available in the top toolbar and on the Objects, Viewport, Inspector, Level, UI, and Project surfaces.

Help provides **Restart Tutorial in a Blank Project** and, when relevant, **Resume Guided Tutorial**. Restart is an explicit destructive boundary for the current in-memory document only: it does not delete named saved projects or the separate Prefab library.

## Guided state and completion

The guided journey has nine outcomes: place, move, component, gameplay preset, Player, HUD, Play, Save, and Playable Export. Place, component, preset, and HUD derive from actual editor state. Move, Player configuration, Play, Save, and Export are recorded only after their corresponding real editor interaction succeeds. There are no artificial Next buttons.

An active tutorial resumes its dedicated saved project after reload. If no saved tutorial exists, it resumes into a clean dedicated tutorial document. Completion is recorded only after the real Playable Export is built and download is initiated.

## Interaction and accessibility baseline

The coach highlights, scrolls to, and focuses actual controls. It stays clear of the right panel and below modal pickers in the stacking order. Welcome and Help dialogs have readable controls, keyboard focus, and Escape behavior. The UI remains usable without a tutorial replica.
