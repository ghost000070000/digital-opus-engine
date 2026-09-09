'use strict';
// Read-only browser review of the local generated presentation surfaces.
const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'rehabilitation-evidence','public-artifact-review');fs.mkdirSync(out,{recursive:true});
const catalog=JSON.parse(fs.readFileSync(path.join(root,'games/catalog.json')));
const pages=[['engine-home','dist/engine-site/index.html'],['engine-examples','dist/engine-site/games/index.html'],['standalone-launcher','dist/games/index.html'],['games-site','dist/games-site/index.html'],['review','public-showcase-review/index.html']];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const results={reviewedAt:new Date().toISOString(),catalog:catalog.games.map(g=>({id:g.id,title:g.title,visibility:g.visibility,qualityTier:g.qualityTier})),pages:[]};
 try{for(const [id,url] of pages){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[],httpErrors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()});});
  const response=await page.goto('http://localhost:8837/'+url,{waitUntil:'networkidle',timeout:60000});
  for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=700){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(45);}
  await page.waitForTimeout(250);
  const inspect=()=>page.evaluate(()=>({title:document.title,text:document.body.innerText,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()),images:[...document.images].map(e=>({src:e.getAttribute('src'),alt:e.alt,loaded:e.complete&&e.naturalWidth>0,width:e.naturalWidth,height:e.naturalHeight})),links:[...document.querySelectorAll('a[href]')].map(e=>({href:e.getAttribute('href'),text:e.textContent.trim(),visible:!!e.getClientRects().length})),iframes:document.querySelectorAll('iframe').length,editorChrome:!!document.querySelector('#toolbar,#inspector,#hierarchy-panel'),articles:document.querySelectorAll('article').length}));
  const desktop=await inspect();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,id+'-desktop.png')});
  const firstCard=page.locator('article,.game-card,.card').first();if(await firstCard.count()){await firstCard.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,id+'-cards.png')});}
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100);const narrow=await inspect();await page.screenshot({path:path.join(out,id+'-narrow.png')});
  const publicOnly=!['review','standalone-launcher'].includes(id);const linkedIds=[...new Set(catalog.games.filter(g=>desktop.links.some(l=>l.visible&&new RegExp('(?:^|/)'+g.id+'(?:\\.html)?(?:[?#].*)?$').test(l.href))).map(g=>g.id))];
  const internalLinked=linkedIds.filter(gid=>catalog.games.find(g=>g.id===gid).visibility!=='public');
  const record={id,url,status:response.status(),errors,httpErrors,linkedIds,internalLinked,publicOnly,desktop,narrow};results.pages.push(record);
  console.log(id,JSON.stringify({status:record.status,images:desktop.images.length,brokenImages:desktop.images.filter(i=>!i.loaded).length,linkedGames:linkedIds.length,internalLinked,desktopOverflow:desktop.scrollWidth>desktop.viewport,narrowOverflow:narrow.scrollWidth>narrow.viewport,errors,httpErrors}));
  await context.close();
 }}finally{await browser.close();fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(results,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
