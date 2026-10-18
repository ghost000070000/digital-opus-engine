// Minimal static file server for local dogfooding/verification only -- not
// shipped, not part of build.js's output, not referenced by the engine or
// editor. Serves the repo root so editor/index.html can load engine/src +
// editor/src + games/*.json all via ordinary relative paths, exactly like
// opening the file would, but over http:// (file:// silently breaks some
// fetches in the Browser pane -- see the project's own established fix).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildEditor } = require('../build/build-editor');
buildEditor();

const root = path.resolve(__dirname, '..');
const port = process.env.PORT || 8837;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/editor/index.html';
  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  // Reassemble on each load so edits to editor/src/modules show on refresh.
  if (urlPath === '/editor/src/01-editor.js') {
    try { buildEditor(); } catch (error) { res.writeHead(500); res.end(String(error.message)); return; }
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log(`dev-server listening on http://localhost:${port}`));
