# Phase065 — Event relays and signal filters

COMPLETED on `34578637a5379fb0f7925095fc0d9495d3118b09b6b66ec428c02c996ad3bd4a`.

Two discoverable editable graph starters compose the existing On Signal Event,
Read Signal Value, canonical Conditions and Send Signal. Relay this Signal forwards
no-value or matching typed occurrences; Filter and relay this Signal adds a strict
Compare Values gate. Native named outgoing pickers remain explicit. A typed
starter refuses a no-value Event without changing its draft. No competing listener
registry, hidden Game-variable bridge, Script or new dispatcher was introduced.

Compare Values supports Number, Text, Boolean, Object reference and Color.
Numbers support equality/inequality and ordered comparisons; other types support
equality/inequality only. Colors compare normalized hex case. Object references
must resolve to live Objects; empty inline Object means Self. Invalid types,
operators, stale bindings and missing Objects fail closed, including inside NOT.
Saved values are retained, not coerced when the creator changes the type. Native
matching editors, named Object pickers, typed pins, readable comparison labels and
visible validation explain rejected configurations. Existing Conditions and inline
semantics remain unchanged; exhaustive earlier registry coverage now includes the
28th Condition rather than silently omitting it.

Canonical relay sends capture the relay Object’s channel ownership. Immutable
occurrence values survive Wait and independent invocations; outgoing definitions
still determine channel/type eligibility. Actual editor adapter regressions prove
3/0 rejection, distinct7+7 forwarding, isolated Prefab ownership, all five typed
domains and historical no-value forwarding. A cyclic relay reaches the existing
256-occurrence work cap with a visible delivery-limit diagnostic and empty queue,
not recursive stack growth. Tests also assert no swallowed receiver exceptions.

Native `relays-browser-20261010T000506071Z`:20 observations PASS, zero page,
console or external-request errors. All authored edits used native controls;
read-only probes observed effects and exact embedded records. Source, reopened
Source, Editable and Playable deliver the same accepted14 total while rejecting3.
Duplicate and dragged Prefab relays produce28 independently; Undo restores exact
records. Native Text/Boolean/Object/Color controls and stale Number→Text bindings
are visibly diagnosed; saved mismatch rejects all received Numbers, and Undo
restores working behavior. Both no-value and filtered starters were actually used.
Screenshots include `filtered-relay.png` and `typed-mismatch-diagnostic.png` in the
run directory. Added Wait was arranged using native node drag; graph layout remains
manual, not a claimed automatic-layout capability.

Prior scoped typed-channel compatibility `channels-browser-20261010T000226581Z`:
17 native observations PASS, zero errors. Full
`regression-direct-20261010T000141883Z`:8 gates PASS/372 syntax files, integrated
suite, engine, all28 games, both sites, JSON, diff and matching start/final
fingerprint. Full integrated suite rerun after the extra no-value/all-type/error
assertions exits0. Earlier run identified an exhaustive054 test missing the new
Condition case; permanent coverage was extended, not the test disabled.

Fresh `probe-20261010T000313614Z`:Arsenal Run, Power Grid, Signal Relay, Silent
Sector, Relic Frontier, Dungeon Descent and Survival Arena all start, accept input,
move, restart natively and move again; all four controller families, zero page,
console or external errors. This is compatibility, not a new full collision soak.

Limits remain: active scenes only, not remote/inactive mailboxes; bounded primitive
payloads, not arbitrary structured predicates; no listener/debug inspector067 or
independent cross-project definition bundle. Inspector Behavior creation remains
Cube-oriented. Capability grade remains B with these explicit limitations, not an
inflated A. No public game content, deployment, commit or push. Next exact066:
Reusable event-driven prefab patterns.
