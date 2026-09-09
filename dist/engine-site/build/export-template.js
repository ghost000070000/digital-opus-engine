// Shared HTML-export composer -- the ONE place that turns (engine JS +
// editor JS + a template page + an embedded project) into a self-contained
// playable/editable .html file. Used by BOTH:
//   - the in-browser Playable/Editable Export buttons (editor/src/01-editor.js's
//     own `buildExportHTML`, which fetches its inputs from the live page);
//   - the build-time catalog build script (build/build-games.js, which reads
//     its inputs from disk with no browser at all).
// Deliberately has ZERO dependency on `document`/`fetch`/`serializeProject`/
// any other editor-global -- it only ever touches the strings it's handed,
// so the exact same function produces byte-identical output regardless of
// which caller runs it. This is the "smallest reusable shared piece" the
// two callers have in common; project SERIALIZATION itself (prefabs, asset
// dependency collection, etc.) stays exactly where it already lived, in the
// editor's own `serializeProject()` -- this module only does the templating
// step that comes after a project is already serialized to JSON text.
//
// Works as a plain <script> global (window.composeExportHTML) in the editor
// page and as a CommonJS export (module.exports.composeExportHTML) in Node
// build tooling -- same file, no build step, no bundler.
(function (root) {
  'use strict';

  // Two independent pitfalls with inlining arbitrary text into an HTML
  // <script> block via String.replace -- see buildExportHTML's own
  // historical comment (Wave 6B, Priority G) for the full story of the bug
  // this escaping already fixed once: (1) the HTML parser ends a <script>
  // at the first literal `</script`, regardless of JS syntax; (2) a STRING
  // replacement argument treats `$&`/`$$`/etc specially, which arbitrary
  // project data could contain.
  function escapeForInlineScript(code) {
    return code.replace(/<\/script/gi, '<\\/script');
  }

  // Byte-for-byte the same escaping `escapeHtml` in editor/src/01-editor.js
  // already uses for a <title> value -- duplicated here (not imported)
  // because this module must stay independently loadable in a bare Node
  // process with no editor globals at all.
  function escapeHtmlForTitle(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Builds the final .html string. All inputs are plain strings/booleans --
  // no live objects, no DOM, no fetch.
  //   htmlTemplate         - editor/index.html's own source text
  //   engineJS             - dist/opus-engine.js's own source text
  //   editorJS             - editor/src/01-editor.js's own source text
  //   templateJS           - THIS FILE's own source text (embedded so a
  //                          re-export from inside an already-exported
  //                          Editable build still has composeExportHTML
  //                          available to call, closing the loop -- without
  //                          this, "Edit This Game -> modify -> re-export"
  //                          would break the instant this module split out
  //                          of buildExportHTML)
  //   embeddedProjectJSON  - JSON.stringify(serializeProject()) (or, at
  //                          build time, a project JSON file's own raw text
  //                          -- see build-games.js's own comment on why
  //                          those are interchangeable)
  //   playableOnly         - true for Playable Export, false/undefined for
  //                          Editable Export
  //   title                - the resolved <title> text (caller decides the
  //                          fallback chain -- see buildExportHTML)
  function composeExportHTML(opts) {
    const embeddedFlags = opts.playableOnly
      ? `window.__OPUS_EMBEDDED_PROJECT__ = ${escapeForInlineScript(opts.embeddedProjectJSON)};\nwindow.__OPUS_PLAYABLE_ONLY__ = true;`
      : `window.__OPUS_EMBEDDED_PROJECT__ = ${escapeForInlineScript(opts.embeddedProjectJSON)};`;
    return opts.htmlTemplate
      // The editor's repository/package favicon is intentionally not copied
      // into one-file game exports. Removing these tagged links preserves the
      // standalone contract instead of leaving a broken relative asset URL.
      .replace(/<link data-opus-app-icon[^>]*>\s*/g, '')
      .replace(/<script>\n\/\/ Dev-time cache-busting[\s\S]*?<\/script>/, () => `<script>${embeddedFlags}</script>\n<script>\n${escapeForInlineScript(opts.templateJS)}\n</script>\n<script>\n${escapeForInlineScript(opts.engineJS)}\n</script>\n<script>\n${escapeForInlineScript(opts.editorJS)}\n</script>`)
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlForTitle(opts.title || 'Digital Opus Game')}</title>`);
  }

  const api = { composeExportHTML };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.composeExportHTML = composeExportHTML;
  }
})(typeof window !== 'undefined' ? window : this);
