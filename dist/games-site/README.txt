Digital Opus Games -- local pre-release review package
====================================================

This self-contained static package includes only games explicitly marked
public in games/catalog.json and validated against the showcase quality gate.
Internal projects remain in the repository and dist/games development catalog.

No upload or deployment is approved by this rehabilitation pass. Review the
real gameplay screenshots and playable examples before any release decision.
The prior release ZIP is superseded; Wave 10 has not started.

Regenerate locally with:
  node build/build.js
  node build/build-games-site.js

Source metadata lives in games/catalog.json; game content in games/<id>.json;
the page template in build/templates/games-site.html. Do not hand-edit outputs.

Contents:
  index.html      filtered public candidate gallery
  <id>.html       self-contained reviewed playable samples
  catalog.json    public metadata, purpose, tier and screenshot paths
  assets/         real standalone gameplay screenshots
