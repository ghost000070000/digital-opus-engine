# Phase 036 Full-Day Runbook

Run ID state lives in `qualification/phase-036/full-day-state.json`; the heartbeat is `full-day-heartbeat.json`. Stages A-X cover baseline, schema, resolver, delegation, UI, footprints, history, recompute, integration, validation, persistence, export, browser dogfood, fuzz, marathons, observations, regressions, and reports.

All campaigns are local and disposable. Servers use 8850-8855 when free and record PID, command, port, and purpose; only campaign-owned processes may be stopped. Expected Windows `UNKNOWN`, `EBUSY`, or `EPERM` replacement locks may retry for at most five seconds. Logic and syntax failures never retry.

Resume by reading the checkpoint, rerunning safe characterization and focused tests when state is unclear, and never cleaning the worktree. Weighted and mixed fuzz use fixed seeds and preserve mismatch history. Browser/export loops use isolated artifacts and profiles. Heartbeats record actual elapsed time and counters at least every 15 minutes. The endurance target is six to eight actual hours, maximum ten; environmental interruption is reported rather than fabricated.
