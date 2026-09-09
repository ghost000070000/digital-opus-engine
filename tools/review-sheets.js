const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),phase=process.argv[2]||'baseline',frameNames=(process.argv[3]||'start,opening,gameplay').split(',');
const ids=require('../games/catalog.json').games.map(g=>g.id).filter(id=>fs.existsSync(path.join(root,'rehabilitation-evidence',phase,id,'start.png')));
(async()=>{for(let b=0;b<Math.ceil(ids.length/7);b++){
  const rows=ids.slice(b*7,b*7+7),layers=[];
  for(let i=0;i<rows.length;i++){
    for(let j=0;j<frameNames.length;j++){
      const file=path.join(root,'rehabilitation-evidence',phase,rows[i],frameNames[j]+'.png');
      if(fs.existsSync(file))layers.push({input:await sharp(file).resize(400,225).png().toBuffer(),left:j*400,top:i*250});
    }
    layers.push({input:Buffer.from(`<svg width="1200" height="25"><rect width="1200" height="25" fill="#101722"/><text x="10" y="18" fill="white" font-size="15">${rows[i]} — ${phase}: ${frameNames.join(' / ')}</text></svg>`),left:0,top:i*250+225});
  }
  const file=path.join(root,'rehabilitation-evidence',phase+'-sheet-'+b+'.png');
  await sharp({create:{width:1200,height:rows.length*250,channels:3,background:'#111'}}).composite(layers).png().toFile(file);console.log(file);
}})();
