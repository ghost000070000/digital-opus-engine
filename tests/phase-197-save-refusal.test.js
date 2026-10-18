'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),s=fs.readFileSync('editor/src/01-editor.js','utf8');
const begin=s.indexOf("document.getElementById('save-btn').addEventListener"),end=s.indexOf("document.getElementById('delete-project-btn')",begin);assert(begin>=0&&end>begin);
let handler,status='',writes=0,onboard=0,refresh=0,fail=true;
const elements=new Map(),c={playMode:false,levels:[],projectDurability:{},projectAuthoredSignature:()=> 'signature',projectHasUnsavedChanges:()=>false,withProjectStorageLock:async work=>work(),renderProjectDurability:()=>{},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,id==='save-btn'?{addEventListener:(event,fn)=>{handler=fn;}}:{value:'fixture'});return elements.get(id);}},serializeProject:()=>{if(fail)throw new Error('Unsupported asset metadata; original library unchanged.');return {retained:true};},app:{save:{saveChecked:(name,project)=>{writes++;assert.equal(name,'fixture');assert(project.retained);return {ok:true,raw:'verified-envelope'};}}},showStatus:text=>{status=text;},markOnboardingProgress:()=>{onboard++;},renderProjectList:()=>{refresh++;}};
vm.createContext(c);vm.runInContext(s.slice(begin,end),c);
(async()=>{
await assert.doesNotReject(()=>handler(),'Actual async Save must contain serialization refusal and show feedback');assert.match(status,/Save failed: Unsupported asset metadata/);assert.equal(writes,0);assert.equal(onboard,0);assert.equal(refresh,0);
fail=false;await handler();assert.equal(writes,1);assert.equal(onboard,1);assert.equal(refresh,1);assert.match(status,/Saved as/);assert.equal(c.projectDurability.raw,'verified-envelope');
c.app.save.saveChecked=()=>({ok:false,code:'quota'});await handler();assert.equal(onboard,1);assert.equal(refresh,1);assert.match(status,/Browser storage is full/);assert.equal(c.projectDurability.error,'quota');
console.log('Phase197 actual Save handler serialization refusal/no persistence/onboarding writes and successful recovery PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
