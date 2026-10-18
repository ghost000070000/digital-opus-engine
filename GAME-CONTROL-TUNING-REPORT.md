# Game Control Tuning Report

## Outcome

The shared controller path is stable without per-game speed rewrites. All 28 games use authored movement speeds from 5.5 to 6.5 units/second, or the existing inertial hovercraft defaults. The library audit found no runaway or legacy frame-based movement value that justified content churn.

## Qualified behavior

- The engine clock emits seconds and clamps a stalled frame to 0.1 seconds.
- Top-down, third-person, first-person, and hovercraft updates consume `dt`.
- Direction input is normalized, opposite directions cancel, and acceleration is time-scaled.
- Blur and document-hidden events clear held and edge-triggered input.
- A five-second deterministic comparison at 30, 60, 120, 144, and 240 Hz differed by less than 0.2 world units.
- Native keyboard/mouse runs passed 28/28 built standalone games, including pause/resume and first-person pointer release/reacquisition.

No input architecture or Phase 039 roadmap work was added.
