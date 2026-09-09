'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const kit=require('./showcase-assets');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'rehabilitation-evidence','assets');
fs.mkdirSync(out,{recursive:true});
const report={models:[],textures:[],audio:[],errors:[]};
for(const key of kit.meshKeys){
  const a=kit.getMesh(key),vertices=a.positions.length/3;
  assert(vertices>0&&vertices<65536,key+' vertex count');assert.equal(a.normals.length,a.positions.length,key+' normals');assert.equal(a.uvs.length,vertices*2,key+' UVs');
  for(const n of [...a.positions,...a.normals,...a.uvs])assert(Number.isFinite(n),key+' finite arrays');
  for(const i of a.indices)assert(Number.isInteger(i)&&i>=0&&i<vertices,key+' indices');
  for(let i=0;i<a.normals.length;i+=3)assert(Math.abs(Math.hypot(...a.normals.slice(i,i+3))-1)<.0001,key+' unit normal');
  if(a.skin){assert.equal(a.joints.length,vertices*4);assert.equal(a.weights.length,vertices*4);for(let i=0;i<vertices;i++){assert(a.joints[i*4]<a.skin.jointCount);assert.equal(a.weights[i*4],1);}for(const c of a.skin.clips)for(const t of c.tracks){assert(t.jointLocalIndex<a.skin.jointCount);assert.equal(t.values.length,t.times.length*4);}}
  assert.equal(JSON.stringify(a),JSON.stringify(kit.getMesh(key)),key+' deterministic');
  report.models.push({key,vertices,triangles:a.indices.length/3,joints:a.skin?.jointCount||0,bounds:a.bounds});
}
for(const key of kit.textureKeys){const a=kit.getTexture(key),bytes=Buffer.from(a.dataURL.split(',')[1],'base64');assert.equal(bytes.subarray(1,4).toString(),'PNG');report.textures.push({key,bytes:bytes.length});}
for(const key of kit.audioKeys){const a=kit.getAudio(key),bytes=Buffer.from(a.dataURL.split(',')[1],'base64');assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.readUInt32LE(4)+8,bytes.length);let peak=0,sum=0;for(let i=44;i<bytes.length;i+=2){const v=bytes.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));sum+=v*v;}const rms=Math.sqrt(sum/((bytes.length-44)/2));assert(rms>.005&&peak<.95,key+' level');report.audio.push({key,seconds:(bytes.length-44)/44100,peak:+peak.toFixed(4),rms:+rms.toFixed(4)});}
const p={assets:[],textures:[],audio:[]};kit.install(p,{meshes:['ranger'],audio:['pickup']});kit.install(p,{meshes:['ranger'],audio:['pickup']});assert.equal(p.assets.length,1);assert.equal(p.textures.length,1);assert.equal(p.audio.length,1);
async function render(){
  const http=require('http');
  const {chromium}=require('playwright');
  const sharp=require('sharp');
  const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'application/json'});res.end(error?'Not found':data);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    const executablePath=process.env.SHOWCASE_BROWSER;
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{channel:'msedge'}),args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:420,height:420},deviceScaleFactor:1});
    page.on('pageerror',e=>report.errors.push(e.message));
    const images=[];
    for(let i=0;i<kit.meshKeys.length;i++){const key=kit.meshKeys[i];await page.goto(`http://127.0.0.1:${server.address().port}/tools/showcase-asset-preview.html?key=${key}`);await page.waitForFunction(()=>window.__assetReady||window.__assetError);const error=await page.evaluate(()=>window.__assetError);assert(!error,error);await page.waitForTimeout(160);const buffer=await page.screenshot();fs.writeFileSync(path.join(out,key+'.png'),buffer);images.push({input:buffer,left:(i%6)*420,top:Math.floor(i/6)*420});}
    await sharp({create:{width:2520,height:Math.ceil(kit.meshKeys.length/6)*420,channels:4,background:'#142330'}}).composite(images).png().toFile(path.join(out,'asset-contact-sheet.png'));
    for(const key of ['ranger','guardian']){await page.goto(`http://127.0.0.1:${server.address().port}/tools/showcase-asset-preview.html?key=${key}`);await page.waitForFunction(()=>window.__assetReady);await page.evaluate(()=>{window.__assetEntity.animationClip=2;window.__assetEntity.animationTime=.18;});await page.waitForTimeout(200);await page.screenshot({path:path.join(out,key+'-run.png')});}
    report.rendered=kit.meshKeys.length;report.contactSheet='rehabilitation-evidence/assets/asset-contact-sheet.png';
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
(async()=>{if(process.argv.includes('--render'))await render();fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2)+'\n');assert.equal(report.errors.length,0);console.log(`Validated ${report.models.length} meshes, ${report.textures.length} PNGs, ${report.audio.length} WAVs`+(report.rendered?`; rendered ${report.rendered} engine previews.`:'.'));})().catch(error=>{console.error(error);process.exitCode=1;});
