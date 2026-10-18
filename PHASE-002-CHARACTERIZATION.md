# Digital Opus Engine — Phase 002 Characterization

## Scope

The Phase 002 suite protects outcomes at the bounded schema seam without asserting Inspector implementation details. It covers legacy ingestion, deterministic round trips, ownership, unknown data, versioning, validation, duplicate/history behavior, prefab reuse, exports, and one existing-runtime equivalence path for each proof schema.

## Automated contract suite

Command: `node tests/phase-002-authoring-schema.test.js`

Result: **28 passed, 0 failed**.

Coverage:

- registry identity, metadata, ownership, eligibility, version, and migration contract;
- field and typed-reference vocabularies, including future Sprite eligibility;
- legacy Health, Trigger, and Particle ingestion and runtime bridges;
- create → serialize → deserialize → serialize determinism for all three proofs;
- explicit defaults and missing-field normalization;
- known extension preservation and runtime/transient stripping;
- inert unknown component preservation;
- conservative handling of newer known component versions;
- independent deep copies for Health and Particle records;
- serialized Undo/Redo snapshots;
- shared prefab record round trip;
- structured Health, Particle, and Trigger validation;
- bounded migration-hook invocation;
- vector, color, enum, and typed-reference normalization;
- unchanged component-free legacy objects;
- identical schema/component payloads in Editable and Playable exports;
- one shared editor/runtime implementation across export tiers.

## Real-browser creator-flow characterization

Command: `node tools/audit-phase-002.js`

Result: **PASS**, no page errors. The test started a local static server, opened Arsenal Run in headless Microsoft Edge, and used ordinary editor controls.

Observed outcomes:

- The live registry exposed exactly Health, Particle Emitter, and Trigger.
- A legacy Arsenal Run Health record appeared in the schema-rendered Inspector. Editing maximum health updated both the component (`max: 61`) and existing runtime owner.
- Duplicate increased the 127-object scene to 128 and created an independent component bag.
- Undo restored 127 objects; Redo restored 128 with component data intact.
- Save as Prefab and a real palette drag produced an independent instance with the same Health component record.
- A real Trigger palette drag exposed schema controls; selecting Sphere and disabling Repeat updated legacy trigger flags.
- A real Particle Emitter palette drag exposed schema controls. Entering Rate -1 rendered two structured issues while the runtime stayed safely clamped to 0; Rate 37 and Particle Cap 144 then updated both options and the live emitter handle.
- Project Save then Load retained Health, Trigger, and Particle component records.
- The live Playable and Editable exports were approximately 2.91 MB in this scenario. Both contained the schema module and Health record; only Playable carried the active playable-only boot flag.

## Full regression evidence

Final commands and results:

| Command | Result |
|---|---|
| `node build/build.js` | PASS — engine 158,687 bytes / 40,950 gzip / 22 sources; demo 176,581 bytes |
| `node tests/run-tests.js` | PASS — 33/33 engine, 28/28 Phase 002, 15/15 showcase, 1/1 public-site integration |
| `node build/build-games.js` | PASS — 28/28, 110.4 MB total |
| `node build/build-engine-site.js` | PASS — editor packaged, 28/28 examples, path and broken-link checks passed |
| `node build/build-games-site.js` | PASS — 28/28, path and broken-link checks passed |
| JavaScript syntax checks | PASS — schema, editor, characterization suite, browser audit |

The engine bundle is unchanged from baseline. The game-export total increased from 109.8 MB to 110.4 MB because every single-file game now embeds the 24,151-byte authoring schema module.
