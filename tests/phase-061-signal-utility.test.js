'use strict';
// Characterization, not an assertion that state APIs are defective.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const owners=[{kind:'cube',id:'receiver-a',variables:{}},{kind:'cube',id:'receiver-b',variables:{}}];
const ctx={OpusAuthoringLanguage:require('../editor/src/00-authoring-language'),OpusGraphSchema:require('../editor/src/00-graph-schema'),OpusGraphFunctions:require('../editor/src/00-graph-functions'),OpusGraphVariables:require('../editor/src/00-graph-variables'),OpusGraphValues:require('../editor/src/00-graph-values'),window:{},placed:owners,gameEnded:false,pendingDelays:[],graphFunctions:[],simElapsed:0,resolveTarget:(p,item)=>item};
vm.createContext(ctx);function load(a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i);vm.runInContext(source.slice(i,j),ctx);}
load('const ACTION_TYPES = {','// Reads a behavior record');load('function runAction(','// --- Node graph');load('const GRAPH_NODE_TYPES = {}','// (from-port, to-port)');load('function evaluateConditionNode(','// A graph action node');load('function resolveGraphNodeValues(','// Delay/Wait nodes');load('function runGraph(','function runBehaviors(');load('function runBehaviors(','// Phase 024: Sprite frame events');
const graph={nodes:[{id:'count',type:'incrementObjectVariable',name:'visits',amount:1,targetId:''},{id:'gate',type:'isFlagTrue',name:'door-open'}],edges:[{from:'start',to:'count',kind:'next'},{from:'gate',to:'count',kind:'gate'}]};
for(const owner of owners)owner.behaviors=[{trigger:'update',action:'graph',graph}];
ctx.executeAction('setFlagTrue',{name:'door-open'});ctx.executeAction('setFlagTrue',{name:'door-open'});
for(let i=0;i<5;i++)ctx.runLifecycleBehaviors('update');
assert.deepStrictEqual(owners.map(o=>o.variables.visits),[5,5],'Persistent state polling repeats while true, not once per occurrence');
for(const owner of owners)owner.variables={};
const consumed=JSON.parse(JSON.stringify(graph));consumed.nodes.push({id:'clear',type:'setFlagFalse',name:'door-open'});consumed.edges.push({from:'count',to:'clear',kind:'next'});owners[0].behaviors[0].graph=consumed;
ctx.executeAction('setFlagTrue',{name:'door-open'});ctx.executeAction('setFlagTrue',{name:'door-open'});for(let i=0;i<5;i++)ctx.runLifecycleBehaviors('update');
assert.deepStrictEqual(owners.map(o=>o.variables.visits||0),[1,0],'Shared clearing coalesces repeated occurrences and denies later independent receiver');
assert.equal(ctx.window.__gameFlags['door-open'],false);
console.log('Phase061 actual canonical state/polling utility characterization PASS: persistent [5,5], shared-consume [1,0]; state APIs retain intended semantics');
