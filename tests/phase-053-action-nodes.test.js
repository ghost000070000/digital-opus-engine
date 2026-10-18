'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../editor/src/01-editor.js'),'utf8');
const start=source.indexOf('function renderGraphNodeHTML('),end=source.indexOf('// --- Node Graph pan/zoom ---',start);
const language=require('../editor/src/00-authoring-language');
const context={GRAPH_NODE_TYPES:{},ACTION_TYPES:{},CONDITION_TYPES:{},OpusAuthoringLanguage:language,graphEditorState:{item:{}},escapeHtml:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),graphNodePortId:(id,p)=>id+'::'+p,renderActionFieldInput:()=>'<input>'};
context.OpusGraphValues=require('../editor/src/00-graph-values');
context.OpusGraphVariables=require('../editor/src/00-graph-variables');
context.OpusGraphFunctions=require('../editor/src/00-graph-functions');
context.OpusSignals=require('../editor/src/00-signals');context.signalDefinitions=[];
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
const unknown={id:'legacy-node',type:'unavailable-action',x:12,y:34,payload:{keep:true},targetId:'historical-ref'},before=JSON.stringify(unknown);
const rendered=context.renderGraphNodeHTML(unknown);
assert(rendered.includes('Unavailable'),'Unknown historical nodes remain inspectable');
assert(rendered.includes('unavailable-action'));assert.equal(JSON.stringify(unknown),before,'Rendering never migrates unknown data');
console.log('Phase053 unknown historical Action rendering/payload preservation PASS');
// Evaluate the real registry declaration: exec closures are created, not invoked.
const registryStart=source.indexOf('const ACTION_TYPES = {'),registryEnd=source.indexOf('function executeAction(',registryStart);
vm.runInContext(source.slice(registryStart,registryEnd)+'\nglobalThis.realActions=ACTION_TYPES;',context);
const projectionStart=source.indexOf('const GRAPH_NODE_TYPES = {}'),projectionEnd=source.indexOf('// (from-port, to-port)',projectionStart);
vm.runInContext(source.slice(projectionStart,projectionEnd)+'\nglobalThis.realGraphTypes=GRAPH_NODE_TYPES;',context);
const dispatchStart=source.indexOf('function resolveGraphNodeValues('),dispatchEnd=source.indexOf('// Delay/Wait nodes',dispatchStart);
const calls=[];context.executeAction=(type,params,owner)=>calls.push({type,params,owner});vm.runInContext(source.slice(dispatchStart,dispatchEnd),context);
const owner={id:'owner'};let total=0;
for(const [type,def] of Object.entries(context.realActions)){
 if(type==='script'){assert(!context.realGraphTypes[type]);continue;}
 const graph=context.realGraphTypes[type];assert(graph,'Missing registry Action '+type);assert.strictEqual(graph.fields,def.fields,'Shared fields, not copied '+type);assert.equal(graph.label,def.label);assert.equal(graph.kind,'action');
 const node={id:'n'+total,type,x:0,y:0};for(const field of def.fields)node[field.key]=field.type==='number'?7:field.type==='checkbox'?true:'historical-value';
 context.runGraphActionNode(node,owner);const call=calls.at(-1);assert.equal(call.type,type);assert.strictEqual(call.params,node);assert.strictEqual(call.owner,owner);
 const html=context.renderGraphNodeHTML(node);for(const field of def.fields)assert(html.includes(context.escapeHtml(field.label||field.placeholder||field.key)),'Visible parameter label '+type+'.'+field.key);
 total++;
}
assert(total>30);console.log('Phase053 full actual registry projection/labels/flat execution delegation PASS: '+total+' Actions (not full effect acceptance)');
