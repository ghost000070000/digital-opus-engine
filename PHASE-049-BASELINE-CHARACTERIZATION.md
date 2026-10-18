# Phase 049 baseline characterization

Baseline repository HEAD was `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`; preexisting dirty work from earlier campaigns was preserved (approximately 826 entries). No reset, cleanup, commit, push, or deployment was performed.

The verified Phase 048 product fingerprint was `0f61aec064311e66aacaa484b58a9e7a7f7f81b74974971c1bef6648d93d435a`. Engine baseline: 168,984 raw bytes / 43,457 gzip bytes / 22 files. Editor site package baseline: 2,025 KB. Public catalog: exactly 28 games.

Before Phase 049, Box/Circle/Trigger schema v1 and Tilemap v5 supplied geometry but no named collision policy. Body roles were Static/Kinematic, Characters supplied bounded slopes/steps/one-way support, and explicit Moving Platforms supplied carry. These existing roles and update order were retained.

The baseline engine build and integrated suite passed before implementation. Schema-version regression assertions were subsequently updated to the intentional v2 collider / v6 Tilemap migrations; behavioral geometry tests retained their earlier expectations.
