# ⚠ INTERNAL_DIAGNOSTICS_ONLY

Everything in this `release/` directory (`digital-opus-engine-web.zip`, `SHA256SUMS.txt`, `ENGINE-WEB-RELEASE-MANIFEST.md`, `HOSTINGER-DEPLOYMENT-GUIDE.md`, `POST-DEPLOY-VERIFICATION.md`) was produced by an earlier packaging pass **before** the Public Showcase Recovery pass (see `../PUBLIC-SHOWCASE-RECOVERY-REPORT.md`).

That earlier pass correctly proved the package builds, extracts, and runs technically. It did **not** assess whether the games inside it were presentable public examples. A visual review since then found the 7 "Featured" games are not public-showcase quality (sparse block geometry, first-person view obstruction, a visible skeletal test-rig, a wrong on-screen title, generic placeholder controls text).

**This package, and every claim of "production-ready", "showcase-ready", "public examples", or "Featured games" attached to it, is retracted.**

Do not:
- upload `digital-opus-engine-web.zip` anywhere;
- call this package production-ready, showcase-ready, or launch-ready;
- treat any game in it as a public example.

It is preserved, unmodified, for engineering/regression reference only — do not delete it.

The current, authoritative state of the public catalog is: **0 public showcases** (all 28 catalog entries are `visibility: internal`). See `../PUBLIC-SHOWCASE-RECOVERY-REPORT.md` for the full recovery pass, and `../SHOWCASE-ASSET-REQUEST.md` for what is needed before a real public flagship can be built.
