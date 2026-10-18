'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const language = require('../editor/src/00-authoring-language.js');

const tests = []; let passed = 0;
function test(name, fn) { tests.push({ name, fn }); }
function eventClip(mode = 'loop') { return plumbing.createSpriteAnimationClip({ id: 'walk', name: 'Walk', playbackMode: mode, frames: [
  { spriteAsset: 's0', durationMs: 100, events: [{ id: 'foot-left', name: 'Footstep Left' }] },
  { spriteAsset: 's1', durationMs: 100, events: [] },
  { spriteAsset: 's2', durationMs: 100, events: [{ id: 'foot-right', name: 'Footstep Right' }, { id: 'dust', name: 'Dust' }] },
  { spriteAsset: 's3', durationMs: 100, events: [] },
] }); }
const editor = fs.readFileSync(path.join(__dirname, '../editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../editor/index.html'), 'utf8');
const runner = fs.readFileSync(path.join(__dirname, 'run-tests.js'), 'utf8');

test('Sprite Animation asset schema advances to v3', () => assert.strictEqual(plumbing.assetTypes.get('sprite-animation').version, 3));
test('new Clips serialize as v3', () => assert.strictEqual(eventClip().version, 3));
test('v1 Clip migration gains empty event arrays', () => assert.deepStrictEqual(plumbing.createSpriteAnimationClip({version:1,frames:[{spriteAsset:'s',durationMs:10}]}).frames[0].events, []));
test('v2 Clip migration gains empty event arrays', () => assert.deepStrictEqual(plumbing.createSpriteAnimationClip({version:2,frames:[{spriteAsset:'s',durationMs:10}]}).frames[0].events, []));
test('v3 normalization preserves event IDs and names only', () => assert.deepStrictEqual(plumbing.createSpriteAnimationClip({frames:[{events:[{id:'hit',name:'Hit',action:'bad'}]}]}).frames[0].events,[{id:'hit',name:'Hit'}]));
test('event flattening retains frame indices', () => assert.deepStrictEqual(plumbing.spriteAnimationEvents(eventClip()).map((e)=>[e.id,e.frameIndex]),[['foot-left',0],['foot-right',2],['dust',2]]));
test('event ID derives from name', () => assert.strictEqual(plumbing.createSpriteAnimationEvent({frames:[]},{name:'Damage Window'}).id,'damage-window'));
test('event ID collision gets deterministic suffix', () => assert.strictEqual(plumbing.createSpriteAnimationEvent(eventClip(),{name:'Foot Left',id:null}).id,'foot-left-2'));
test('event name collision gets deterministic suffix', () => assert.strictEqual(plumbing.createSpriteAnimationEvent(eventClip(),{name:'Dust'}).name,'Dust 2'));
test('multiple events retain authored array order', () => assert.deepStrictEqual(eventClip().frames[2].events.map((e)=>e.id),['foot-right','dust']));
test('frame reorder naturally carries event records', () => { const c=eventClip(); const f=c.frames.splice(2,1)[0]; c.frames.splice(0,0,f); assert.deepStrictEqual(c.frames[0].events.map((e)=>e.id),['foot-right','dust']); });
test('duration edits preserve event identity', () => { const c=eventClip(); c.frames[0].durationMs=250; assert.strictEqual(c.frames[0].events[0].id,'foot-left'); });
test('Sprite Asset edits preserve event identity', () => { const c=eventClip(); c.frames[0].spriteAsset='replacement'; assert.strictEqual(c.frames[0].events[0].id,'foot-left'); });
test('duplicated frame copies names', () => { const c=eventClip(); assert.strictEqual(plumbing.duplicateSpriteAnimationFrame(c,c.frames[2]).events[0].name,'Footstep Right 2'); });
test('duplicated frame generates new IDs', () => { const c=eventClip(); assert.notStrictEqual(plumbing.duplicateSpriteAnimationFrame(c,c.frames[2]).events[0].id,'foot-right'); });
test('duplicated Clip gets new Clip ID', () => assert.strictEqual(plumbing.duplicateSpriteAnimationClip(eventClip(),'walk-copy').id,'walk-copy'));
test('duplicated Clip preserves local event IDs', () => assert.deepStrictEqual(plumbing.duplicateSpriteAnimationClip(eventClip(),'walk-copy').frames[2].events.map((e)=>e.id),['foot-right','dust']));
test('duplicate event IDs validate', () => { const c=eventClip(); c.frames[1].events=[{id:'foot-left',name:'Other'}]; assert(plumbing.assetTypes.validate(c,'sprite-animation').some((x)=>x.code==='duplicate-sprite-animation-event-id')); });
test('duplicate event names warn', () => { const c=eventClip(); c.frames[1].events=[{id:'other',name:'footstep left'}]; assert(plumbing.assetTypes.validate(c,'sprite-animation').some((x)=>x.code==='duplicate-sprite-animation-event-name')); });
test('missing event ID validates', () => { const c=eventClip(); c.frames[1].events=[{id:'',name:'X'}]; assert(plumbing.assetTypes.validate(c,'sprite-animation').some((x)=>x.code==='sprite-animation-event-id-required')); });
test('missing event name validates', () => { const c=eventClip(); c.frames[1].events=[{id:'x',name:''}]; assert(plumbing.assetTypes.validate(c,'sprite-animation').some((x)=>x.code==='sprite-animation-event-name-required')); });
test('frame zero fires on start', () => { const seen=[]; plumbing.playSpriteAnimation(plumbing.createSpriteAnimationPlayback('walk',false),eventClip(),true,{targetSpriteId:'hero',stateId:'walk',onEvent:(e)=>seen.push(e)}); assert.deepStrictEqual(seen.map((e)=>e.eventId),['foot-left']); });
test('event context is immutable', () => { let context; plumbing.playSpriteAnimation(plumbing.createSpriteAnimationPlayback('walk',false),eventClip(),true,{onEvent:(e)=>context=e}); assert(Object.isFrozen(context)); });
test('event context carries stable routing fields', () => { let e; plumbing.playSpriteAnimation(plumbing.createSpriteAnimationPlayback('walk',false),eventClip(),true,{targetSpriteId:'hero',stateId:'walk',onEvent:(x)=>e=x}); assert.deepStrictEqual([e.targetSpriteId,e.clipId,e.eventId,e.eventName,e.frameIndex,e.stateId,e.loop],['hero','walk','foot-left','Footstep Left',0,'walk',0]); });
test('ordinary advance fires crossed frame events', () => { const c=eventClip(); const p=plumbing.createSpriteAnimationPlayback(c.id,false); const seen=[]; plumbing.playSpriteAnimation(p,c,true,{onEvent:(e)=>seen.push(e.eventId)}); plumbing.advanceSpriteAnimation(p,c,.25,{onEvent:(e)=>seen.push(e.eventId)}); assert.deepStrictEqual(seen,['foot-left','foot-right','dust']); });
test('same-state switch without restart emits nothing', () => { const c=eventClip(); const renderer={animationStates:[{id:'walk-state',name:'Walk',clipRef:'walk'}]}; const p=plumbing.createSpriteAnimationPlayback(null,false); const seen=[]; plumbing.setSpriteAnimationState(p,renderer,'walk-state',()=>c,{onEvent:(e)=>seen.push(e.eventId)}); seen.length=0; plumbing.setSpriteAnimationState(p,renderer,'walk-state',()=>c,{onEvent:(e)=>seen.push(e.eventId)}); assert.deepStrictEqual(seen,[]); });
test('same-state explicit restart refires frame zero', () => { const c=eventClip(); const renderer={animationStates:[{id:'walk-state',name:'Walk',clipRef:'walk'}]}; const p=plumbing.createSpriteAnimationPlayback(null,false); const seen=[]; plumbing.setSpriteAnimationState(p,renderer,'walk-state',()=>c,{onEvent:(e)=>seen.push(e.eventId)}); seen.length=0; plumbing.setSpriteAnimationState(p,renderer,'walk-state',()=>c,{restartIfActive:true,onEvent:(e)=>seen.push(e.eventId)}); assert.deepStrictEqual(seen,['foot-left']); });
test('different-state switch fires destination frame zero', () => { const a=eventClip(); const b=plumbing.createSpriteAnimationClip({id:'attack',frames:[{spriteAsset:'a',durationMs:100,events:[{id:'whoosh',name:'Whoosh'}]}]}); const renderer={animationStates:[{id:'walk',name:'Walk',clipRef:'walk'},{id:'attack',name:'Attack',clipRef:'attack'}]}; const p=plumbing.createSpriteAnimationPlayback(null,false); const seen=[]; plumbing.setSpriteAnimationState(p,renderer,'walk',(id)=>id==='walk'?a:b,{onEvent:(e)=>seen.push(e.eventId)}); seen.length=0; plumbing.setSpriteAnimationState(p,renderer,'attack',(id)=>id==='walk'?a:b,{onEvent:(e)=>seen.push(e.eventId)}); assert.deepStrictEqual(seen,['whoosh']); });
test('loop wrap refires frame zero', () => { const c=eventClip(); const p=plumbing.createSpriteAnimationPlayback(c.id,false); const seen=[]; plumbing.playSpriteAnimation(p,c,true,{onEvent:(e)=>seen.push(e.eventId)}); seen.length=0; plumbing.advanceSpriteAnimation(p,c,.4,{onEvent:(e)=>seen.push(e.eventId)}); assert.deepStrictEqual(seen,['foot-right','dust','foot-left']); });
test('three loops dispatch exactly in deterministic order', () => { const c=eventClip(); const p=plumbing.createSpriteAnimationPlayback(c.id,false); const seen=[]; plumbing.playSpriteAnimation(p,c,true,{onEvent:(e)=>seen.push(e.eventId)}); seen.length=0; plumbing.advanceSpriteAnimation(p,c,1.2,{onEvent:(e)=>seen.push(e.eventId)}); assert.strictEqual(seen.filter((id)=>id==='foot-left').length,3); assert.strictEqual(seen.filter((id)=>id==='foot-right').length,3); });
test('large delta lands on exact wrapped position', () => { const c=eventClip(); const p=plumbing.createSpriteAnimationPlayback(c.id,false); plumbing.playSpriteAnimation(p,c,true); plumbing.advanceSpriteAnimation(p,c,1.25); assert.deepStrictEqual([p.currentFrameIndex,Math.round(p.elapsedMs)],[0,50]); });
test('Once final frame event fires once', () => { const c=eventClip('once'); c.frames[3].events=[{id:'hit',name:'Hit'}]; const p=plumbing.createSpriteAnimationPlayback(c.id,false); const seen=[]; plumbing.playSpriteAnimation(p,c,true,{onEvent:(e)=>seen.push(e.eventId)}); plumbing.advanceSpriteAnimation(p,c,1,{onEvent:(e)=>seen.push(e.eventId)}); plumbing.advanceSpriteAnimation(p,c,1,{onEvent:(e)=>seen.push(e.eventId)}); assert.strictEqual(seen.filter((id)=>id==='hit').length,1); });
test('paused playback dispatches no events', () => { const c=eventClip(); const p=plumbing.createSpriteAnimationPlayback(c.id,false); const seen=[]; plumbing.advanceSpriteAnimation(p,c,1,{onEvent:(e)=>seen.push(e)}); assert.strictEqual(seen.length,0); });
test('zero delta dispatches no events', () => { const c=eventClip(); const p=plumbing.createSpriteAnimationPlayback(c.id,false); plumbing.playSpriteAnimation(p,c,true); const seen=[]; plumbing.advanceSpriteAnimation(p,c,0,{onEvent:(e)=>seen.push(e)}); assert.strictEqual(seen.length,0); });
test('Stop then advance dispatches no events', () => { const c=eventClip(); const p=plumbing.createSpriteAnimationPlayback(c.id,false); plumbing.playSpriteAnimation(p,c,true); plumbing.stopSpriteAnimation(p); const seen=[]; plumbing.advanceSpriteAnimation(p,c,1,{onEvent:(e)=>seen.push(e)}); assert.strictEqual(seen.length,0); });
test('pathological loop dispatch is capped', () => { const c=plumbing.createSpriteAnimationClip({id:'one',playbackMode:'loop',frames:[{spriteAsset:'s',durationMs:1,events:[{id:'pulse',name:'Pulse'}]}]}); const p=plumbing.createSpriteAnimationPlayback(c.id,false); plumbing.playSpriteAnimation(p,c,true); let count=0; plumbing.advanceSpriteAnimation(p,c,100,{onEvent:()=>count++}); assert.strictEqual(count,plumbing.MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE); assert.strictEqual(p.eventDispatchOverflow,1); });
test('pathological cap does not corrupt final position', () => { const c=eventClip(); const p=plumbing.createSpriteAnimationPlayback(c.id,false); plumbing.playSpriteAnimation(p,c,true); plumbing.advanceSpriteAnimation(p,c,1000.25,{onEvent:()=>{}}); assert.deepStrictEqual([p.currentFrameIndex,Math.round(p.elapsedMs)],[2,50]); });
test('no-code vocabulary exposes dedicated event source', () => assert(language.EVENTS.some((event)=>event.id==='spriteAnimationEvent'&&event.label==='On Sprite Animation Event')));
test('event source picker is target-aware', () => assert(editor.includes('spriteAnimationEventSourceOptions')));
test('event source stores target clip and event IDs', () => assert(editor.includes("return { targetId:") && editor.includes('clipId:') && editor.includes('eventId:')));
test('runtime listener requires exact target match', () => assert(editor.includes('ref.targetId === context.targetSpriteId')));
test('runtime listener requires exact Clip match', () => assert(editor.includes('ref.clipId === context.clipId')));
test('runtime listener requires exact event match', () => assert(editor.includes('ref.eventId === context.eventId')));
test('listeners execute through ordinary runAction', () => assert(editor.includes("runAction(behavior, owner)")));
test('Node Graph behaviors retain Sprite, Signal and Controller event sources', () => assert(editor.includes("else item.behaviors.push({ trigger, action: 'graph', graph, eventRef })") && editor.includes("if (['spriteAnimationEvent','signal','controllerStateEvent'].includes(trigger)) existingBehavior.eventRef = eventRef") && editor.includes("trigger==='spriteAnimationEvent'?readSpriteAnimationEventSource(host)")));
test('Play Sequence remains an ordinary reaction action', () => assert(editor.includes("playSequence: {")));
test('preview callback only records feedback', () => assert(editor.includes('spriteAnimationEditorState.lastPreviewEvent = context')));
test('scrubbing uses seek without an event callback', () => assert(editor.includes('seekSpriteAnimation(spriteAnimationEditorState.playback, clip, requestedMs)')));
test('frame strip renders event badges', () => assert(editor.includes('sprite-animation-event-badge')));
test('frame strip exposes event-name tooltips', () => assert(editor.includes("eventNames || 'No Animation Events'")));
test('selected-frame editor exposes Add Event', () => assert(editor.includes('data-sprite-animation-event-add')));
test('selected-frame editor exposes rename', () => assert(editor.includes('data-sprite-animation-event-name')));
test('selected-frame editor exposes removal warning', () => assert(editor.includes('countSpriteAnimationEventListenerUses')));
test('CSS styles event markers and rows', () => assert(html.includes('.sprite-animation-event-badge')&&html.includes('.sprite-animation-event-row')));
test('listener references are cloned for Prefabs and duplication', () => assert(editor.includes('eventRef: b.eventRef ? { ...b.eventRef }')));
test('level duplication remaps target IDs through deep JSON remap', () => assert(editor.includes('json.split(`"${oldId}"`).join(`"${newId}"`)')));
test('listener Clip dependencies survive export pruning', () => assert(editor.includes("dep.spriteAnimations.add(b.eventRef.clipId)")));
test('listener validation checks missing target', () => assert(editor.includes('sprite-animation-event-target-required')));
test('listener validation checks target Clip membership', () => assert(editor.includes('sprite-animation-event-clip-not-on-target')));
test('listener validation checks missing event', () => assert(editor.includes('sprite-animation-event-missing')));
test('Clip deletion usage includes event listeners', () => assert(editor.includes("behavior.eventRef.clipId === id")));
test('Animation capability remains C', () => { const caps=require('../no-code-capabilities.json'); assert.strictEqual(caps.capabilities.find((c)=>c.id==='animation').grade,'C'); });
test('Sprites capability remains B', () => { const caps=require('../no-code-capabilities.json'); assert.strictEqual(caps.capabilities.find((c)=>c.id==='sprites-2d').grade,'B'); });
test('AFR-0009 keeps its historical observation and explicit non-blend-tree boundary', () => { const issue=require('../authoring-friction.json').issues.find(x=>x.id==='AFR-0009');assert.strictEqual(issue.status,'ACCEPTED_LIMITATION');assert.strictEqual(issue.phase240Disposition.previousStatus,'CONFIRMED');assert(issue.acceptance.rationale.intentionallyBounded.includes('no universal skeletal visual blend tree')); });
test('Phase 024 artifacts are present', () => { for (const file of ['SPRITE-ANIMATION-EVENT-CONTRACT.md','SPRITE-ANIMATION-EVENT-RUNTIME-CONTRACT.md','SPRITE-ANIMATION-EVENT-NOCODE-CONTRACT.md','PHASE-024-CHARACTERIZATION.md','PHASE-024-REPORT.md','phase-024-dogfood.json']) assert(fs.existsSync(path.join(__dirname,'..',file)),file); });
test('Phase 024 suite is wired after Phase 023', () => assert(runner.indexOf('phase-024-sprite-animation-events.test.js') > runner.indexOf('phase-023-sprite-animation-states.test.js')));

console.log('Phase 024 Sprite Animation Event tests');
for (const entry of tests) { try { entry.fn(); passed++; console.log(`  PASS ${entry.name}`); } catch (error) { console.error(`  FAIL ${entry.name}`); console.error(error.stack || error); process.exitCode=1; } }
if (!process.exitCode) console.log(`Phase 024 tests passed: ${passed}/${tests.length}`);
