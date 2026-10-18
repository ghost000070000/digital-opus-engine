// Canonical authored weapon assets. Hosts own history, typed asset availability
// and per-slot ammunition/reload state. An explicit invalid reference is inert.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusWeaponDefinitions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KIND='WeaponDefinition',VERSION=2;
  const DAMAGE_TYPES=Object.freeze(['ordinary','fire','ice']);
  const OWNER_FIELDS=['enabled','source','fireOnAnimationEvent','definitionRef'];
  const NUMBERS={cooldown:[0,3600],damage:[0,1e9],speed:[0,1e6],range:[0,1e6],knockback:[0,1e6],magazineSize:[1,1e6],startingMagazine:[0,1e6],reserveAmmo:[0,1e9],reloadDuration:[0,3600],spreadDegrees:[0,180],recoilHorizontal:[0,180],recoilVertical:[0,180],noiseRadius:[0,1e6]};
  const STRINGS=['prefabName','muzzleSocket','fireAudioAssetId','emptySoundAssetId','impactAudioAssetId'];
  const BOOLS=['crosshair','emitNoiseOnFire','tracer','muzzleEffect','impactEffect'];
  const ENUMS={mode:['projectile','hitscan','melee'],ammoMode:['infinite','magazine'],fireMode:['semi','auto']};
  const COLOR_FIELDS=['muzzleEffectColor','impactEffectColor'];
  const FIELDS=[...Object.keys(NUMBERS),...STRINGS,...BOOLS,...Object.keys(ENUMS),...COLOR_FIELDS,'fireCameraShake','damageType'];
  const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const failure=reason=>({ok:false,reason});
  function portable(v,ancestors=new Set()) {
    if(v===null||typeof v==='string'||typeof v==='boolean')return true;
    if(typeof v==='number')return Number.isFinite(v);
    if((!plain(v)&&!Array.isArray(v))||ancestors.size>=32||ancestors.has(v))return false;
    ancestors.add(v);const ok=Object.keys(v).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !['__proto__','constructor','prototype'].includes(k)&&d&&Object.prototype.hasOwnProperty.call(d,'value')&&portable(d.value,ancestors);});ancestors.delete(v);return ok;
  }
  function configIssue(config,version) {
    if(!plain(config)||!portable(config)||JSON.stringify(config).length>65536)return 'Choose portable finite weapon settings smaller than 64 KiB.';
    if(Object.keys(config).some(k=>!FIELDS.includes(k)))return 'Unsupported weapon settings retained; definition cannot be used.';
    if(version===1&&Object.prototype.hasOwnProperty.call(config,'damageType'))return 'Historical Weapon Definition has unsupported damage classification; retained data is not applied.';
    if(version===2&&(!Object.prototype.hasOwnProperty.call(config,'damageType')||!DAMAGE_TYPES.includes(config.damageType)))return 'Choose Ordinary, Fire or Ice damage for this Weapon Definition.';
    if(!ENUMS.mode.includes(config.mode))return 'Choose Projectile, Hitscan or Melee.';
    for(const [k,[min,max]]of Object.entries(NUMBERS))if(k in config&&(!Number.isFinite(config[k])||config[k]<min||config[k]>max||['magazineSize','startingMagazine','reserveAmmo'].includes(k)&&!Number.isInteger(config[k])))return 'Repair weapon '+k+' before using this definition.';
    for(const k of STRINGS)if(k in config&&(typeof config[k]!=='string'||config[k].length>256))return 'Repair weapon '+k+' reference.';
    for(const k of BOOLS)if(k in config&&typeof config[k]!=='boolean')return 'Repair weapon '+k+' option.';
    for(const [k,values]of Object.entries(ENUMS))if(k in config&&!values.includes(config[k]))return 'Unsupported weapon '+k+' option.';
    for(const k of COLOR_FIELDS)if(k in config&&!(typeof config[k]==='string'&&/^#[0-9a-f]{6}$/i.test(config[k])))return 'Choose a six-digit weapon effect color.';
    if('fireCameraShake'in config){const s=config.fireCameraShake;if(!plain(s)||Object.keys(s).some(k=>!['intensity','duration'].includes(k))||Object.values(s).some(v=>!Number.isFinite(v)||v<0||v>3600))return 'Repair weapon camera shake settings.';}
    if(config.startingMagazine!==undefined&&config.magazineSize!==undefined&&config.startingMagazine>config.magazineSize)return 'Starting ammunition exceeds magazine size.';
    return null;
  }
  function inspect(record) {
    if(!plain(record)||!portable(record)||record.kind!==KIND||![1,VERSION].includes(record.version)||Object.keys(record).some(k=>!['kind','version','id','name','config'].includes(k)))return failure('Unsupported Weapon Definition; saved data is retained, not converted.');
    if(typeof record.id!=='string'||!record.id.trim()||record.id!==record.id.trim()||record.id.length>128||typeof record.name!=='string'||!record.name.trim()||record.name!==record.name.trim()||record.name.length>80)return failure('Weapon Definition needs a stable ID and a name of 1–80 characters.');
    const issue=configIssue(record.config,record.version);if(issue)return failure(issue);
    if(JSON.stringify(record).length>65536)return failure('Weapon Definition exceeds 64 KiB.');
    return {ok:true,record:copy(record)};
  }
  function capture(config,name,id) {
    if(!plain(config)||!portable(config))return failure('Repair current weapon settings before capture.');
    const authored={};for(const [k,v]of Object.entries(config))if(!OWNER_FIELDS.includes(k)&&!k.startsWith('_'))authored[k]=copy(v);
    // Missing historical mode means Projectile, exactly as the existing runtime.
    if(authored.mode===undefined)authored.mode='projectile';
    if(authored.damageType===undefined)authored.damageType='ordinary';
    return inspect({kind:KIND,version:VERSION,id,name:typeof name==='string'?name.trim():name,config:authored});
  }
  function migrate(record) {
    const checked=inspect(record);if(!checked.ok)return checked;
    if(checked.record.version===VERSION)return checked;
    checked.record.version=VERSION;checked.record.config.damageType='ordinary';
    return inspect(checked.record);
  }
  function resolve(owner,library) {
    if(!plain(owner))return failure('Weapon owner unavailable.');
    const descriptor=Object.getOwnPropertyDescriptor(owner,'definitionRef');
    if(descriptor&&!Object.prototype.hasOwnProperty.call(descriptor,'value'))return failure('Weapon Definition reference must be authored data.');
    const ref=descriptor?.value;
    if(ref===undefined||ref==='')return {ok:true,config:owner,legacy:true};
    if(typeof ref!=='string'||!Array.isArray(library))return failure('Weapon Definition reference unavailable.');
    const matches=library.filter(r=>{if(!plain(r))return false;const id=Object.getOwnPropertyDescriptor(r,'id');return id&&Object.prototype.hasOwnProperty.call(id,'value')&&id.value===ref;});
    if(matches.length!==1)return failure('Choose one available Weapon Definition; missing or duplicate reference.');
    const checked=inspect(matches[0]);if(!checked.ok)return checked;
    if(!portable(owner))return failure('Repair current weapon owner settings.');
    const config=Object.assign(copy(owner),checked.record.config);
    if(checked.record.version===1)config.damageType='ordinary';
    for(const key of OWNER_FIELDS)if(Object.prototype.hasOwnProperty.call(owner,key))config[key]=copy(owner[key]);else delete config[key];
    return {ok:true,config,record:checked.record,legacy:false};
  }
  return Object.freeze({KIND,VERSION,DAMAGE_TYPES,inspect,capture,migrate,resolve,fields:Object.freeze(FIELDS.slice())});
});
