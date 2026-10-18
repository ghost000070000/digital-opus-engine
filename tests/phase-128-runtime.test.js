'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
function fixture(){const c={window:{},simElapsed:0};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),c);c.Opus=c.window.Opus;
 const keywordAt=source.indexOf('const CHARACTER_ANIM_KEYWORDS = {'),rolesAt=source.indexOf('const AI_CHARACTER_ANIMATION_ROLES=');vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-ai-brain'),'utf8')+'\n'+source.slice(keywordAt,source.indexOf('\n};',keywordAt)+3)+'\n'+source.slice(rolesAt,source.indexOf('\n',rolesAt))+'\n'+['findCharacterClip','aiAnimationRolesEditable','resolveAiCharacterClip','setCharacterLocomotionState','triggerCharacterAttackAnim','triggerCharacterDeathAnim','triggerCharacterHitAnim','aiStateDef','enterAiState','tickAiStateMachine','evaluateAiTransitionCondition','targetEntity','applyAiMovementStep','resolveAiSolidMovement'].map(extract).join('\n')+'\n'+
 'this.actor={kind:"cube",characterAnimSync:true,entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(0,0,0)})};actor.entity.skin={jointCount:0,jointLocalBind:[],jointParents:[],inverseBindMatrices:[],clips:[{name:"Idle",duration:2,tracks:[]},{name:"Walk",duration:2,tracks:[]},{name:"Shoot",duration:.5,tracks:[]},{name:"Death",duration:1,tracks:[]},{name:"Hurt",duration:.3,tracks:[]}]};actor.entity.ai={type:"",mode:"stateMachine",startState:"Patrol",states:[{name:"Patrol",movement:{type:""},animRole:"walk"}]};this.player=null;this.placed=[actor];this.findItemById=id=>placed.find(p=>p.id===id);',c);
 return {c,run:code=>vm.runInContext(code,c),tick(time){c.simElapsed=time;c.tickAiStateMachine(c.actor,c.actor.entity.ai,c.actor.entity.position,.1,time);}};
}
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`),json=v=>JSON.parse(JSON.stringify(v));let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
test('Actual automatic clip matching preserves first name-substring match and absent role leaves current clip',()=>{
 const f=fixture();assert.equal(f.c.findCharacterClip(f.c.actor.entity,['walk']),1);f.run('actor.entity.skin.clips.unshift({name:"Fast Walk",duration:2,tracks:[]});');assert.equal(f.c.findCharacterClip(f.c.actor.entity,['walk']),0);f.c.setCharacterLocomotionState(f.c.actor,'run');assert.equal(f.c.actor.entity.animationClip,0);assert.equal(f.c.actor._animState,undefined);
});
test('Actual locomotion role repeated tick preserves Entity animation advancement rather than restarting',()=>{
 for(const hz of [30,60,144]){const f=fixture();for(let n=0;n<hz;n++){f.c.setCharacterLocomotionState(f.c.actor,'walk');f.c.actor.entity.update(1/hz);}assert.equal(f.c.actor.entity.animationClip,1);near(f.c.actor.entity.animationTime,1);}
});
test('Actual state entry selects authored role once and canonical Brain capture excludes entity/item transient animation state',()=>{
 const f=fixture(),before=f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai);assert(before.ok);f.tick(0);assert.equal(f.c.actor.entity.animationClip,1);f.c.actor.entity.update(.2);f.tick(.2);near(f.c.actor.entity.animationTime,.2);const after=f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai);assert(after.ok);assert.deepStrictEqual(json(before.record),json(after.record));
});
test('Unknown authored animation role must be inert rather than crash state entry',()=>{
 const f=fixture();f.run('actor.entity.ai.states[0].animRole="future-unavailable";');assert.doesNotThrow(()=>f.tick(0),'Retained unknown role must not call keywords.some on undefined');assert.equal(f.c.actor.entity.animationClip,0);
});
test('State authored Walk must resume after actual transient Attack override expires without another state transition',()=>{
 const f=fixture();f.tick(0);f.c.triggerCharacterAttackAnim(f.c.actor);assert.equal(f.c.actor.entity.animationClip,2);near(f.c.actor._animOverrideUntil,.5);f.tick(.2);assert.equal(f.c.actor.entity.animationClip,2,'Active override retained');f.tick(.6);assert.equal(f.c.actor.entity.animationClip,1,'Persistent state role resumes after bounded attack');
});
test('Actual Death is terminal and missing Death returns false; disabling Auto-Animate suppresses Attack',()=>{
 const f=fixture();assert(f.c.triggerCharacterDeathAnim(f.c.actor));assert.equal(f.c.actor.entity.animationClip,3);assert.equal(f.c.actor._animOverrideUntil,Infinity);f.run('actor.entity.skin.clips[3].name="Unavailable";');assert.equal(f.c.triggerCharacterDeathAnim(f.c.actor),false);f.run('actor.characterAnimSync=false;actor.entity.animationClip=1;');f.c.triggerCharacterAttackAnim(f.c.actor);assert.equal(f.c.actor.entity.animationClip,1);
});
test('Actual live Hit uses clip-duration override; canonical damage caller excludes already-dead characters',()=>{
 const damage=extract('applyHitDamage');assert(damage.includes('else if (!wasAlreadyDead)'));assert(damage.indexOf('triggerCharacterHitAnim(hit.item)')>damage.indexOf('else if (!wasAlreadyDead)'),'Hit dispatch is intentionally protected by damage caller, not a public helper lifecycle contract');
 const live=fixture();live.c.simElapsed=2;live.c.triggerCharacterHitAnim(live.c.actor);assert.equal(live.c.actor.entity.animationClip,4);near(live.c.actor._animOverrideUntil,2.3);
});
test('Actual per-item exact unique clip name mapping overrides naming heuristic and preserves automatic missing keys',()=>{
 const f=fixture();f.run('actor.characterAnimRoles={kind:"AIAnimationRoles",version:1,clips:{walk:"Idle",attack:"Hurt",death:"Shoot",hit:"Walk"}};');f.c.setCharacterLocomotionState(f.c.actor,'walk');assert.equal(f.c.actor.entity.animationClip,0);assert.equal(f.c.resolveAiCharacterClip(f.c.actor,'idle'),0);
 f.c.triggerCharacterAttackAnim(f.c.actor);assert.equal(f.c.actor.entity.animationClip,4);near(f.c.actor._animOverrideUntil,.3);f.c.simElapsed=1;f.c.triggerCharacterDeathAnim(f.c.actor);assert.equal(f.c.actor.entity.animationClip,2);
 const hit=fixture();hit.run('actor.characterAnimRoles={kind:"AIAnimationRoles",version:1,clips:{hit:"Walk"}};');hit.c.triggerCharacterHitAnim(hit.c.actor);assert.equal(hit.c.actor.entity.animationClip,1);near(hit.c.actor._animOverrideUntil,2);
});
test('Explicit None disables locomotion clip and transient roles without automatic fallback',()=>{
 const f=fixture();f.run('actor.characterAnimRoles={kind:"AIAnimationRoles",version:1,clips:{walk:null,attack:null,death:null,hit:null}};');f.tick(0);assert.equal(f.c.actor.entity.animationClip,null);f.c.actor.entity.update(.1);near(f.c.actor.entity.animationTime,0);f.c.triggerCharacterAttackAnim(f.c.actor);assert.equal(f.c.actor.entity.animationClip,null);assert.equal(f.c.triggerCharacterDeathAnim(f.c.actor),false);f.c.triggerCharacterHitAnim(f.c.actor);assert.equal(f.c.actor.entity.animationClip,null);
});
test('Retained future/malformed maps, missing and ambiguous exact names are inert without fallback or mutation',()=>{
 for(const map of [null,false,[],{}, {kind:'AIAnimationRoles',version:99,clips:{walk:'Walk'}},{kind:'AIAnimationRoles',version:1,clips:[]},{kind:'AIAnimationRoles',version:1,clips:{walk:'Missing'}},{kind:'AIAnimationRoles',version:1,clips:{walk:4}}]){const f=fixture();f.run('actor.characterAnimRoles='+JSON.stringify(map)+';');const before=json(f.c.actor.characterAnimRoles);assert.equal(f.c.resolveAiCharacterClip(f.c.actor,'walk'),null);assert.doesNotThrow(()=>f.tick(0));assert.equal(f.c.actor.entity.animationClip,0);assert.deepStrictEqual(json(f.c.actor.characterAnimRoles),before);}
 const f=fixture();f.run('actor.entity.skin.clips.push({name:"Walk",duration:2,tracks:[]});actor.characterAnimRoles={kind:"AIAnimationRoles",version:1,clips:{walk:"Walk"}};');assert.equal(f.c.resolveAiCharacterClip(f.c.actor,'walk'),null);assert.equal(f.c.actor.entity.animationClip,0);
});
test('Mapped state recovery respects active override and terminal Death while retained map remains independent authored data',()=>{
 const f=fixture();f.run('actor.characterAnimRoles={kind:"AIAnimationRoles",version:1,clips:{walk:"Idle",attack:"Shoot",death:"Death"}};');const before=json(f.c.actor.characterAnimRoles);f.tick(0);assert.equal(f.c.actor.entity.animationClip,0);f.c.triggerCharacterAttackAnim(f.c.actor);f.tick(.2);assert.equal(f.c.actor.entity.animationClip,2);f.tick(.6);assert.equal(f.c.actor.entity.animationClip,0);f.c.triggerCharacterDeathAnim(f.c.actor);f.tick(10);assert.equal(f.c.actor.entity.animationClip,3);assert.deepStrictEqual(json(f.c.actor.characterAnimRoles),before);
});
console.log(`Phase128 actual animation runtime: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
