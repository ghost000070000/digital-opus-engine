'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const api=fs.readFileSync(require.resolve('../engine/src/22-api.js'),'utf8'),renderer=fs.readFileSync(require.resolve('../engine/src/09-renderer.js'),'utf8');
function method(name){const start=api.indexOf('  '+name+'(');assert(start>=0);const brace=api.indexOf(') {',start)+2;let end=brace+1,depth=1;while(depth){if(api[end]==='{')depth++;if(api[end]==='}')depth--;end++;}return 'function '+api.slice(start+2,end);}
const ctx={};vm.createContext(ctx);
for(const name of ['fail','finite','optionsObject']){const start=api.indexOf('function '+name+'('),brace=api.indexOf(') {',start)+2;let end=brace+1,depth=1;while(depth){if(api[end]==='{')depth++;if(api[end]==='}')depth--;end++;}vm.runInContext(api.slice(start,end),ctx);}
vm.runInContext(method('configurePostProcessing')+'\n'+method('getPostProcessing'),ctx);
vm.runInContext(method('getPostProcessingInfo'),ctx);
const budgetHost={_alive(){},_renderer:{_postTarget:{width:640,height:480,samples:4}}};
assert.equal(ctx.getPostProcessingInfo.call(budgetHost).estimatedTargetBytes,640*480*32);
const detached=ctx.getPostProcessingInfo.call(budgetHost);detached.width=1;assert.equal(ctx.getPostProcessingInfo.call(budgetHost).width,640);
budgetHost._renderer._postTarget=null;assert.equal(ctx.getPostProcessingInfo.call(budgetHost).estimatedTargetBytes,0);assert.equal(ctx.getPostProcessingInfo.call(budgetHost).active,false);
const app={_alive(){},_postProcessing:{enabled:false,exposure:0,saturation:1},configure:ctx.configurePostProcessing,get:ctx.getPostProcessing};
for(const patch of [{enabled:'yes'},{exposure:Infinity},{saturation:-1},{exposure:4.1},{saturation:2.1},{unknown:1},{enabled:true,exposure:NaN}]){const before=JSON.stringify(app.get());assert.throws(()=>app.configure(patch));assert.equal(JSON.stringify(app.get()),before,'Rejected patches are atomic');}
app.configure({enabled:true,exposure:-1,saturation:0});assert.equal(app.get().saturation,0);app.get().exposure=9;assert.equal(app.get().exposure,-1);app.configure({exposure:0});assert.equal(app.get().saturation,0);
function fixture(antialias=true){let next=1;const calls=[],gl=new Proxy({canvas:{width:640,height:480},getContextAttributes:()=>({antialias}),getParameter:()=>4,checkFramebufferStatus:()=> 'FRAMEBUFFER_COMPLETE'},{get(target,key){if(key in target)return target[key];if(/^[A-Z0-9_]+$/.test(key))return key;return (...args)=>{calls.push([key,...args]);return key.startsWith('create')?{id:next++}:undefined;};}});const c={createProgram:()=>({program:true}),POST_VERT_SRC:'',POST_FRAG_SRC:''};vm.createContext(c);vm.runInContext(renderer+'\nglobalThis.RendererClass=Renderer;',c);const instance=Object.create(c.RendererClass.prototype);Object.assign(instance,{gl,skyQuad:{vao:{},vertexCount:6}});return {instance,gl,calls};}
const off={enabled:false,exposure:2,saturation:0},identity={enabled:true,exposure:0,saturation:1},look={enabled:true,exposure:-1,saturation:0};
const f=fixture();assert(!f.instance.beginSceneFrame(off));assert(!f.instance.beginSceneFrame(identity));assert(!f.calls.some(c=>c[0].startsWith('create')),'Default and identity allocate nothing');
assert(f.instance.beginSceneFrame(look));const first=f.instance._postTarget;assert.equal(first.samples,4);f.instance.finishSceneFrame(look);assert(f.calls.some(c=>c[0]==='blitFramebuffer'));assert(f.calls.some(c=>c[0]==='uniform1f'&&c[2]===0),'Literal saturation0 uploaded');
const creates=f.calls.filter(c=>c[0].startsWith('create')).length;f.instance.beginSceneFrame(look);assert.equal(f.calls.filter(c=>c[0].startsWith('create')).length,creates,'Stable size reuses resources');
f.gl.canvas.width=800;f.instance.beginSceneFrame(look);assert.notEqual(f.instance._postTarget,first);assert.equal(f.instance._postTarget.width,800);assert(f.calls.some(c=>c[0]==='deleteTexture'&&c[1]===first.texture));
f.instance.beginSceneFrame(off);assert.equal(f.instance._postTarget,null);assert.equal(f.calls.filter(c=>c[0]==='deleteRenderbuffer').length,4,'Resize and disable release both renderbuffers');
const single=fixture(false);single.instance.beginSceneFrame(look);assert.equal(single.instance._postTarget.samples,0);single.instance.finishSceneFrame(look);assert(!single.calls.some(c=>c[0]==='blitFramebuffer'));
const bad=fixture();bad.gl.checkFramebufferStatus=()=> 'INCOMPLETE';assert.throws(()=>bad.instance.beginSceneFrame(look),/Scene Look/);assert.equal(bad.instance._postTarget,null);
const renderBody=api.slice(api.indexOf('  _render() {'),api.indexOf('  /** Creates and adds an Entity.'));
assert(renderBody.indexOf('this._renderer.beginSceneFrame')<renderBody.indexOf('this._renderer.renderScene'));assert(renderBody.indexOf('this._renderer.finishSceneFrame')>renderBody.indexOf('this._renderer.renderParticles'));assert(renderBody.indexOf('this._renderer.finishSceneFrame')<renderBody.indexOf('captureScreenshot'));
console.log('PASS actual public post settings atomic/detached/zero; renderer lazy identity bypass, multisample resolve, size reuse/release, single-sample fallback, incomplete cleanup and all-scene/screenshot ordering');
