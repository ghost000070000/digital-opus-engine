# Editor Onboarding Resilience Contract

The guided first-game journey must never hard-lock the editor or the creator's project.

- Steps address controls through a stable semantic target registry.
- Target lookup is bounded to five attempts over approximately one second.
- A missing target exposes Retry, Skip Step, and Exit Tutorial instead of waiting forever.
- Back, Skip Step, Exit, close, resume, and restart are explicit and persist through the dedicated local preference record.
- Escape exits the coach when the editor is not in Play mode.
- Corrupt or older progress normalizes to a safe current record.
- Highlight and target timers are owned and cancelled; polling exists only while a tutorial is active.
- Resize and reload do not depend on cached element geometry.
- Tutorial state never enters project serialization or standalone gameplay state.

Qualification covers 10,000 state transitions and 100 real-browser reload/resize cycles with zero page errors.
