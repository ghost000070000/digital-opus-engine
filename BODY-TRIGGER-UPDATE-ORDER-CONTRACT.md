# Body and Trigger update order

The Play update first runs existing gameplay motion and hierarchy resolution. Body 2D then integrates Kinematic velocity, resolves movement against Static Body geometry, commits world or parent-local Transforms, and refreshes hierarchy. The Phase 042 Trigger lifecycle evaluates the resulting positions in the same simulation tick. A Static wall may prevent Trigger entry; Trigger geometry never blocks the Body. A Trigger callback that changes Body velocity affects the next Body tick, preserving the existing Trigger callback snapshot contract.

Play start and Stop capture and restore authored Body Transforms and component values. A mid-Play Level switch restores the outgoing Level before serialization and captures the incoming Level before simulation.
