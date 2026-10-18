'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),src=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const env={lighting2D:{enabled:false,ambient:.25}},elements={},history=[];
const el=id=>elements[id]||(elements[id]={value:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}});
const c={playMode:false,document:{getElementById:el},Opus:{Vec3:class Vec3{}},app:{getEnvironment:()=>JSON.parse(JSON.stringify(env)),setEnvironment:p=>{for(const key of Object.keys(p))Object.assign(env[key],p[key]);}},pushUndo:()=>history.push(JSON.parse(JSON.stringify(env)))};vm.createContext(c);
vm.runInContext(src.slice(src.indexOf('function changeEnvironmentAuthoring('),src.indexOf('function renderEnvironmentPanel(')),c);
vm.runInContext(src.slice(src.indexOf('function setShadowAuthoringControlsEditable('),src.indexOf('function applyLevelPlayerSettings(')),c);
vm.runInContext(src.slice(src.indexOf('function normalizeEnvironment('),src.indexOf('// The ONE normalization path',src.indexOf('function normalizeEnvironment('))),c);
const ambient=el('env-lighting2d-ambient');for(const value of ['','-1','1.1','2junk','Infinity']){ambient.value=value;ambient.oninput();assert.equal(ambient.attrs['aria-invalid'],'true');assert(!ambient.onchange());assert.equal(history.length,0);ambient.onblur();assert.equal(ambient.value,'0.25');}
ambient.value='0';ambient.oninput();assert.equal(env.lighting2D.ambient,.25);assert(ambient.onchange());assert.equal(env.lighting2D.ambient,0);assert.equal(history.length,1);assert.equal(history[0].lighting2D.ambient,.25);assert(!ambient.onchange());
const enabled=el('env-lighting2d-enabled');enabled.checked=true;assert(enabled.onchange());assert.equal(history.length,2);
c.playMode=true;c.setShadowAuthoringControlsEditable();assert(ambient.disabled&&enabled.disabled);ambient.value='1';assert(!ambient.onchange());assert.equal(history.length,2);
const legacy={fogDensity:0};const out=c.normalizeEnvironment(legacy);assert.deepStrictEqual(JSON.parse(JSON.stringify(out.lighting2D)),{enabled:false,ambient:.25});assert(!legacy.lighting2D);
const authored={lighting2D:{enabled:true,ambient:0}};const detached=c.normalizeEnvironment(authored);detached.lighting2D.ambient=1;assert.equal(authored.lighting2D.ambient,0);
for(const value of [null,[],false,{enabled:1},{ambient:NaN},{ambient:-1},{ambient:1.01},{shadows:true}])assert.throws(()=>c.normalizeEnvironment({lighting2D:value}),/2D lighting/);
console.log('PASS179 actual no-code fields strict invalid recovery/zero/no-op/history/Play, detached normalization and legacy defaults. Native gates still open.');
