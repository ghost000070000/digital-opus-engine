'use strict';
// Actual-source lifecycle seams with thin DOM/event fixtures, not native proof.
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);let cursor=source.indexOf('(',start)+1,p=1;while(p){if(source[cursor]==='(')p++;if(source[cursor]===')')p--;cursor++;}const brace=source.indexOf('{',cursor);let depth=1,end=brace+1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(start,end);}
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture(){
  const nodes=new Map(),handlers={},preferences={};
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,textContent:'',classList:{contains:()=>false,toggle(){}},addEventListener:(type,handler)=>{handlers[type]=handler;}});return nodes.get(id);};
  const c={document:{getElementById:node},preferences,currentPlayerSettings:{mouseSensitivity:.0022},gamepadTuningRuntime:null,app:{paused:false,settings:{get:key=>preferences[key]},pause(){this.paused=true;}},playMode:true,gameEnded:false,player:{controllerType:'firstperson'},gameplayScreenPauseOwners:new Set(),isTouchDevice:true,pauseOverlayEl:node('pause-overlay'),fpYaw:0,fpPitch:0,FP_PITCH_LIMIT:1.4,firstPersonEntity:{},Opus:{Quat:{fromEuler:(pitch,yaw)=>({pitch,yaw})}},releaseFirstPersonPointerLock(){},requestFirstPersonPointerLock(){},touchLookPointerId:null};
  c.inputContextLookAllowed=()=>true; // Historical unrestricted context;096 covers actual gate.
  vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-input-tuning.js'),'utf8'),c);
  c.controllerStateSession=0;c.controllerStateEvents=null;
  vm.runInContext(['effectiveGamepadTuning','renderLookPreferences','effectiveMouseSensitivity','applyFirstPersonLook','resetControllerStateEvents','syncPauseScreen','markGameplayPointerDevice'].map(extract).join('\n'),c);
  c.app.input={}; // Presentation helper is optional for this historical look-only fixture.
  return {c,nodes,node,handlers};
}
test('current settings renderer refreshes player tuning and actual sliders follow replacement',()=>{
  assert(extract('renderPlayerSettingsPanel').includes('renderLookPreferences();'),'Canonical settings replacement must refresh player controls');
  const {c,node}=fixture();c.renderLookPreferences();assert.strictEqual(node('pause-gamepad-deadzone').value,.25);
  vm.runInContext('currentPlayerSettings={mouseSensitivity:.0022,gamepadTuning:{kind:"GamepadTuning",version:1,deadZone:.7,lookRate:8}};',c);
  c.renderLookPreferences();for(const prefix of ['pause','mainmenu']){assert.strictEqual(node(prefix+'-gamepad-deadzone').value,.7);assert.strictEqual(node(prefix+'-gamepad-look-rate').value,8);}
});
test('unavailable loaded tuning visibly disables both player panels without replacement',()=>{
  const {c,node}=fixture();vm.runInContext('currentPlayerSettings.gamepadTuning={kind:"GamepadTuning",version:99,deadZone:.7,lookRate:8};',c);c.renderLookPreferences();
  for(const prefix of ['pause','mainmenu'])assert.strictEqual(node(prefix+'-gamepad-deadzone').disabled,true);
  assert.strictEqual(c.currentPlayerSettings.gamepadTuning.version,99);
});
test('Pause Resume without an intermediate pointermove invalidates captured touch look',()=>{
  const {c,handlers}=fixture();
  const start=source.indexOf('let touchLookPointerId ='),marker="touchLookZoneEl.addEventListener('pointercancel', endTouchLook);",end=source.indexOf(marker,start)+marker.length;
  assert(start>=0&&end>start);vm.runInContext(source.slice(start,end),c);
  const event=x=>({pointerId:4,clientX:x,clientY:0,preventDefault(){}});
  handlers.pointerdown(event(0));c.app.paused=true;c.syncPauseScreen(true);c.app.paused=false;c.syncPauseScreen(false);
  handlers.pointermove(event(100));assert.strictEqual(c.fpYaw,0,'No pre-pause pointer survives Resume');
  handlers.pointerdown(event(100));handlers.pointermove(event(110));assert(c.fpYaw>0,'Fresh post-resume pointer still drives canonical look');
});
test('extreme finite historical sensitivity remains authored but runtime stays finite',()=>{
  const {c}=fixture();c.currentPlayerSettings.mouseSensitivity=1e308;
  const effective=c.effectiveMouseSensitivity();assert(Number.isFinite(effective)&&effective>0,'Finite historical values cannot overflow runtime response');
  c.applyFirstPersonLook(10,10,effective);assert(Number.isFinite(c.fpYaw)&&Number.isFinite(c.fpPitch));assert.strictEqual(c.currentPlayerSettings.mouseSensitivity,1e308,'Runtime fallback never rewrites history');
});
test('new extreme edits refused and valid maximum creates exactly one snapshot',()=>{
  const field={},history=[],c={document:{getElementById:()=>field},currentPlayerSettings:{mouseSensitivity:.0022},playMode:false,pushUndo:()=>history.push(c.currentPlayerSettings.mouseSensitivity)};
  vm.createContext(c);const start=source.indexOf("document.getElementById('player-fp-sensitivity').oninput"),end=source.indexOf('\n};',start)+3;vm.runInContext(source.slice(start,end),c);
  for(const value of ['1e308','Infinity','.10001','','NaN'])field.oninput({target:{value}});
  assert.strictEqual(c.currentPlayerSettings.mouseSensitivity,.0022);assert.strictEqual(history.length,0);
  field.oninput({target:{value:'.1'}});assert.strictEqual(c.currentPlayerSettings.mouseSensitivity,.1);assert.deepStrictEqual(history,[.0022]);
  field.oninput({target:{value:'.1'}});assert.strictEqual(history.length,1);
});
console.log('Phase 095 tuning lifecycle: '+passed+' groups passed.');
