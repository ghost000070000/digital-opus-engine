const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const {composeExportHTML}=require('../build/export-template');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const id of process.argv.length>2?process.argv.slice(2):['moving-temple','skyway-trial']){
 const p=JSON.parse(read('games/'+id+'.json')),l=p.levels[0];
 if(id==='moving-temple'){const rise=l.objects.find(o=>o.id==='obj59').animationClips.find(c=>c.name==='Rise');rise.duration=8;rise.tracks.position[1].t=8;}
 else{l.playerSettings.acceleration=60;l.playerSettings.jumpSpeed=10;const fall=l.objects.find(o=>o.id==='obj59');fall.position=[0,-12,14];fall.scale=[80,3,80];for(const field of ['howToPlay','controlsHint'])if(!l.ui.startScreen[field].includes('C careful steps;'))l.ui.startScreen[field]=l.ui.startScreen[field].replace('Space jumps;','Space jumps; C careful steps;');}
 fs.writeFileSync(path.join(root,'games',id+'.json'),JSON.stringify(p,null,2)+'\n');
 const html=composeExportHTML({htmlTemplate:read('editor/index.html'),engineJS:read('dist/opus-engine.js'),editorJS:read('editor/src/01-editor.js'),templateJS:read('build/export-template.js'),embeddedProjectJSON:JSON.stringify(p),playableOnly:true,title:p.meta.title});
 fs.writeFileSync(path.join(root,'dist/games',id+'.html'),html);console.log('built '+id);
}
