# Phase144 — Equipment slots editor

COMPLETED2026-10-11T10:43:51Z. PHASE_144_EQUIPMENT_SLOTS_EDITOR_READY.
Exact authoritative title; individual detailed tracker specification
blank. Bounded contract: qualification/phase-144/DERIVED-CONTRACT.md.
Frozen candidate fbb7fe2e2c9f4285705ca7aafbf2b676973aca7b5ad9831907171537ee4e63f9.
Fresh integrated and native acceptance qualify this bounded phase, not the full product.

Native baseline6913 reproduced the actual creator failure: entering a named
Item's visible name in Equipment did not offer Equip; entering its raw stable
ID did. Existing logical equipment worked across Source, Editable and Playable,
so this repair composes existing canonical inventory/equipment rather than
replacing it. A Project Item picker now writes its stable identity without raw-ID
typing. Applying its suggested slot is a separate explicit action; custom slots
have safe authoring validation. Historical free names, unusual saved slots,
extensions, visual data and combat definitions remain compatible. Selecting an
Item neither changes the slot secretly nor consumes inventory.

Actual mounted RED5/1 reproduced stale named-picker handlers editing a replacement
row. Owner-identity guards now refuse that edit. Source review additionally found
new controls omitted from Play/Stop disabling, a Weapon Definition callback binding
to a detached old row, and Stop enabling named-definition read-only tuning fields.
These are repaired and permanently covered; source-review findings are not
mislabeled as prepatch native REDs. Duplicate mappings explain the historical
first-match policy without rewriting saved records. Suggested-slot controls have
scoped theme/focus/disabled styling.

Final actual-source11 PASS; proportional 15-file suite140 PASS/0 FAIL, including
historical Equipment113 and related combat131–136. Final native103730131 CLOSED32,
10:37:30.131–10:37:51.273Z: named Item choice, body/custom utility slots, explicit
suggestions, one Undo/exact Redo/no-op, named Weapon Definition on current cloned
owner, Save/reopen and actual F/I Equip/Unequip in all three tiers. Counts remain1.
Play guards and Stop-bound tuning state are observed. Root reviewed raw state and
native authoring/Playable equipped HUD screenshots. Start/final fbb7 match;
page errors, console errors and external requests are empty.

Baseline17 and intermediate c46 native25 remain preserved, not transferred to
final acceptance. A thin-host missing-helper dependency and warning-wording test
expectation were fixture corrections, not product bugs. Imported prior Grant/
geometry foundation is explicitly labeled. No new visual mesh/socket placement,
equipment firing, arbitrary legacy-name acceptance, BuiltSite gameplay, all28
gameplay, physical gamepad, file-protocol offline, forced-GC stability or long soak
claim follows. Phase145/146 features are not implemented by this phase.

Fresh sole full regression104129228 CLOSED8 on fbb7: integrated suite, engine,
all28 catalog builds, both sites, syntax676, JSON43 and diff. Start/final and
independent closing fingerprint match. Command build success is
not gameplay acceptance; native gameplay evidence is separate. Existing white
Inventory Close button remains cosmetic friction, not concealed by this repair.
