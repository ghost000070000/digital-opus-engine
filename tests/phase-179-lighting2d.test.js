'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const api=fs.readFileSync(require.resolve('../engine/src/22-api.js'),'utf8');
const renderer=fs.readFileSync(require.resolve('../engine/src/09-renderer.js'),'utf8');
const shader=fs.readFileSync(require.resolve('../engine/src/07-shader.js'),'utf8');
function extract(prefix){const start=api.indexOf(prefix);assert(start>=0);const brace=api.indexOf(') {',start)+2;let end=brace+1,depth=1;while(depth){if(api[end]==='{')depth++;if(api[end]==='}')depth--;end++;}return api.slice(start,end);}
const ctx={};vm.createContext(ctx);
for(const name of ['fail','finite','optionsObject'])vm.runInContext(extract('function '+name+'('),ctx);
for(const name of ['configureLighting2D','getLighting2D'])vm.runInContext('function '+extract('  '+name+'(').trim(),ctx);
const app={_alive(){},_renderer:{lighting2D:{enabled:false,ambient:.25}},configure:ctx.configureLighting2D,get:ctx.getLighting2D};
assert.equal(app.get().enabled,false);
for(const patch of [null,[],{enabled:1},{ambient:-.1},{ambient:1.1},{ambient:NaN},{ambient:Infinity},{enabled:true,ambient:2},{unknown:0}]){
  const before=JSON.stringify(app.get());assert.throws(()=>app.configure(patch));assert.equal(JSON.stringify(app.get()),before,'Rejected patches must not partially enable lighting');
}
app.configure({enabled:true,ambient:0});assert.equal(app.get().ambient,0);app.get().ambient=.9;assert.equal(app.get().ambient,0);
app.configure({enabled:false});assert.equal(app.get().ambient,0);app.configure({ambient:1});assert.equal(app.get().ambient,1);
const lines=renderer.split('\n').filter(line=>/gl.uniform1[i|f]\(this.u(Lighting2D|Ambient2D),/.test(line));assert.equal(lines.length,4);
const calls=[],drawCtx={gl:{uniform1i:(...v)=>calls.push(v),uniform1f:(...v)=>calls.push(v)},entity:{spriteRenderer:{}},host:{uLighting2D:'enabled',uAmbient2D:'ambient',lighting2D:{enabled:true,ambient:0}}};vm.createContext(drawCtx);
vm.runInContext('(function(){'+lines.slice(0,2).join('\n')+'}).call(host)',drawCtx);assert.equal(calls[0][1],1);assert.equal(calls[1][1],0);
drawCtx.entity={unlit:true};calls.length=0;vm.runInContext('(function(){'+lines.slice(0,2).join('\n')+'}).call(host)',drawCtx);assert.equal(calls[0][1],0,'Unlit3D entities must not participate');
calls.length=0;drawCtx.host.lighting2D.enabled=false;vm.runInContext('(function(){'+lines.slice(2).join('\n')+'}).call(host)',drawCtx);assert.equal(calls[0][1],0,'Tilemap opt-in remains off by default');
assert(shader.includes('vec2 delta = v_worldPos.xy - u_lightPos[i].xy;'));
assert(shader.includes('if (directionLength < 0.0001) continue;'));
assert(shader.includes('dist < 0.0001 ? 1.0'));
assert(shader.includes('if (u_lighting2D) {\n    color = planarLightsContribution(albedo);\n  } else if (u_unlit)'));
assert(shader.includes('outColor = vec4(color, u_alpha * texAlpha);'));
assert(api.includes('if (options.lighting2D !== undefined) this.configureLighting2D(options.lighting2D);'));
assert(api.includes('lighting2D: this.getLighting2D(),'));
console.log('PASS179 actual public atomic/zero/detached settings and Sprite-only/Tilemap default upload contracts; shader planar guards/alpha wiring. GPU visual acceptance still required.');
