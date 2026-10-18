# Character wall-slide contract (Phase 045)

World negative Y is down. Wall slide applies only with an enabled valid Character, `wallSlideEnabled`, requested Y velocity below `-wallSlideMaxSpeed`, side-wall contact at tick start or after X movement, and no ground contact. X movement resolves first so same-tick wall impact can clamp the subsequent Y displacement to `-wallSlideMaxSpeed * deltaSeconds`.

The Body's authored `linearVelocity` is never rewritten. Upward movement, grounded contact, or disabled wall-slide preserves ordinary Kinematic movement. Final probes set `wallSliding` false when the Character leaves the wall or reaches floor; normal requested downward movement resumes next tick. No gravity, ground snap, step-up, slope normal, or jump is implied.
