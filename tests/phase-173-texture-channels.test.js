'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const context={window:{},console,atob:s=>Buffer.from(s,'base64').toString('binary')};
vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),context);
const O=context.window.Opus;let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+': '+e.stack);}}
function model(material){
  const arrays=[new Float32Array([0,0,0,1,0,0,0,1,0]),new Float32Array([0,0,1,0,0,1,0,0,1]),new Float32Array([0,0,1,0,0,1]),new Uint16Array([0,1,2])];
  const bytes=Buffer.concat(arrays.map(a=>Buffer.from(a.buffer)));let offset=0;
  return JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0,mode:4}]}],
    accessors:arrays.map((a,i)=>({bufferView:i,componentType:i===3?5123:5126,count:3,type:i===3?'SCALAR':i===2?'VEC2':'VEC3'})),
    bufferViews:arrays.map(a=>{const view={buffer:0,byteOffset:offset,byteLength:a.byteLength};offset+=a.byteLength;return view;}),
    buffers:[{byteLength:bytes.length,uri:'data:application/octet-stream;base64,'+bytes.toString('base64')}],materials:[material],textures:[{source:0},{source:1}],images:[{uri:'data:image/png;base64,YmFzZQ=='},{uri:'data:image/png;base64,bm9ybWFs'}]});
}
test('Actual Entity shader separates RGB tint, texture alpha and uniform emission',()=>{
  const source=fs.readFileSync(require.resolve('../engine/src/07-shader.js'),'utf8');
  assert.match(source,/vec3 albedo = u_baseColor \* texColor/);
  assert.match(source,/outColor = vec4\(color, u_alpha \* texAlpha\)/);
  assert.match(source,/color \+= u_emissiveColor \* u_emissiveIntensity/);
  assert(!/uniform sampler2D u_(normal|roughness|metallic|emissive|occlusion)/.test(source));
});
test('Actual public Material descriptor offers one portable map and detached UVs, not inert PBR slots',()=>{
  const m=O.Material.create({textureAssetRef:'color-map',alpha:0,emissiveIntensity:0,uvScale:[-2,3]});
  assert.equal(m.textureAssetRef,'color-map');assert.equal(m.alpha,0);assert.deepStrictEqual(Array.from(m.uvScale),[-2,3]);
  for(const key of ['normalMap','roughnessMap','metallicMap','emissiveMap','occlusionMap'])assert(!Object.hasOwn(m,key));
});
test('Actual public glTF importer retains base-color only when unsupported channels coexist',()=>{
  const material={pbrMetallicRoughness:{baseColorTexture:{index:0},metallicRoughnessTexture:{index:1}},normalTexture:{index:1},emissiveTexture:{index:1},occlusionTexture:{index:1}};
  const arrays=O.Mesh.toArrays(O.Mesh.fromGLTF(model(material)));
  assert.equal(arrays.textureDataURL,'data:image/png;base64,YmFzZQ==');assert.equal(arrays.positions.length,9);assert.deepStrictEqual(Array.from(arrays.uvs),[0,0,1,0,0,1]);
  const unsupported=O.Mesh.toArrays(O.Mesh.fromGLTF(model({normalTexture:{index:1},emissiveTexture:{index:1}})));
  assert.equal(unsupported.textureDataURL,null);
});
test('Creator material controls disclose the supported texture channel boundary',()=>{
  const editor=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
  assert.match(editor,/Color \+ transparency texture<select data-material-texture>/);
  assert.match(editor,/its alpha multiplies Opacity/);
  assert.match(editor,/Normal, metallic, roughness and emissive maps are not supported/);
});
console.log(JSON.stringify({pass,fail}));if(fail)process.exitCode=1;
