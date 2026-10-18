(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusPlayerRebindScreen=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
  const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
  const reserved=new Set(['__proto__','prototype','constructor']);
  function safe(value,seen=new Set(),depth=0,budget={n:0}){
    if(++budget.n>1000000||depth>64)return false;
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if((!Array.isArray(value)&&!plain(value))||seen.has(value))return false;
    seen.add(value);
    for(const key of Reflect.ownKeys(value)){
      if(Array.isArray(value)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(typeof key!=='string'||reserved.has(key)||!descriptor||!descriptor.enumerable||!own(descriptor,'value')||!safe(descriptor.value,seen,depth+1,budget)){seen.delete(value);return false;}
    }
    if(Array.isArray(value))for(let i=0;i<value.length;i++)if(!own(value,i)){seen.delete(value);return false;}
    seen.delete(value);return true;
  }
  function copy(value){if(!safe(value))throw new Error('Expected finite plain JSON without executable, prototype or cyclic state.');return JSON.parse(JSON.stringify(value));}
  function defaults(){return {kind:'PlayerRebindScreen',version:1,enabled:true,title:'Controls',description:'Choose a keyboard key or mouse button. Your choices stay on this device.',launcherLabel:'Controls'};}
  const fail=reason=>({ok:false,reason});
  function inspect(record){
    if(record===undefined)return {ok:true,record:defaults()};
    if(!plain(record)||!safe(record))return fail('Controls configuration requires finite plain JSON. Retained data is unchanged.');
    if(!own(record,'kind')||record.kind!=='PlayerRebindScreen'||!own(record,'version')||record.version!==1)return fail('Unavailable Controls configuration kind or version. Retained data is unchanged.');
    if(!own(record,'enabled')||typeof record.enabled!=='boolean')return fail('Controls enabled must be a boolean.');
    for(const [key,max] of [['title',80],['description',512],['launcherLabel',40]]){
      if(!own(record,key)||typeof record[key]!=='string'||record[key].length>max||((key!=='description')&&(!record[key].trim()||/[\u0000-\u001f\u007f]/.test(record[key]))))return fail('Controls '+key+' must contain '+(key==='description'?'0':'1')+'–'+max+' readable characters.');
    }
    if(JSON.stringify(record).length>65536)return fail('Controls configuration exceeds 64 KiB.');
    return {ok:true,record:copy(record)};
  }
  function validScope(record){return plain(record)&&safe(record)&&own(record,'kind')&&record.kind==='PlayerPreferenceScope'&&own(record,'version')&&record.version===1&&own(record,'id')&&typeof record.id==='string'&&/^(legacy-[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(record.id)&&JSON.stringify(record).length<=65536;}
  function scopeKey(record){return validScope(record)?'inputOverrides:'+record.id:null;}
  // Local synchronous SHA-256, UTF-8 with the same replacement semantics as TextEncoder.
  function sha256(text){
    if(typeof text!=='string')throw new Error('SHA-256 input must be text.');
    const bytes=[];
    for(let i=0;i<text.length;i++){
      let c=text.charCodeAt(i);
      if(c>=0xd800&&c<=0xdbff){const d=text.charCodeAt(i+1);if(d>=0xdc00&&d<=0xdfff){c=0x10000+((c-0xd800)<<10)+(d-0xdc00);i++;}else c=0xfffd;}
      else if(c>=0xdc00&&c<=0xdfff)c=0xfffd;
      if(c<0x80)bytes.push(c);else if(c<0x800)bytes.push(0xc0|(c>>6),0x80|(c&63));else if(c<0x10000)bytes.push(0xe0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));else bytes.push(0xf0|(c>>18),0x80|((c>>12)&63),0x80|((c>>6)&63),0x80|(c&63));
    }
    const length=bytes.length,bitHigh=Math.floor(length/0x20000000),bitLow=(length*8)>>>0;
    bytes.push(0x80);while(bytes.length%64!==56)bytes.push(0);
    for(const word of [bitHigh,bitLow])for(let shift=24;shift>=0;shift-=8)bytes.push((word>>>shift)&255);
    const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],rotate=(v,n)=>(v>>>n)|(v<<(32-n));
    for(let offset=0;offset<bytes.length;offset+=64){
      const w=new Uint32Array(64);
      for(let i=0;i<16;i++)w[i]=((bytes[offset+4*i]<<24)|(bytes[offset+4*i+1]<<16)|(bytes[offset+4*i+2]<<8)|bytes[offset+4*i+3])>>>0;
      for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rotate(a,7)^rotate(a,18)^(a>>>3),s1=rotate(b,17)^rotate(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
      let [a,b,c,d,e,f,g,j]=h;
      for(let i=0;i<64;i++){const s1=rotate(e,6)^rotate(e,11)^rotate(e,25),ch=(e&f)^(~e&g),t1=(j+s1+ch+k[i]+w[i])>>>0,s0=rotate(a,2)^rotate(a,13)^rotate(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      for(const [i,value] of [a,b,c,d,e,f,g,j].entries())h[i]=(h[i]+value)>>>0;
    }
    return h.map(v=>v.toString(16).padStart(8,'0')).join('');
  }
  function scope(parsed){
    if(!plain(parsed)&&!Array.isArray(parsed))throw new Error('Project scope requires a parsed plain project or historical project array.');
    if(own(parsed,'playerPreferenceScope')){
      const descriptor=Object.getOwnPropertyDescriptor(parsed,'playerPreferenceScope');
      if(!descriptor||!own(descriptor,'value'))throw new Error('Project preference scope cannot be executable.');
      return copy(descriptor.value);
    }
    return {kind:'PlayerPreferenceScope',version:1,id:'legacy-'+sha256(JSON.stringify(copy(parsed)))};
  }
  function freshScope(){
    const crypto=root.crypto;let id;
    if(crypto&&typeof crypto.randomUUID==='function')id=crypto.randomUUID();
    else if(crypto&&typeof crypto.getRandomValues==='function'){
      const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
      const hex=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
    }else throw new Error('Secure local randomness is unavailable; a new project preference identity was not created.');
    const record={kind:'PlayerPreferenceScope',version:1,id};if(!validScope(record))throw new Error('Secure identity generator returned an invalid UUID.');return record;
  }
  return Object.freeze({defaults,inspect,copy,scope,scopeKey,freshScope,sha256});
});
