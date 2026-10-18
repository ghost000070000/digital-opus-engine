'use strict';
// Creates a disposable, self-contained folder for local browser preview.
// This is not a deployment package and performs no network publishing.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'dist', 'engine-site');
const TARGET = path.join(ROOT, 'live-local-preview');

if (!fs.existsSync(path.join(SOURCE, 'index.html'))) {
  throw new Error('dist/engine-site is missing; run node build/build-engine-site.js first');
}

fs.rmSync(TARGET, { recursive: true, force: true });
fs.cpSync(SOURCE, TARGET, { recursive: true });

const server = `'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname,port=Number(process.env.PORT||8840);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg'};
http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const candidate=path.resolve(root,'.'+pathname);
  if(candidate!==root&&!candidate.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  fs.stat(candidate,(statErr,stat)=>{
    const file=!statErr&&stat.isDirectory()?path.join(candidate,'index.html'):candidate;
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
  });
}).listen(port,'127.0.0.1',()=>console.log('Digital Opus local preview: http://localhost:'+port));
`;
fs.writeFileSync(path.join(TARGET, 'preview-server.js'), server, 'utf8');
fs.writeFileSync(path.join(TARGET, 'START-PREVIEW.cmd'), '@echo off\r\nset "PORT=8840"\r\nnode "%~dp0preview-server.js"\r\n', 'utf8');
fs.writeFileSync(path.join(TARGET, 'README-LOCAL-PREVIEW.md'), `# Digital Opus Engine local preview\n\nDouble-click \`START-PREVIEW.cmd\`, then open:\n\n- Home: http://localhost:8840/\n- Editor: http://localhost:8840/editor/\n- All examples: http://localhost:8840/games/\n\nPress Ctrl+C in the server window to stop it. This folder is local-only and is not a production deployment package.\n`, 'utf8');

const catalog=JSON.parse(fs.readFileSync(path.join(TARGET,'games','catalog.json'),'utf8'));
const manifest={createdAt:new Date().toISOString(),source:'dist/engine-site',games:catalog.games.length,featured:catalog.games.filter(g=>g.qualityTier==='featured').length,samples:catalog.games.filter(g=>g.qualityTier==='sample').length,entrypoints:{home:'index.html',editor:'editor/index.html',games:'games/index.html'}};
fs.writeFileSync(path.join(TARGET,'PREVIEW-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(`Live local preview -> ${path.relative(ROOT,TARGET)} (${manifest.games} games, ${manifest.featured} Featured, ${manifest.samples} Samples)`);
