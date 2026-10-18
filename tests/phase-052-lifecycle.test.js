'use strict';
const fs=require('fs'),assert=require('assert'),vm=require('vm'),language=require('../editor/src/00-authoring-language');
const source=fs.readFileSync(require('path').join(__dirname,'../editor/src/01-editor.js'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0);const brace=source.indexOf('{',start);let depth=1,i=brace+1;for(;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
const calls=[],item={kind:'cube',behaviors:[{trigger:'start',action:'a'},{trigger:'update',action:'b'}]},other={kind:'terrain',behaviors:[{trigger:'update',action:'excluded'}]};
const context={placed:[item,other],gameEnded:false,runAction:(b)=>calls.push(b.action)};
vm.createContext(context);vm.runInContext(extract('runBehaviors')+'\n'+extract('runLifecycleBehaviors'),context);
context.runLifecycleBehaviors('start');assert.deepStrictEqual(calls,['a']);context.runLifecycleBehaviors('update');assert.deepStrictEqual(calls,['a','b']);context.gameEnded=true;context.runLifecycleBehaviors('update');assert.equal(calls.length,2);
context.gameEnded=false;context.runAction=(b)=>{calls.push(b.action);context.placed.push({kind:'cube',behaviors:[{trigger:'update',action:'spawned'}]});};context.runLifecycleBehaviors('update');assert.equal(calls.at(-1),'b','New subscribers do not join same snapshot tick');
const removing={kind:'cube',behaviors:[{trigger:'update',action:'remove-next'}]},removed={kind:'cube',behaviors:[{trigger:'update',action:'must-not-run'}]};context.placed=[removing,removed];calls.length=0;context.runAction=b=>{calls.push(b.action);if(b.action==='remove-next')context.placed.splice(1,1);};context.runLifecycleBehaviors('update');assert.deepStrictEqual(calls,['remove-next'],'Removed owners must not dispatch stale snapshot Events');
assert(language.EVENTS.some(e=>e.id==='update'&&e.aliases.includes('On Tick')));assert(source.includes("runLifecycleBehaviors('start')"));assert(source.indexOf("if (!playMode) return;",source.indexOf('app.onUpdate((dt, elapsed) =>'))<source.indexOf("runLifecycleBehaviors('update')"));assert(source.includes('existingBehavior.trigger = trigger'));assert(source.includes("graphNodePortId('start', 'next-out')"));
console.log('Phase052 actual-source lifecycle: Start/Update dispatch, ended guard, subscriber snapshot and historical entry seam PASS');
