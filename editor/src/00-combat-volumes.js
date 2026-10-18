// Optional combat geometry. No movement, scheduling, damage or renderer ownership.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusCombatVolumes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1,fields=['version','enabled','radius','offsetX','offsetY','offsetZ'];
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function create(){return {version:VERSION,enabled:true,radius:.5,offsetX:0,offsetY:0,offsetZ:0};}
  function inspect(raw){
    const bad=reason=>({ok:false,record:null,reason,issues:[{code:'combat-volume-invalid',message:reason}]});
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))return bad('Combat sphere must be a plain supported record.');
    if(Reflect.ownKeys(raw).some(k=>!fields.includes(k)&&k!=='inspectorOrder'))return bad('Unsupported combat sphere fields are retained, not applied.');
    if(fields.some(k=>{const d=Object.getOwnPropertyDescriptor(raw,k);return !d||!own(d,'value');}))return bad('Combat sphere requires explicit authored fields, not accessors.');
    if(raw.version!==VERSION||typeof raw.enabled!=='boolean')return bad('Combat sphere needs version1 and a boolean Enabled.');
    if(!Number.isFinite(raw.radius)||raw.radius<=0||['offsetX','offsetY','offsetZ'].some(k=>!Number.isFinite(raw[k])))return bad('Radius must be finite and positive; world offsets must be finite.');
    if(own(raw,'inspectorOrder')){const d=Object.getOwnPropertyDescriptor(raw,'inspectorOrder');if(!own(d,'value')||!Number.isInteger(d.value)||d.value<0)return bad('Inspector order must be a nonnegative integer.');}
    return {ok:true,record:{...raw},issues:[]};
  }
  function worldSphere(raw,position){const checked=inspect(raw);if(!checked.ok||!checked.record.enabled||!position||![position.x,position.y,position.z].every(Number.isFinite))return null;const r=checked.record,center={x:position.x+r.offsetX,y:position.y+r.offsetY,z:position.z+r.offsetZ};if(!Object.values(center).every(Number.isFinite))return null;return {center,radius:r.radius};}
  function overlaps(a,b){
    if([a,b].some(s=>!s||!s.center||!Number.isFinite(s.radius)||s.radius<=0||![s.center.x,s.center.y,s.center.z].every(Number.isFinite)))return false;
    const distance=Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y,a.center.z-b.center.z),sum=a.radius+b.radius;
    if(Number.isFinite(distance)&&Number.isFinite(sum))return distance<=sum;
    // Supported finite values can overflow subtraction or radius addition.
    // Normalize only this exceptional branch; ordinary authored bounds stay exact.
    const scale=Math.max(a.radius,b.radius,...['x','y','z'].flatMap(k=>[Math.abs(a.center[k]),Math.abs(b.center[k])]));
    return Math.hypot(...['x','y','z'].map(k=>a.center[k]/scale-b.center[k]/scale))<=a.radius/scale+b.radius/scale;
  }
  return Object.freeze({VERSION,create,inspect,worldSphere,overlaps});
});
