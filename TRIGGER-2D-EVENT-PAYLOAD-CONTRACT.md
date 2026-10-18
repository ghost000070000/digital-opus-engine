# Trigger 2D Event Payload Contract

Canonical event IDs are `trigger2DEnter`, `trigger2DStay`, and `trigger2DExit`.

Each frozen payload contains `eventType`, `lifecycle`, `triggerObjectId`, `targetObjectId`, `componentId` (`trigger-collider-2d`), safe live `triggerObject` and `targetObject` references, and a frozen sorted `matchedColliderTypes` list. Event identity never depends on which target shape matched first.

Payloads expose no pair-map or mutable registry collection. They are delivered through existing Behavior → Action dispatch. `window.opusTrigger2D.subscribe(eventType, handler)` is the bounded public/runtime instrumentation seam. Trusted Custom Script receives the current payload as its additive `event` argument; the existing trust gate is unchanged.

