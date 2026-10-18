'use strict';
// Execute actual editor bridge + engine Input; controlled gamepad is not hardware/native evidence.
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8'),inputSource=fs.readFileSync(require.resolve('../engine/src/04-input'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);let cursor=source.indexOf('(',start)+1,p=1;while(p){if(source[cursor]==='(')p++;if(source[cursor]===')')p--;cursor++;}const brace=source.indexOf('{',cursor);let depth=1,end=brace+1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return (name==='wireTouchButton'?extract('markGameplayPointerDevice')+'\n':'')+source.slice(start,end);}
function fixture(){const listeners={},buttons={},window={addEventListener(type,fn){listeners[type]=fn;},removeEventListener(){}},document={addEventListener(){},removeEventListener(){},getElementById(id){return buttons[id]||(buttons[id]={addEventListener(type,fn){this[type]=fn;},click(){}});}},c={window,document,inputContextLookAllowed:()=>true,gamepadHeldKeys:new Set(),gamepadStartWasHeld:false,GAMEPAD_STICK_DEADZONE:.15,GAMEPAD_LOOK_RATE:2,player:null,effectiveInputMap:{moveForward:'KeyW',moveBack:'KeyS',moveLeft:'KeyA',moveRight:'KeyD',interact:'KeyF',attack:'KeyQ',jump:'Space',reload:'KeyR',switchWeapon:'KeyV',crouch:'KeyC',sprint:'ShiftLeft',inventory:'KeyI'},pad:{connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))}};c.navigator={getGamepads:()=>[c.pad]};c.gamepadTuningRuntime=null;c.currentPlayerSettings={};c.playMode=true;c.gameEnded=false;vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-input-tuning'),'utf8'),c);vm.runInContext(inputSource+'\nglobalThis.app={input:new Input(window),settings:{get:()=>undefined}};',c);vm.runInContext(extract('effectiveGamepadTuning')+'\n'+extract('pollGamepad')+'\n'+extract('wireTouchButton'),c);return {c,listeners,buttons};}
const shared=fixture();shared.c.effectiveInputMap.interact='KeyE';shared.c.effectiveInputMap.attack='KeyE';shared.c.pad.buttons[1].pressed=true;shared.c.pollGamepad(.016);const sharedPressedHeld=shared.c.app.input.isDown('KeyE');
const rebound=fixture();rebound.c.pad.buttons[1].pressed=true;rebound.c.pollGamepad(.016);assert(rebound.c.app.input.isDown('KeyF'));rebound.c.effectiveInputMap.interact='KeyE';rebound.c.pollGamepad(.016);const oldCodeReleased=!rebound.c.app.input.isDown('KeyF'),newCodeHeld=rebound.c.app.input.isDown('KeyE');rebound.c.pad=null;rebound.c.pollGamepad(.016);const disconnectReleasedAll=rebound.c.app.input.keys.size===0;
const touch=fixture(),event={preventDefault(){}};touch.c.wireTouchButton('touch-test',()=>touch.c.effectiveInputMap.interact);touch.buttons['touch-test'].pointerdown(event);assert(touch.c.app.input.isDown('KeyF'));touch.c.effectiveInputMap.interact='KeyE';touch.buttons['touch-test'].pointerup(event);assert(!touch.c.app.input.isDown('KeyF'),'Touch release matches captured press code across rebinding');assert(!touch.c.app.input.isDown('KeyE'));
const ownership=fixture();ownership.listeners.keydown({code:'KeyF'});ownership.c.app.input.simulateKeyDown('KeyF');ownership.c.app.input.simulateKeyUp('KeyF');const physicalKeySurvivesVirtualRelease=ownership.c.app.input.isDown('KeyF');
const mixed=fixture();mixed.listeners.keydown({code:'KeyF'});mixed.c.pad.buttons[1].pressed=true;mixed.c.pollGamepad(.016);mixed.c.pad.buttons[1].pressed=false;mixed.c.pollGamepad(.016);const physicalKeySurvivesGamepadRelease=mixed.c.app.input.isDown('KeyF');mixed.listeners.keyup({code:'KeyF'});assert(!mixed.c.app.input.isDown('KeyF'));
const observed={provenance:'Actual pollGamepad/wireTouchButton plus actual engine Input with connected-pad values and captured handlers; not physical gamepad or browser gameplay',sharedPressedHeld,oldCodeReleased,newCodeHeld,disconnectReleasedAll,touchCapturedCodeRelease:true,physicalKeySurvivesVirtualRelease};if(process.argv.includes('--observe-red')){console.log(JSON.stringify(observed,null,2));process.exit(0);}
assert(sharedPressedHeld,'Intentional shared binding must OR held Actions, not let a later unpressed Action overwrite true');assert(oldCodeReleased,'Gamepad rebind must release prior held code absent from the whole desired set');assert(newCodeHeld);assert(disconnectReleasedAll,'Disconnected pad must release every prior held code');assert(physicalKeySurvivesVirtualRelease,'Virtual release cannot cancel a separate physical keyboard hold');assert(physicalKeySurvivesGamepadRelease,'Actual gamepad bridge release cannot cancel a physical keyboard hold');
console.log('Phase093 actual-source device bridge regression PASS');

// Exercise the repaired callers, not a replacement input solver. These are
// controlled device observations and are deliberately not hardware acceptance.
const pointer=(pointerId)=>({pointerId,preventDefault(){}});
const overlap=fixture();
overlap.c.wireTouchButton('touch-one',()=>overlap.c.effectiveInputMap.interact);
overlap.c.wireTouchButton('touch-two','KeyF');
overlap.listeners.keydown({code:'KeyF'});
overlap.c.pad.buttons[1].pressed=true;overlap.c.pollGamepad(.016);
overlap.buttons['touch-one'].pointerdown(pointer(1));
overlap.buttons['touch-one'].pointerdown(pointer(2));
overlap.buttons['touch-two'].pointerdown(pointer(1));
overlap.listeners.keyup({code:'KeyF'});
overlap.c.pad=null;overlap.c.pollGamepad(.016);
assert(overlap.c.app.input.isDown('KeyF'),'Keyboard and disconnected pad release preserve touch owners');
overlap.buttons['touch-one'].pointercancel(pointer(1));
overlap.buttons['touch-two'].pointerleave(pointer(1));
assert(overlap.c.app.input.isDown('KeyF'),'Cancellation and another control release preserve second pointer');
overlap.buttons['touch-one'].pointerup(pointer(2));
assert(!overlap.c.app.input.isDown('KeyF'),'Final exact pointer releases final owner');
overlap.buttons['touch-one'].pointerup(pointer(999));
assert.equal(overlap.c.app.input.keys.size,0,'Unknown pointer release is inert');

const repress=fixture();repress.c.wireTouchButton('touch-repress',()=>repress.c.effectiveInputMap.interact);
repress.buttons['touch-repress'].pointerdown(pointer(7));
repress.c.effectiveInputMap.interact='KeyE';
repress.buttons['touch-repress'].pointerdown(pointer(7));
assert(!repress.c.app.input.isDown('KeyF'),'Repeated pointer press releases its captured old binding');
assert(repress.c.app.input.isDown('KeyE'));
repress.buttons['touch-repress'].pointercancel(pointer(7));
assert.equal(repress.c.app.input.keys.size,0);
for(const invalid of ['',null,undefined,0]){
 repress.c.effectiveInputMap.interact=invalid;
 repress.buttons['touch-repress'].pointerdown(pointer(8));
 assert.equal(repress.c.app.input.keys.size,0,'Invalid touch code creates no owner');
 repress.buttons['touch-repress'].pointercancel(pointer(8));
}

const cleared=fixture();cleared.c.pad.buttons[1].pressed=true;cleared.c.pollGamepad(.016);
assert(cleared.c.app.input.wasPressed('KeyF'));
cleared.listeners.blur();assert.equal(cleared.c.app.input.keys.size,0);
cleared.c.pollGamepad(.016);
assert(cleared.c.app.input.isDown('KeyF'),'Held gamepad reacquires actual Input lease after blur clear');
assert(cleared.c.app.input.wasPressed('KeyF'));
cleared.c.pollGamepad(.016);assert(!cleared.c.app.input.wasPressed('KeyF'),'Continuous polling creates no repeated press');
cleared.c.navigator.getGamepads=undefined;cleared.c.pollGamepad(.016);
assert.equal(cleared.c.app.input.keys.size,0,'Unavailable gamepad API releases previous held lease');
assert.equal(cleared.c.gamepadHeldKeys.size,0);
cleared.c.navigator.getGamepads=()=>null;assert.doesNotThrow(()=>cleared.c.pollGamepad(.016));
cleared.c.navigator.getGamepads=()=>[null,{connected:false}];assert.doesNotThrow(()=>cleared.c.pollGamepad(.016));

const physicalRebind=fixture();physicalRebind.listeners.keydown({code:'KeyF'});
physicalRebind.c.pad.buttons[1].pressed=true;physicalRebind.c.pollGamepad(.016);
physicalRebind.c.effectiveInputMap.interact='KeyE';physicalRebind.c.pollGamepad(.016);
assert(physicalRebind.c.app.input.isDown('KeyF'),'Rebinding pad preserves physically held old code');
assert(physicalRebind.c.app.input.isDown('KeyE'));
physicalRebind.c.pad=null;physicalRebind.c.pollGamepad(.016);
assert(physicalRebind.c.app.input.isDown('KeyF'));assert(!physicalRebind.c.app.input.isDown('KeyE'));
physicalRebind.listeners.keyup({code:'KeyF'});assert.equal(physicalRebind.c.app.input.keys.size,0);
console.log('Phase093 actual-source overlapping device, pointer and blur lifecycle regression PASS');
