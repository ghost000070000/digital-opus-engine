# ONNX / Local-AI Utility Assessment

Required by the Major Expansion Batch spec before any ONNX/local-AI
integration: a strict utility gate, with `ONNX_NOT_JUSTIFIED_YET` an
explicitly valid outcome. This is that assessment.

## Verdict: `ONNX_NOT_JUSTIFIED_YET`

## What was considered

Digital Opus Engine/Editor is a zero-dependency, no-code 3D game-builder.
Every capability built in this batch (shared action core, Object
References, AI Behavior, Trigger Volumes, Prefabs, Spawn Prefab,
Checkpoints, three stress-test games) was built and works entirely without
any inference step. Candidate uses considered for a local model, and why
none clears the bar right now:

- **NPC dialogue / behavior via a small local LLM.** The AI Behavior track
  (Follow/Orbit/Wander) covers everything the three stress-test games
  actually needed — direct steering, not decision-making. Nothing built or
  played this batch exposed a gap an LLM would fill; "smarter" enemy
  behavior would be pathfinding (explicitly out of scope) or scripted
  decision trees (Node Graph's conditions already cover simple cases,
  Custom Script covers the rest), not natural-language reasoning.
- **Procedural level/terrain generation via a model.** `Opus.createTerrain`
  already generates varied islands from a seed, deterministically, with no
  model needed; nothing in this batch's dogfooding hit a wall a generative
  model would solve, and the project's explicit no-PBR/no-gratuitous-assets
  stance argues against adding generated-content machinery it doesn't need.
- **Texture/material generation.** Explicitly out of scope per the batch
  spec ("no PBR/textures-just-because-glTF-has-them") — a model that
  generates textures would be solving a problem this project has
  deliberately declined to have.
- **Natural-language-to-behavior authoring** (describe a behavior in
  English, get a Node Graph or action back). The closest thing to a
  plausible future use case found during this batch — but nothing built
  this batch needed it, no user request exists for it, and it would be a
  substantial, speculative feature addition rather than something that
  closes a gap found by building and playing real games, which is this
  batch's actual mandate.

## Why not now

Every one of the ~33 friction points found and fixed this batch (see
`API-FRICTION.md`) was solved by a small, targeted, deterministic editor or
engine change — never by "the fixed vocabulary can't express this, only a
model could." That is the actual bar this gate is checking for, and
nothing crossed it. Adding an inference dependency (even an optional,
locally-run one) to a project whose defining trait is zero dependencies is
a real cost — bundle size, a new failure mode (model load/inference
errors), a new thing to keep working across browsers/devices — that has to
be paid for by a genuine capability gap, not a speculative "this could be
neat later."

## What would change the verdict

Revisit this gate if a future batch's dogfooding hits a wall specifically
shaped like "the fixed action/Node Graph vocabulary cannot express this,
and neither can a bounded number of new fixed primitives" — e.g., a
designer wants freeform NPC dialogue that reacts to arbitrary player text
input (not a menu of fixed responses), or genuinely open-ended
natural-language level authoring becomes an explicit, requested product
direction. Until then, the fixed-vocabulary-plus-Custom-Script-escape-hatch
model this project already runs on keeps working, per this batch's own
findings.
