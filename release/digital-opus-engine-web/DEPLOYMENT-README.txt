Digital Opus Engine -- public site deployment package
=======================================================

DO NOT DEPLOY THIS PACKAGE TO games.digitalopusadsolutions.com.
That host belongs to the existing, separate 43-game Digital Opus Games
portfolio and must not be overwritten.

PROPOSED_DEPLOYMENT_TARGET: engine.digitalopusadsolutions.com (not created,
not authorized -- a recommendation only, pending an explicit decision).
This package also tolerates subpath hosting (e.g. /engine/) as long as it
is served as a whole folder -- every internal link in this package is
relative, never root-absolute.

This folder is a complete, self-contained static site:
  index.html        Engine home page (hero, features, Featured examples)
  editor/           the real Digital Opus Engine editor, packaged
  dist/, build/     the editor's own two runtime dependencies (unchanged
                    from the repository's own editor/index.html <script>
                    tags -- nothing rewritten, nothing forked)
  games/            the Engine's own playable-examples hub (28 games:
                    7 Featured, 14 Sample, 7 Experimental), including each
                    game's own raw project JSON (needed so the packaged
                    editor's own Games tab / "Open in Editor" can fetch it,
                    exactly like the repository's own dev editor does)

No server runtime, no database, no login, no analytics.

To regenerate:
  node build/build.js
  node tests/run-tests.js
  node build/build-games.js
  node build/build-engine-site.js

Do not hand-edit anything in this folder. Source changes belong in:
  - build/templates/engine-home.html   (the Engine home page template)
  - build/templates/games-site.html    (the examples-hub page template)
  - build/build-engine-site.js         (this generator)
  - games/catalog.json                 (example metadata)
  - editor/index.html, editor/src/     (the editor itself)
Then regenerate.
