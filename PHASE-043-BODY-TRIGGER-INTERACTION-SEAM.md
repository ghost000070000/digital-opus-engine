# Phase 043 Body / Trigger Interaction Seam

The intended ownership boundary is:

- Body supplies role and motion.
- Ordinary Box/Circle Collider 2D supplies physical shape.
- Trigger Collider 2D supplies an independent detection volume.
- Trigger overlap never produces physical response.

An object may own all three concepts. Phase 043 Body movement is committed before the Phase 042 Trigger lifecycle tick, so detection reads the resolved current position. Trigger callbacks changing Body velocity affect the next Body tick. The Body record has Static/Kinematic role and world XY velocity but no gravity, dynamic response, or automatic depenetration.
