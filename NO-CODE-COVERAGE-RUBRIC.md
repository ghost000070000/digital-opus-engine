# No-Code Coverage Rubric

Apply the lowest grade supported by the complete creator journey. A strong runtime does not compensate for a missing authoring step.

## A — Fully no-code authorable

A normal creator can discover, configure, directly manipulate where appropriate, validate, test, save/load, duplicate or prefab where relevant, and export the capability without code or hidden knowledge.

## B — No-code common path

Ordinary use is discoverable and no-code. Advanced behavior may optionally use code, and some specialized refinements may remain limited, but the common workflow survives save/load and export.

## C — Partial / awkward

Some UI exists, but an important part of ordinary use requires raw IDs, free-typed references, manual coordination, hidden conventions, JSON editing, a brittle workaround, or code. A feature also belongs here when configuration exists but validation, debugging, portability, or direct manipulation is materially weak.

## D — Runtime-only / code-only / absent common path

The capability exists only underneath, can only be reached through code/data, or is absent as a meaningful creator workflow. A nearby capability does not qualify: for example, a Billboard does not raise true Sprite support above D.

## N/A — Intentionally not exposed as no-code

Use only when no-code exposure is intentionally inappropriate. Custom Script itself is N/A: it is the advanced code escape hatch, not a no-code feature.

## Scoring rules

- Grade the current repository, not plans or historical claims.
- Save/load without export, or export without editor authoring, is incomplete.
- A dropdown reference is preferable to a raw ID; a validated named registry is preferable to an unvalidated free-typed name.
- A preset may earn B when it covers the common path, even if its constituent advanced controls remain C.
- Pleasantness matters. A workflow that is technically possible but requires excessive panel hunting, memorized naming conventions, or repeated manual wiring is C.
- A grade changes only with repository evidence and an exercised creator workflow.
