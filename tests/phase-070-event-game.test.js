'use strict';
// Supporting actual-source stress regression, not a substitute for native input.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),Signals=require('../editor/src/00-signals');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const owners=Array.from({length:16},(_,i)=>({id:'receiver-'+i,variables:{}})),definitions=[{id:'charge',name:'Charge',payloadType:'number'}];
const ctx={OpusSignals:Signals,OpusGraphValues:require('../editor/src/00-graph-values'),OpusGraphVariables:require('../editor/src/00-graph-variables'),OpusGraphFunctions:require('../editor/src/00-graph-functions'),OpusAuthoringLanguage:require('../editor/src/00-authoring-language'),signalDefinitions:definitions,graphFunctions:[],window:{__gameState:{}},findItemById:id=>owners.find(o=>o.id===id),resolveTarget:(p,item)=>p.targetId?owners.find(o=>o.id===p.targetId):item,gameEnded:false,pendingDelays:[],simElapsed:0,placed:owners};
vm.createContext(ctx);
function load(begin,end){const i=source.indexOf(begin),j=source.indexOf(end,i);assert(i>=0&&j>i);vm.runInContext(source.slice(i,j),ctx);}
load('const ACTION_TYPES = {','// Reads a behavior record');load('function runAction(','// --- Node graph');load('const GRAPH_NODE_TYPES = {}','// (from-port, to-port)');load('function evaluateConditionNode(','// A graph action node');load('function resolveGraphNodeValues(','// Delay/Wait nodes');load('function runGraph(','function runBehaviors(');
ctx.graphFunctions=[{id:'relay',name:'Charge relay',graph:{nodes:[{id:'wait',type:'delay',seconds:.2},{id:'read',type:'readSignalValue',signalId:'charge'},{id:'energy',type:'incrementObjectVariable',name:'energy',amount:99}],edges:[{kind:'next',from:'start',to:'wait'},{kind:'next',from:'wait',to:'energy'},{kind:'value',from:'read',to:'energy',toField:'amount'}]}}];
const receiver={action:'graph',graph:{nodes:[{id:'call',type:'callGraphFunction',functionId:'relay'}],edges:[{kind:'next',from:'start',to:'call'}]}},diagnostics=Signals.createDiagnostics();diagnostics.setEnabled(true);
const queue=Signals.create({definitions:()=>definitions,isActive:()=>true,receivers:()=>owners.slice(),isAlive:o=>owners.includes(o),deliver:(owner,id,event)=>ctx.runAction(receiver,owner,event),onObserve:event=>diagnostics.record(event)});
for(let session=0;session<100;session++){
  owners.forEach(o=>{o.variables={};});ctx.pendingDelays.length=0;queue.clear();diagnostics.clear();
  for(let click=0;click<10;click++)assert(queue.emit('charge',7));
  assert(!queue.emit('charge','7'),'Strict numeric filter remains uncoerced');
  queue.drain();assert.equal(queue.pending(),0);assert.equal(ctx.pendingDelays.length,160);
  assert(owners.every(o=>o.variables.energy===undefined));ctx.simElapsed+=.25;ctx.processPendingDelays();
  assert(owners.every(o=>o.variables.energy===70),'Actual Function/Wait/Value binding independently accumulates ten7 occurrences per receiver');
  assert.equal(ctx.pendingDelays.length,0);assert.equal(owners.length,16);
  const captured=diagnostics.snapshot();assert.equal(captured.records.length,128);assert(captured.dropped>0);assert(captured.records.every(r=>!('owner' in r)&&!('receiver' in r)),'Diagnostics retain only bounded primitive records, not object graphs');
}
queue.clear();diagnostics.clear();assert.equal(queue.pending(),0);assert.equal(diagnostics.snapshot().records.length,0);
console.log('Phase070 actual canonical Signal/graph/Function/Wait typed fan-out100 independent sessions, bounded diagnostics and empty work queues PASS; real gameplay is qualified separately');
