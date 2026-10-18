# Phase065 — Event relays and signal filters

COMPLETED. Exact title from authoritative roadmap; expanded tracker prompt empty.
Build a native common path by composing existing On Signal, Read Signal Value,
Conditions and Send Signal. No competing listener registry/dispatcher or Script.

A creator can relay a named event to another named event, optionally gated by
strict payload comparison or existing gameplay Conditions. Preserve immutable
payload and existing channel context/eligibility, bounded loops and visible invalid
type/reference diagnostics. Add a reusable typed Compare Values Condition rather
than forcing payloads through temporary Game flags or hidden stores.

Discoverable editable relay starter, native signal pickers/typed bindings, exact
SaveLoad/history/duplication/Prefab/Editable/Playable and real allowed/rejected
relay observations are gates. Repeated sends remain distinct; cycles hit canonical
work caps, not recursive browser stacks. Unavailable/future records retained.
No independent asynchronous mailbox, debugger067 or full integration068 claim.
