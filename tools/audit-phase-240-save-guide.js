'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='save-guide-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,process.argv.includes('--beta-revision-1')?'qualification/beta-revision-1':'qualification/phase-240',runId);fs.mkdirSync(dir,{recursive:true});
const proof={runId,startedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),errors:[],external:[],routes:[]};
(async()=>{let browser;try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const route of ['docs/generated/index.html','dist/engine-site/index.html']){
    const p=await browser.newPage({viewport:{width:1280,height:960}});p.on('pageerror',e=>proof.errors.push(e.stack));p.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))proof.external.push(r.url());});
    try{
      await p.goto(pathToFileURL(path.join(root,route)).href);if(route.includes('dist/'))await p.getByRole('link',{name:'Creator Guide',exact:true}).click();
      await p.getByRole('link',{name:'Supported workflows and explicit limits',exact:true}).click();assert(new URL(p.url()).hash==='#scope-limits');
      const limits=p.locator('#scope-limits'),bounds=await limits.innerText();for(const expected of ['exact-case strings','not automatic global rename','not global GUID live-sync','Material Apply copies values','multitrack Sequence scrub','after decoding','Layers/Masks filtering'])assert(bounds.includes(expected));
      await limits.screenshot({path:path.join(dir,route.includes('dist/')?'packaged-scope-limits.png':'source-scope-limits.png')});proof.scopeLimits=true;
      await p.locator('#first-game').getByRole('link',{name:'Saving, player progress and backups',exact:true}).click();assert(new URL(p.url()).hash==='#save-model');
      const section=p.locator('#save-model');assert.equal(await section.locator('tbody tr').count(),3);
      const text=await section.innerText();for(const expected of ['Save Project','Save Game / Load Game','doengine:playersave:v1:PROJECT_ID','never loaded or claimed automatically','Web Locks','file:// storage behavior varies','No cloud sync'])assert(text.includes(expected));
      await section.screenshot({path:path.join(dir,route.includes('dist/')?'packaged-save-model.png':'source-save-model.png')});
      for(const width of [640,360]){await p.setViewportSize({width,height:900});await section.scrollIntoViewIfNeeded();const geometry=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,tableWidth:document.querySelector('#save-model table').getBoundingClientRect().width}));assert(geometry.scrollWidth<=width,'Persistence section must wrap within viewport');proof.routes.push({route,width,...geometry});}
      await section.screenshot({path:path.join(dir,route.includes('dist/')?'packaged-save-model-narrow.png':'source-save-model-narrow.png')});
    }finally{await p.close();}
  }
  assert.deepStrictEqual(proof.errors,[]);assert.deepStrictEqual(proof.external,[]);proof.status='SOURCE_PACKAGE_OFFLINE_SAVE_MODEL_ANCHOR_THREE_STORES_SHARED_ORIGIN_NARROW_PASS';
}catch(e){proof.status='FAIL';proof.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();proof.resourcesClosed=true;proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}})();
