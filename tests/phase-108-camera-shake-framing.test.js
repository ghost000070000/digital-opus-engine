'use strict';
const assert=require('assert'),fs=require('fs');
const source=fs.readFileSync(require.resolve('./phase-108-camera-target-group-host.test'),'utf8').split('let passed=0,failed=0;')[0];
const fixture=new Function('require',source+'\nreturn fixture;')(require);
const {c,O,shot}=fixture();c.applyCameraPreset(shot);
const eye=c.app.camera.fixedOptions.eye.clone(),target=c.app.camera.fixedOptions.target.clone(),up=c.app.camera.fixedOptions.up.clone(),height=c.app.camera.orthographicHeight;
c.app.camera.shakeOffset=new O.Vec3(1,.5,0);
for(let i=0;i<30;i++){
  assert(c.applyCameraTargetGroup(shot));
  assert(c.app.camera.eye.sub(eye.add(c.app.camera.shakeOffset)).length()<1e-7,'Rendered eye must retain additive shake');
  assert(c.app.camera.getBasis().forward.sub(target.sub(c.app.camera.eye).normalize()).length()<1e-7,'Rendered basis must still use shaken eye');
}
c.app.camera.shakeOffset=null;
console.log(JSON.stringify({provenance:'Actual host target-group helper, live public Camera and canonical model matrices; no browser acceptance claimed.',before:{eye,target,up,height},after:{eye:c.app.camera.eye,target:c.app.camera.currentTarget,up:c.app.camera.currentUp,height:c.app.camera.orthographicHeight},residual:c.app.camera.eye.sub(eye).length()},null,2));
assert(c.app.camera.eye.sub(eye).length()<1e-7,'Transient shake accumulated into permanent framing eye');
assert(c.app.camera.currentTarget.sub(target).length()<1e-7);
assert(c.app.camera.currentUp.sub(up).length()<1e-7,'Transient shake accumulated into permanent framing orientation');
assert(Math.abs(c.app.camera.orthographicHeight-height)<1e-7);
console.log('Phase108 actual shake/framing integration: 1 PASS');
