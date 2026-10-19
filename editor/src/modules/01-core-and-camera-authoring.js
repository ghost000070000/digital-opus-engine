// Digital Opus Editor.
// Proves the core no-code loop: drag an object in, select it (in the
// viewport or the Scene list), edit it via the inspector, save/export the
// project — all without writing JavaScript. Built entirely through
// window.Opus, same discipline as the demo.
const canvas = document.getElementById('game');
const app = Opus.create(canvas, { hud: false, defaultSettings: { mouseSensitivity: 0.0018, invertMouseY: false } });
app.scene.spinEnabled = false;

const cubeMesh = Opus.Mesh.cube();
// Wave 6 (Priority B/Section 14): the Ramp placement tool's render mesh --
// a Ramp is still kind:'cube' underneath (it inherits solid/collider/
// hierarchy/behaviors/serialization exactly like any other cube), only its
// rendered shape and its collision resolution (resolveRampCollision instead
// of the flat-top box check) differ, gated on the item's own `isRamp` flag.
const wedgeMesh = Opus.Mesh.wedge();

// Crates/hazards/boost pads were all literally cubes, distinguished only by
// color — hard to tell apart at a glance or in fog/motion. Built via the
// public Opus.Mesh.fromArrays escape hatch (flat-shaded, matching the cube
// mesh's own per-face-normal convention), no engine change needed.
function buildOctahedronMesh() {
  const v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces = [
    [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
    [1, 2, 5], [1, 5, 3], [1, 3, 4], [1, 4, 2],
  ];
  const positions = [];
  const normals = [];
  const indices = [];
  let idx = 0;
  for (const [a, b, c] of faces) {
    const tri = [v[a], v[b], v[c]];
    const nx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    const ny = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    const nz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
    const nLen = Math.hypot(nx, ny, nz);
    for (const p of tri) {
      positions.push(p[0] * 0.6, p[1] * 0.6, p[2] * 0.6);
      normals.push(nx / nLen, ny / nLen, nz / nLen);
    }
    indices.push(idx, idx + 1, idx + 2);
    idx += 3;
  }
  return Opus.Mesh.fromArrays(new Float32Array(positions), new Float32Array(normals), new Uint16Array(indices));
}

function buildPyramidMesh() {
  const base = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]];
  const apex = [0, 0.5, 0];
  const positions = [];
  const normals = [];
  const indices = [];
  let idx = 0;
  const pushTri = (p0, p1, p2) => {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    nx /= nLen; ny /= nLen; nz /= nLen;
    for (const p of [p0, p1, p2]) { positions.push(p[0], p[1], p[2]); normals.push(nx, ny, nz); }
    indices.push(idx, idx + 1, idx + 2);
    idx += 3;
  };
  // 4 sloped sides
  for (let i = 0; i < 4; i++) pushTri(base[i], base[(i + 1) % 4], apex);
  // base (2 triangles, facing down)
  pushTri(base[0], base[3], base[2]);
  pushTri(base[0], base[2], base[1]);
  return Opus.Mesh.fromArrays(new Float32Array(positions), new Float32Array(normals), new Uint16Array(indices));
}

const mineMesh = buildOctahedronMesh();
const boostMesh = buildPyramidMesh();

// Wave 6 (Priority I): the Billboard/Sprite placement tool's render mesh --
// a VERTICAL unit quad in the local XY plane (normal +Z), unlike the
// engine's existing 'plane' mesh (Opus.Mesh.plane, normal +Y, meant for a
// flat ground decal) -- a billboard needs its rest orientation facing
// outward along local +Z specifically so "rotate this entity to face the
// camera" (syncBillboards below) has a well-defined meaning. Real UVs
// (0,0..1,1) so an imported cutout-texture sprite (the primary use case
// this priority exists to serve, see the LIT_FRAG_SRC texture-alpha fix
// above) maps onto it right-side-up with no extra authoring step. No
// engine change needed for the geometry itself -- built via the same
// public Opus.Mesh.fromArrays escape hatch mine/boost already use.
function buildBillboardMesh() {
  const positions = new Float32Array([
    -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
  ]);
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]);
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return Opus.Mesh.fromArrays(positions, normals, indices, uvs);
}
const billboardMesh = buildBillboardMesh();
// True Sprites intentionally use their own mesh identity and runtime path,
// even though the base geometry is also a unit XY quad.
const spriteMesh = buildBillboardMesh();

// A landmark built via Opus.Mesh.fromGLTF (see friction #19) rather than
// buildOctahedronMesh-style hand-authored arrays -- proves the importer on
// something with a real, non-trivial node hierarchy (two mesh nodes, a
// pole and a beacon light, each with their own transform, flattened into
// one mesh) rather than only the synthetic single-node fixtures it was
// unit-tested against. A pole this shape would be tedious to hand-author
// directly as one set of arrays; expressing it as two simple primitives at
// two node transforms is exactly the case node-hierarchy flattening exists
// for.
const BEACON_GLTF_JSON = '{"asset":{"version":"2.0"},"scene":0,"scenes":[{"nodes":[0,1]}],"nodes":[{"mesh":0,"translation":[0,1.2,0]},{"mesh":1,"translation":[0,2.6,0],"scale":[1,1,1]}],"meshes":[{"primitives":[{"attributes":{"POSITION":0,"NORMAL":1},"indices":2,"mode":4}]},{"primitives":[{"attributes":{"POSITION":3,"NORMAL":4},"indices":5,"mode":4}]}],"accessors":[{"bufferView":0,"componentType":5126,"count":24,"type":"VEC3"},{"bufferView":1,"componentType":5126,"count":24,"type":"VEC3"},{"bufferView":2,"componentType":5123,"count":36,"type":"SCALAR"},{"bufferView":3,"componentType":5126,"count":24,"type":"VEC3"},{"bufferView":4,"componentType":5126,"count":24,"type":"VEC3"},{"bufferView":5,"componentType":5123,"count":24,"type":"SCALAR"}],"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":288},{"buffer":0,"byteOffset":288,"byteLength":288},{"buffer":0,"byteOffset":576,"byteLength":72},{"buffer":0,"byteOffset":648,"byteLength":288},{"buffer":0,"byteOffset":936,"byteLength":288},{"buffer":0,"byteOffset":1224,"byteLength":48}],"buffers":[{"byteLength":1272,"uri":"data:application/octet-stream;base64,mpkZPpqZmb+amRm+mpkZPpqZmb+amRk+mpkZPpqZmT+amRk+mpkZPpqZmT+amRm+mpkZvpqZmb+amRk+mpkZvpqZmb+amRm+mpkZvpqZmT+amRm+mpkZvpqZmT+amRk+mpkZvpqZmT+amRm+mpkZPpqZmT+amRm+mpkZPpqZmT+amRk+mpkZvpqZmT+amRk+mpkZvpqZmb+amRk+mpkZPpqZmb+amRk+mpkZPpqZmb+amRm+mpkZvpqZmb+amRm+mpkZvpqZmb+amRk+mpkZvpqZmT+amRk+mpkZPpqZmT+amRk+mpkZPpqZmb+amRk+mpkZPpqZmb+amRm+mpkZPpqZmT+amRm+mpkZvpqZmT+amRm+mpkZvpqZmb+amRm+AACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAABAAIAAAACAAMABAAFAAYABAAGAAcACAAJAAoACAAKAAsADAANAA4ADAAOAA8AEAARABIAEAASABMAFAAVABYAFAAWABcAzczMPgAAAAAAAAAAAAAAAM3MzD4AAAAAAAAAAAAAAADNzMw+zczMPgAAAAAAAAAAAAAAAAAAAADNzMw+AAAAAM3MzL4AAAAAzczMPgAAAAAAAAAAAAAAAM3MzL4AAAAAAAAAAAAAAADNzMy+zczMPgAAAAAAAAAAAAAAAAAAAADNzMy+AAAAAM3MzD4AAAAAzczMvgAAAAAAAAAAAAAAAM3MzD4AAAAAAAAAAAAAAADNzMy+zczMvgAAAAAAAAAAAAAAAAAAAADNzMy+AAAAAM3MzL4AAAAAzczMvgAAAAAAAAAAAAAAAM3MzL4AAAAAAAAAAAAAAADNzMw+zczMvgAAAAAAAAAAAAAAAAAAAADNzMw+AAAAAM3MzD4AAAAAOs0TPzrNEz86zRM/Os0TPzrNEz86zRM/Os0TPzrNEz86zRM/Os0TPzrNE786zRM/Os0TPzrNE786zRM/Os0TPzrNE786zRM/Os0TPzrNE786zRO/Os0TPzrNE786zRO/Os0TPzrNE786zRO/Os0TPzrNEz86zRO/Os0TPzrNEz86zRO/Os0TPzrNEz86zRO/Os0TvzrNEz86zRO/Os0TvzrNEz86zRO/Os0TvzrNEz86zRO/Os0TvzrNE786zRO/Os0TvzrNE786zRO/Os0TvzrNE786zRO/Os0TvzrNE786zRM/Os0TvzrNE786zRM/Os0TvzrNE786zRM/Os0TvzrNEz86zRM/Os0TvzrNEz86zRM/Os0TvzrNEz86zRM/AAABAAIAAwAEAAUABgAHAAgACQAKAAsADAANAA4ADwAQABEAEgATABQAFQAWABcA"}]}';
const beaconMesh = Opus.Mesh.fromGLTF(BEACON_GLTF_JSON);

// placed items: { kind: 'cube', entity, id, name? }
//             | { kind: 'terrain', handle, options, id, name? }
//             | { kind: 'water', handle, options, id, name? }
// `id` is a stable string every item gets once, at creation, and keeps for
// its whole life -- across rename, duplicate (a duplicate gets its OWN new
// id, never reuses the source's), Save/Load, Undo/Redo, and (once scenes
// exist) scene switching. This is what makes Object References (visual
// actions/Node Graph targeting "the Gate" or "EnemySpawner") possible at
// all: a raw JS reference doesn't survive serialization, but an id does.
const placed = [];
const trigger2DObjects = new Set();
const body2DObjects = new Set();
const authoredBody2DTransforms = new Map();
const EMPTY_TRIGGER_2D_INDEX = Object.freeze([]);
const CAMERA_RECORD_VERSION = 2;
const CAMERA_PROJECTIONS = ['perspective', 'orthographic'];
function cameraPosition(value, fallback = new Opus.Vec3(0, 1.6, 10)) {
  if (value instanceof Opus.Vec3) return value;
  if (Array.isArray(value)) return new Opus.Vec3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  if (value && typeof value === 'object') return new Opus.Vec3(Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0);
  return fallback.clone();
}
function normalizeCameraOptions(input, preset2D = false) {
  const source = input || {};
  const projection = source.projection == null ? (preset2D ? 'orthographic' : 'perspective') : String(source.projection);
  let orthographicHeight = source.orthographicHeight == null ? 10 : Number(source.orthographicHeight);
  if (projection === 'perspective' && (!Number.isFinite(orthographicHeight) || orthographicHeight <= 0)) orthographicHeight = 10;
  const near = source.near == null ? 0.1 : Number(source.near);
  const far = source.far == null ? 100 : Number(source.far);
  const rotation = source.rotationDegrees || { x: 0, y: 0, z: 0 };
  return {
    ...source,
    version: CAMERA_RECORD_VERSION,
    position: cameraPosition(source.position, preset2D ? new Opus.Vec3(0, 0, 10) : new Opus.Vec3(0, 1.6, 0)),
    mode: source.mode || (preset2D ? 'fixed' : 'chase'),
    projection,
    fovDegrees: Number.isFinite(Number(source.fovDegrees)) ? Number(source.fovDegrees) : 45,
    orthographicHeight,
    near,
    far,
    rotationDegrees: { x: Number(rotation.x) || 0, y: Number(rotation.y) || 0, z: Number(rotation.z) || 0 },
    chase: { distance: 8, height: 3, pitch: 0.2, lerpSpeed: 6, rotationLerpSpeed: 8, lookAhead: 0.5, bearingMode:'followTarget', bearingYaw:0, ...(source.chase || {}) },
    lookAtTargetId: source.lookAtTargetId || null,
    obstruction: source.obstruction!==undefined&&(source.obstruction===null||typeof source.obstruction!=='object'||Array.isArray(source.obstruction)) ? source.obstruction : { enabled:false, radius:0.25, padding:0.05, ...(source.obstruction || {}) },
    targetGroup: source.targetGroup===undefined ? {enabled:false,targetIds:[],padding:0.1} : JSON.parse(JSON.stringify(source.targetGroup)),
  };
}
function cameraBuiltPresetOptions(type, point = new Opus.Vec3(0,1.6,0)) {
  const is2D=type==='camera2d',isThirdPerson=type==='cameraThirdPerson',isTopDown=type==='cameraTopDown',isIsometric=type==='cameraIsometric';
  const options=normalizeCameraOptions({position:point.clone(),mode:is2D?'fixed':'chase',projection:is2D?'orthographic':'perspective'},is2D);
  if(isThirdPerson)options.chase={...options.chase,distance:6.5,height:2.6,pitch:0.28,lerpSpeed:6.5,rotationLerpSpeed:8.5,lookAhead:0.8};
  if(isTopDown||isIsometric)Object.assign(options,{projection:isIsometric?'orthographic':'perspective',orthographicHeight:20,fovDegrees:45,chase:{...options.chase,distance:9,height:isIsometric?0.5+9/Math.sqrt(2):18.5,pitch:0,lookAhead:0,bearingMode:'fixed',bearingYaw:isIsometric?-135*Math.PI/180:Math.PI}});
  return options;
}
function validateCameraOptions(options, location = {}) {
  const opts = options || {}; const issues = []; const base = { severity: 'error', scope: 'camera', field: 'projection', ...location };
  if(opts.targetGroup!==undefined){const group=opts.targetGroup;if(!group||typeof group!=='object'||Array.isArray(group)||typeof group.enabled!=='boolean'||!Array.isArray(group.targetIds)||group.targetIds.length>128||group.targetIds.some(id=>typeof id!=='string'||!id)||new Set(group.targetIds).size!==group.targetIds.length||typeof group.padding!=='number'||!Number.isFinite(group.padding)||group.padding<0||group.padding>=0.5)issues.push({...base,field:'targetGroup',code:'camera-target-group-invalid',message:'Camera target group settings are invalid; saved references are retained.'});else if(group.enabled&&(opts.mode!=='fixed'||!group.targetIds.length))issues.push({...base,field:'targetGroup',code:'camera-target-group-unavailable',message:'Choose Fixed mode and at least one named visible target for group framing.'});}
  if (!CAMERA_PROJECTIONS.includes(opts.projection == null ? 'perspective' : opts.projection)) issues.push({ ...base, code: 'camera-projection-invalid', message: `Camera Projection must be Perspective or Orthographic; found "${opts.projection}".` });
  const near = Number(opts.near == null ? 0.1 : opts.near); const far = Number(opts.far == null ? 100 : opts.far);
  if (!Number.isFinite(near) || near <= 0 || !Number.isFinite(far) || far <= near) issues.push({ ...base, field: 'near', code: 'camera-clip-range-invalid', message: 'Camera Near and Far must be finite, with 0 < Near < Far.' });
  if (opts.projection === 'orthographic') {
    const height = Number(opts.orthographicHeight);
    if (!Number.isFinite(height) || height <= 0) issues.push({ ...base, field: 'orthographicHeight', code: 'camera-orthographic-height-invalid', message: 'Orthographic Height must be a finite number greater than zero.' });
  }
  if (opts.chase && opts.chase.bearingMode !== undefined && !['followTarget','fixed'].includes(opts.chase.bearingMode)) issues.push({ ...base, field:'chase.bearingMode', code:'camera-bearing-mode-invalid', message:'Camera Follow Bearing must be Follow Player facing or Fixed map bearing.' });
  if (opts.chase && opts.chase.bearingYaw !== undefined && (typeof opts.chase.bearingYaw !== 'number' || !Number.isFinite(opts.chase.bearingYaw))) issues.push({ ...base, field:'chase.bearingYaw', code:'camera-bearing-yaw-invalid', message:'Camera Fixed Bearing must be a finite number of radians. Choose a finite degree value in the Camera Inspector.' });
  if(opts.obstruction!==undefined&&(opts.obstruction===null||typeof opts.obstruction!=='object'||Array.isArray(opts.obstruction)))issues.push({...base,field:'obstruction',code:'camera-obstruction-record-invalid',message:'Camera obstacle avoidance settings must be a settings record. Saved data is retained; choose valid Camera settings before Play or export.'});
  for(const [key,valid]of [['enabled',value=>typeof value==='boolean'],['radius',value=>typeof value==='number'&&Number.isFinite(value)&&value>0],['padding',value=>typeof value==='number'&&Number.isFinite(value)&&value>=0]])if(opts.obstruction&&opts.obstruction[key]!==undefined&&!valid(opts.obstruction[key]))issues.push({...base,field:'obstruction.'+key,code:'camera-obstruction-'+key+'-invalid',message:'Camera obstacle avoidance needs an Enabled checkbox, positive finite clearance, and nonnegative finite padding.'});
  return issues;
}
function changeCameraAuthoringField(item,key,value,onBeforeChange) {
  if(playMode||!item||item.kind!=='camera')return false;
const options=normalizeCameraOptions(item.options),numeric=['position.x','position.y','position.z','fovDegrees','orthographicHeight','near','far','rotationDegrees.x','rotationDegrees.y','rotationDegrees.z','chase.distance','chase.height','chase.bearingYaw','chase.pitch','chase.lookAhead','chase.lerpSpeed','chase.rotationLerpSpeed'];
  if(key.startsWith('obstruction.')&&(!options.obstruction||typeof options.obstruction!=='object'||Array.isArray(options.obstruction)))return false;
  if(key==='obstruction.radius'||key==='obstruction.padding'){if(typeof value!=='number'||!Number.isFinite(value)||(key==='obstruction.radius'?value<=0:value<0))return false;}
  else if(key==='obstruction.enabled'){if(typeof value!=='boolean')return false;}
  else if(numeric.includes(key)){
    if(typeof value!=='number'||!Number.isFinite(value))return false;
    if(key==='fovDegrees'&&(value<20||value>120))return false;
    if(['orthographicHeight','near','far','chase.distance','chase.lerpSpeed','chase.rotationLerpSpeed'].includes(key)&&value<=0)return false;
    if(key==='chase.height'&&value<=0)return false;
    if(key==='near'&&!(Number.isFinite(options.far)&&value<options.far)||key==='far'&&!(Number.isFinite(options.near)&&value>options.near))return false;
  }else if(key==='projection'){if(!CAMERA_PROJECTIONS.includes(value))return false;}
  else if(key==='mode'){if(!['chase','orbit','fixed','followLookAt'].includes(value))return false;}
  else if(key==='chase.bearingMode'){if(!['followTarget','fixed'].includes(value))return false;}
  else if(key==='lookAtTargetId'){if(value!==null&&(typeof value!=='string'||!placed.some(entry=>entry.id===value)))return false;}
  else return false;
  const parts=key.split('.'),current=parts.length===2?options[parts[0]][parts[1]]:options[key];if(current===value)return false;
  if(typeof onBeforeChange==='function')onBeforeChange();else pushUndo();
  if(parts.length===2){if(parts[0]==='position'){options.position=options.position.clone();options.position[parts[1]]=value;item.entity.position[parts[1]]=value;if(typeof commitEditedWorldTransform==='function')commitEditedWorldTransform(item);}else options[parts[0]]={...options[parts[0]],[parts[1]]:value};}
  else options[key]=value;
  item.options=options;refreshCameraView(item);return true;
}
function inspectCameraTargetGroup(group) {
  if(!group||typeof group!=='object'||Array.isArray(group)||typeof group.enabled!=='boolean'||!Array.isArray(group.targetIds)||group.targetIds.length>128||group.targetIds.some(id=>typeof id!=='string'||!id)||new Set(group.targetIds).size!==group.targetIds.length||typeof group.padding!=='number'||!Number.isFinite(group.padding)||group.padding<0||group.padding>=0.5)return {ok:false,reason:'Target group requires an Enabled checkbox, up to 128 distinct named objects, and padding from 0 to less than 0.5.'};
  return {ok:true};
}
function changeCameraTargetGroup(item,group) {
  if(playMode||!item||item.kind!=='camera'||!inspectCameraTargetGroup(group).ok)return false;
  if(group.enabled&&item.options.mode!=='fixed')return false;
  if(JSON.stringify(item.options.targetGroup)===JSON.stringify(group))return false;
  pushUndo();item.options={...item.options,targetGroup:JSON.parse(JSON.stringify(group))};refreshCameraView(item);return true;
}
function cameraTargetGroupCorners(item, selectionIds) {
  // Shared bounded rendered-geometry query; no synthetic Camera is created.
  const group=selectionIds===undefined?item.options.targetGroup:{enabled:true,targetIds:selectionIds,padding:0.1},valid=inspectCameraTargetGroup(group);if(!valid.ok)return valid;
  if(selectionIds===undefined&&item.options.mode!=='fixed')return {ok:false,reason:'Target groups require Fixed Camera mode.'};
  if(!group.targetIds.length)return {ok:false,reason:'Choose at least one visible target.'};
  const corners=[];
  for(const id of group.targetIds){const target=placed.find(entry=>entry.id===id),entity=target?.entity;
    if(!target||!entity||entity.destroyed||entity.visible===false)return {ok:false,reason:'A target is missing or hidden; saved references are retained.'};
    if(entity.skin||target.isBillboard||target.isRamp||!['cube','sprite'].includes(target.kind))return {ok:false,reason:'Target geometry is unsupported. Use ordinary Cubes, static meshes or true Sprites.'};
    let min=[-0.5,-0.5,target.kind==='sprite'?0:-0.5],max=[0.5,0.5,target.kind==='sprite'?0:0.5];
    if(target.kind==='sprite'&&(!entity.spriteRenderer||entity.spriteRenderer.visible===false))return {ok:false,reason:'This target is not a visible true Sprite.'};
    if(target.kind==='cube'&&entity.mesh!==cubeMesh){let positions;try{positions=Opus.Mesh.toArrays(entity.mesh).positions;}catch(error){return {ok:false,reason:'This mesh has no supported static rendered-array bounds.'};}if(!positions.length||positions.length%3||positions.length>30000)return {ok:false,reason:'Static mesh framing supports up to 10,000 vertices per target.'};min=[Infinity,Infinity,Infinity];max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i++){if(!Number.isFinite(positions[i]))return {ok:false,reason:'Static mesh bounds contain invalid coordinates.'};min[i%3]=Math.min(min[i%3],positions[i]);max[i%3]=Math.max(max[i%3],positions[i]);}}
    const matrix=entity.modelMatrix.m;if(!matrix||matrix.length!==16||!Array.from(matrix).every(Number.isFinite))return {ok:false,reason:'Target world transform is invalid.'};
    for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of target.kind==='sprite'?[0]:[min[2],max[2]])corners.push(new Opus.Vec3(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]));
  }
  return {ok:true,corners};
}
function focusViewportSelection() {
  if(playMode){showStatus('Stop Play before focusing the authoring viewport.');return false;}
  if(cameraViewState){showStatus('Exit Camera View before focusing the authoring viewport.');return false;}
  const ids=[...selectedItems].map(item=>item.id);
  const bounds=cameraTargetGroupCorners(null,ids);
  if(!bounds.ok){showStatus(bounds.reason||'Select visible Cubes, static meshes or true Sprites to focus.');return false;}
  const fit=app.camera.computeFraming(bounds.corners,{aspect:cameraViewportAspect(),padding:0.1});
  if(!fit.ok){showStatus(`Cannot focus selection: ${fit.reason}. No camera settings changed.`);return false;}
  const distance=fit.eye.sub(fit.target).length();
  if(!Number.isFinite(distance)||distance<=0||distance>(app.camera.orbitOptions?.maxDistance||30)){showStatus('Selection cannot fit the editor orbit range. Focus a smaller group; no camera settings changed.');return false;}
  const direction=fit.eye.sub(fit.target);
  const pitch=Math.asin(Math.max(-1,Math.min(1,direction.y/distance)));
  if(Math.abs(pitch)>1.5){showStatus('This view is too steep for editor orbit. Adjust the viewing angle before focusing; no camera settings changed.');return false;}
  app.camera.setTarget(null);
  // Editable exports can retain a controller's fixed view after Stop. Focus
  // explicitly returns to the authoring orbit, keeping the fitted viewing
  // direction; an explicit authored Camera View above is never overwritten.
  app.camera.yaw=Math.atan2(direction.x,direction.z);
  app.camera.pitch=pitch;
  app.camera.setMode('orbit');
  app.camera.target=fit.target.clone();
  app.camera.distance=Math.max(app.camera.orbitOptions?.minDistance||2,distance);
  if(fit.projection==='orthographic')app.camera.setOrthographicHeight(fit.orthographicHeight);
  showStatus('Focused selection in the authoring viewport only; game Cameras and project history are unchanged.');
  return true;
}
function cameraTargetGroupWarning(item,message) {
  // Public fit codes remain stable; the creator sees an actionable explanation.
  const explanations={
    'frustum-depth-infeasible':'The targets cannot fit between this Camera\'s Near and Far clip planes. Review the clip planes or reduce the target group\'s depth; no Camera settings were changed.',
    'camera-frustum-invalid':'This Camera has invalid clip planes or field of view. Set a positive Near plane, a farther Far plane, and a valid field of view before framing.',
    'camera-basis-invalid':'This Camera has no usable viewing direction or Up orientation. Adjust its position, rotation or target before framing.',
    'geometry-overflow':'The target geometry is too large or too far from the scene origin to frame safely. Reduce its size or move it closer to the origin.',
    'empty-targets':'Choose at least one visible supported object for this Camera to frame.',
  };
  if(Object.prototype.hasOwnProperty.call(explanations,message))message=explanations[message];
  const changed=item._targetGroupWarning!==message;item._targetGroupWarning=message;
  if(selectedItem===item){const status=document.getElementById('camera-target-group-status');if(status)status.textContent=message||'Target group framing is available.';}
  if(changed&&message)showStatus(message);
}
function applyCameraTargetGroup(item) {
  const bounds=cameraTargetGroupCorners(item);if(!bounds.ok){cameraTargetGroupWarning(item,bounds.reason);return false;}
  const fit=app.camera.computeFraming(bounds.corners,{aspect:cameraViewportAspect(),padding:item.options.targetGroup.padding});
  cameraTargetGroupWarning(item,fit.ok?'':fit.reason);if(!fit.ok)return false;
  app.camera.setFixedOptions({eye:fit.eye,target:fit.target,up:fit.up});if(fit.projection==='orthographic')app.camera.setOrthographicHeight(fit.orthographicHeight);return true;
}
function refreshActiveCameraTargetGroup() {
  if(!playMode||activeCameraBlend||activeCameraPath)return;const item=placed.find(entry=>entry.kind==='camera'&&entry.id===lastAppliedCameraItemId);
  if(item?.options?.targetGroup?.enabled&&item.options.mode==='fixed')applyCameraTargetGroup(item);
}
function cameraTargetGroupFieldsHTML(item) {
  const group=item.options.targetGroup,valid=inspectCameraTargetGroup(group),ui=valid.ok?group:{enabled:false,targetIds:[],padding:0.1};
  return `<div class="field-row"><label><input type="checkbox" id="camera-target-group-enabled"${ui.enabled?' checked':''} style="width:auto"> Frame target group (Fixed mode)</label></div><label>Frame padding (fraction per edge)<input type="number" id="camera-target-group-padding" value="${ui.padding}" min="0" max="0.49" step="0.01"></label><label>Named target<select id="camera-target-group-picker"><option value="">Choose object…</option>${placed.filter(entry=>entry!==item&&entry.entity).map(entry=>`<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name||itemDisplayName(entry,placed.indexOf(entry)))}</option>`).join('')}</select></label><button class="toolbar-btn" id="camera-target-group-add">Add target</button><button class="toolbar-btn" id="camera-target-group-capture">Use selected objects</button><div>${ui.targetIds.map(id=>{const target=placed.find(entry=>entry.id===id);return `<div>${escapeHtml(target?.name|| (target?itemDisplayName(target,placed.indexOf(target)):'Unavailable saved target'))}<button class="toolbar-btn" data-camera-target-remove="${escapeHtml(id)}">Remove</button></div>`;}).join('')}</div><p class="field-help" id="camera-target-group-status">${escapeHtml(!valid.ok?valid.reason:item._targetGroupWarning||'Fixed-only rendered bounds: ordinary Cubes, static meshes and true Sprites. Missing or unsupported targets refuse fitting; references stay saved. No obstruction guarantee.')}</p>`;
}
function bindCameraTargetGroupControls(item) {
  const host=document.getElementById('camera-target-group-fields');if(!host)return;const valid=inspectCameraTargetGroup(item.options.targetGroup);
  const commit=next=>{const changed=changeCameraTargetGroup(item,next);if(changed)renderInspector();else{const status=document.getElementById('camera-target-group-status');if(status)status.textContent='Settings unchanged. Choose Fixed mode, valid named targets and padding from 0 to less than 0.5.';}};
  host.querySelectorAll('input,select,button').forEach(input=>{input.disabled=playMode||!valid.ok;});if(!valid.ok)return;
  const copy=()=>JSON.parse(JSON.stringify(item.options.targetGroup));
  document.getElementById('camera-target-group-enabled').onchange=e=>commit({...copy(),enabled:e.target.checked});
  document.getElementById('camera-target-group-padding').onchange=e=>commit({...copy(),padding:e.target.value.trim()?Number(e.target.value):NaN});
  document.getElementById('camera-target-group-add').onclick=()=>{const id=document.getElementById('camera-target-group-picker').value,group=copy();if(id&&id!==item.id&&!group.targetIds.includes(id))commit({...group,targetIds:[...group.targetIds,id]});};
  document.getElementById('camera-target-group-capture').onclick=()=>commit({...copy(),targetIds:[...selectedItems].filter(target=>target!==item&&target.entity).map(target=>target.id)});
  host.querySelectorAll('[data-camera-target-remove]').forEach(button=>{button.onclick=()=>commit({...copy(),targetIds:copy().targetIds.filter(id=>id!==button.dataset.cameraTargetRemove)});});
}
function makeCameraActive(item) {
  if(playMode||!item||item.kind!=='camera'||!placed.includes(item))return false;
  if(placed.filter(entry=>entry.kind==='camera').every(entry=>!!entry.isActiveCamera===(entry===item)))return false;
  pushUndo();for(const entry of placed)if(entry.kind==='camera')entry.isActiveCamera=entry===item;renderInspector();showStatus(`${item.name||'Camera'} is the active camera`);return true;
}
function alignCameraTo2D(item) {
  if(playMode||!item||item.kind!=='camera')return false;const options=normalizeCameraOptions(item.options);
  if(options.mode==='fixed'&&['x','y','z'].every(axis=>options.rotationDegrees[axis]===0))return false;
  pushUndo();item.options={...options,mode:'fixed',rotationDegrees:{x:0,y:0,z:0}};refreshCameraView(item);renderInspector();return true;
}
function cameraPitchDegrees(pitch) {
  const degrees = pitch * 180 / Math.PI;
  return Number.isFinite(degrees) ? Number(degrees.toFixed(6)) : degrees;
}
function bindCameraAuthoringControls(item) {
  const fields={'f-x':'position.x','f-y':'position.y','f-z':'position.z','f-projection':'projection','f-mode':'mode','f-fov':'fovDegrees','f-ortho-height':'orthographicHeight','f-near':'near','f-far':'far','f-camera-rx':'rotationDegrees.x','f-camera-ry':'rotationDegrees.y','f-camera-rz':'rotationDegrees.z','f-chase-distance':'chase.distance','f-chase-height':'chase.height','f-chase-bearing-mode':'chase.bearingMode','f-chase-bearing-yaw':'chase.bearingYaw','f-chase-pitch':'chase.pitch','f-chase-look-ahead':'chase.lookAhead','f-chase-lerp':'chase.lerpSpeed','f-chase-rot-lerp':'chase.rotationLerpSpeed','f-lookat':'lookAtTargetId'};
  for(const [id,key] of Object.entries(fields)){const input=document.getElementById(id);if(!input)continue;input.disabled=playMode;let recorded=false;input.onfocus=()=>{recorded=false;};const discrete=['projection','mode','lookAtTargetId','chase.bearingMode'].includes(key);const handler=e=>{const text=e.target.value,value=discrete?(key==='lookAtTargetId'?(text||null):text):(typeof text==='string'&&text.trim()?Number(text):NaN);const canonicalValue=(key==='chase.pitch'||key==='chase.bearingYaw')?((value===cameraPitchDegrees(item.options.chase[key.split('.')[1]])||value===item.options.chase[key.split('.')[1]]*180/Math.PI)?item.options.chase[key.split('.')[1]]:value*Math.PI/180):value;const changed=changeCameraAuthoringField(item,key,canonicalValue,()=>{if(!recorded||discrete){pushUndo();recorded=true;}});const status=document.getElementById('camera-authoring-status');if(status)status.textContent=changed?'Camera setting updated.':'Saved setting unchanged. Use finite values, positive framing and clip ranges, and Near less than Far.';if(changed&&['projection','mode'].includes(key))renderInspector();};if(discrete)input.onchange=handler;else{input.oninput=handler;input.onblur=()=>{const parts=key.split('.'),value=parts.length===2?item.options[parts[0]][parts[1]]:item.options[key];input.value=String((key==='chase.pitch'||key==='chase.bearingYaw')?cameraPitchDegrees(value):value);};}}
  const align=document.getElementById('camera-align-2d'),active=document.getElementById('camera-active-btn');align.disabled=playMode;active.disabled=playMode;align.onclick=()=>alignCameraTo2D(item);active.onclick=()=>makeCameraActive(item);
  for(const [id,key]of Object.entries({'f-camera-obstruction-enabled':'enabled','f-camera-obstruction-radius':'radius','f-camera-obstruction-padding':'padding'})){
    const input=document.getElementById(id);if(!input)continue;input.disabled=playMode;let recorded=false;input.onfocus=()=>{recorded=false;};
    const handler=()=>{const value=key==='enabled'?input.checked:(input.value.trim()?Number(input.value):NaN);const changed=changeCameraAuthoringField(item,'obstruction.'+key,value,()=>{if(!recorded||key==='enabled'){pushUndo();recorded=true;}});const status=document.getElementById('camera-authoring-status');if(status)status.textContent=changed?'Camera obstacle setting updated.':'Saved setting unchanged. Clearance must be positive and finite; padding must be nonnegative and finite.';};
    if(key==='enabled')input.onchange=handler;else{input.oninput=handler;input.onblur=()=>{input.value=String(item.options.obstruction?.[key]??(key==='radius'?0.25:0.05));};}
  }
}
function cameraOrientation(options) {
  const rotation = options.rotationDegrees || { x: 0, y: 0, z: 0 };
  return Opus.Quat.fromEuler((rotation.x || 0) * Math.PI / 180, (rotation.y || 0) * Math.PI / 180, (rotation.z || 0) * Math.PI / 180);
}
function cameraViewportAspect() {
  const width = Number(canvas.width || canvas.clientWidth); const height = Number(canvas.height || canvas.clientHeight);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 1;
}
let cameraViewState = null;
function snapshotSceneCamera() {
  return {
    motionState: app.camera.captureMotionState(),
    mode: app.camera.mode, yaw: app.camera.yaw, pitch: app.camera.pitch, distance: app.camera.distance,
    target: app.camera.target && app.camera.target.clone ? app.camera.target.clone() : app.camera.target,
    targetEntity: app.camera.targetEntity, fovY: app.camera.fovY, near: app.camera.near, far: app.camera.far,
    projection: app.camera.projection, orthographicHeight: app.camera.orthographicHeight,
    chaseOptions: { ...app.camera.chaseOptions },
    obstructionOptions: { ...app.camera.obstructionOptions },
    fixedOptions: { eye: app.camera.fixedOptions.eye.clone(), target: app.camera.fixedOptions.target.clone(), up: app.camera.fixedOptions.up.clone() },
  };
}
function restoreSceneCamera(state) {
  if (!state) return;
  app.camera.yaw = state.yaw; app.camera.pitch = state.pitch; app.camera.distance = state.distance;
  app.camera.target = state.target; app.camera.targetEntity = state.targetEntity;
  app.camera.fovY = state.fovY; app.camera.near = state.near; app.camera.far = state.far;
  app.camera.setProjection(state.projection || 'perspective');
  app.camera.setOrthographicHeight(state.orthographicHeight || 10);
  app.camera.setFixedOptions(state.fixedOptions);
  app.camera.setChaseOptions({ bearingMode:'followTarget', bearingYaw:0, ...(state.chaseOptions || {}) });
  app.camera.setObstructionOptions({enabled:false,radius:0.25,padding:0.05,...(state.obstructionOptions||{})});
  app.camera.setMode(state.mode);
  if(state.motionState)app.camera.restoreMotionState(state.motionState);
}
function enterCameraView(item) {
  if (!item || item.kind !== 'camera') return;
  if (!cameraViewState) cameraViewState = { snapshot: snapshotSceneCamera(), itemId: item.id };
  else cameraViewState.itemId = item.id;
  applyCameraPreset(item);
  const button = document.getElementById('camera-view-exit'); if (button) button.hidden = false;
  showStatus(`Viewing through ${item.name || 'Camera'}`);
  renderInspector();
}
function exitCameraView() {
  if (!cameraViewState) return;
  restoreSceneCamera(cameraViewState.snapshot); cameraViewState = null;
  const button = document.getElementById('camera-view-exit'); if (button) button.hidden = true;
  showStatus('Returned to Scene View'); renderInspector();
}
function refreshCameraView(item) {
  if (cameraViewState && cameraViewState.itemId === item.id) applyCameraPreset(item);
}
document.getElementById('camera-view-exit').onclick = exitCameraView;
// `levels`: a project can hold more than one level, each its own full
// `placed`-shaped object list; exactly one is "active" at a time (its
// content IS `placed`/the live engine entities -- the others sit here as
// plain serialized data until switched to). `objects` starts empty and is
// only ever read after `syncCurrentLevelObjects()` has just written the
// live scene into it, so the placeholder is never actually stale.
// Stable level IDs (Wave 3): a level referenced by ID survives rename AND
// reorder, unlike the earlier name-based Switch Level lookup. Assigned once
// at creation, never reused, never renumbered on reorder/delete -- same
// "monotonic, never recycled" contract as object/prefab ids already use.
let nextLevelId = 1;
function generateLevelId() { return `level${nextLevelId++}`; }
// Every level gets `.id` assigned WHEN loaded/created (see ensureLevelIds,
// applied on load) rather than trusting older saved projects to already
// have one.
function reconcileLevelIdCounter(id) {
  const match = /^level(\d+)$/.exec(id);
  if (match) nextLevelId = Math.max(nextLevelId, Number(match[1]) + 1);
}
function ensureLevelIds(levelArray) {
  for (const l of levelArray) {
    if (l.id) reconcileLevelIdCounter(l.id);
    else l.id = generateLevelId();
  }
}

const DEFAULT_SPRITE_SORTING_LAYER_ID = OpusAuthoringPlumbing.DEFAULT_SPRITE_SORTING_LAYER_ID;
let spriteSortingLayers = OpusAuthoringPlumbing.defaultSpriteSortingLayers();
let collisionLayers = OpusCollisionFilter2D.normalizeLayers();
let nextSpriteSortingLayerId = 1;
function generateSpriteSortingLayerId() { return `sprite-layer-${nextSpriteSortingLayerId++}`; }
function reconcileSpriteSortingLayerIdCounter(id) {
  const match = /^sprite-layer-(\d+)$/.exec(id);
  if (match) nextSpriteSortingLayerId = Math.max(nextSpriteSortingLayerId, Number(match[1]) + 1);
}
function orderedSpriteSortingLayers() {
  return spriteSortingLayers.slice().sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
function spriteSortingLayerOrder(ref) {
  const lookup = OpusAuthoringPlumbing.spriteSortingLayerOrderMap(spriteSortingLayers);
  return lookup.map.has(ref) ? lookup.map.get(ref) : lookup.fallbackOrder;
}
function syncSpriteSortingForItem(item) {
  if (!item || item.kind !== 'sprite' || !item.entity) return;
  const component = item.components && item.components['sprite-renderer'];
  if (!component) return;
  item.entity.spriteSortingLayerRef = component.sortingLayerRef;
  item.entity.spriteSortingLayerOrder = spriteSortingLayerOrder(component.sortingLayerRef);
  item.entity.spriteOrderInLayer = component.orderInLayer;
  item.entity.spriteStableId = item.id || '';
}
function syncAllSpriteSorting() {
  for (const item of placed) { syncSpriteSortingForItem(item); if (item.kind === 'tilemap') syncTilemapRenderer(item); }
}

let parallaxLayers = [];
let nextParallaxLayerId = 1;
function generateParallaxLayerId() { return `parallax-layer-${nextParallaxLayerId++}`; }
function reconcileParallaxLayerIdCounter(id) {
  const match = /^parallax-layer-(\d+)$/.exec(id);
  if (match) nextParallaxLayerId = Math.max(nextParallaxLayerId, Number(match[1]) + 1);
}
let parallaxCameraState = { identity: null, reference: null };
function stableCameraPosition() {
  const eye = app.camera.eye; const shake = app.camera.shakeOffset;
  return { x: eye.x - (shake ? shake.x : 0), y: eye.y - (shake ? shake.y : 0), z: eye.z - (shake ? shake.z : 0) };
}
function parallaxCameraIdentity() { return lastAppliedCameraItemId || 'session-default-camera'; }
function resetParallaxRuntime() {
  parallaxCameraState = { identity: null, reference: null };
  for (const item of placed) if (item.kind === 'sprite' && item.entity) item.entity.spriteRenderOffset.set(0, 0, 0);
}
function captureParallaxReference() {
  parallaxCameraState = { identity: parallaxCameraIdentity(), reference: stableCameraPosition() };
}
function syncSpriteParallax() {
  if (!playMode) { resetParallaxRuntime(); return; }
  const identity = parallaxCameraIdentity();
  if (!parallaxCameraState.reference || parallaxCameraState.identity !== identity) captureParallaxReference();
  const current = stableCameraPosition();
  for (const item of placed) {
    if (item.kind !== 'sprite' || !item.entity) continue;
    const component = item.components && item.components['sprite-renderer'];
    const factors = OpusAuthoringPlumbing.resolveParallaxFactors(component && component.parallaxLayerRef, parallaxLayers);
    const offset = OpusAuthoringPlumbing.spriteParallaxOffset(current, parallaxCameraState.reference, factors);
    item.entity.spriteRenderOffset.set(offset.x, offset.y, 0);
  }
}

// Edit-mode framing aid for selected orthographic cameras. The rectangle is
// derived from the actual viewport aspect and the camera's authored rotation;
// it is editor furniture only and is never serialized or shown during Play.
const orthographicFrameEntities = [];
function ensureOrthographicFrameEntities() {
  while (orthographicFrameEntities.length < 4) {
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.2, 0.9, 1], position: new Opus.Vec3(), scale: new Opus.Vec3(1, 0.025, 0.025) });
    entity.unlit = true; entity.visible = false; orthographicFrameEntities.push(entity);
  }
}
function syncOrthographicCameraFrame() {
  ensureOrthographicFrameEntities();
  const item = !playMode && !cameraViewState && selectedItem && selectedItem.kind === 'camera' && selectedItem.options.projection === 'orthographic' ? selectedItem : null;
  for (const entity of orthographicFrameEntities) entity.visible = !!item;
  if (!item) return;
  const height = Number(item.options.orthographicHeight);
  if (!Number.isFinite(height) || height <= 0) return;
  const width = height * cameraViewportAspect();
  const q = cameraOrientation(item.options); const center = item.entity.position.add(q.rotateVec3(new Opus.Vec3(0, 0, -1)));
  const specs = [
    [new Opus.Vec3(0, height / 2, 0), new Opus.Vec3(width, 0.025, 0.025)],
    [new Opus.Vec3(0, -height / 2, 0), new Opus.Vec3(width, 0.025, 0.025)],
    [new Opus.Vec3(-width / 2, 0, 0), new Opus.Vec3(0.025, height, 0.025)],
    [new Opus.Vec3(width / 2, 0, 0), new Opus.Vec3(0.025, height, 0.025)],
  ];
  for (let i = 0; i < 4; i++) {
    const [offset, scale] = specs[i]; const entity = orthographicFrameEntities[i];
    entity.position = center.add(q.rotateVec3(offset)); entity.scale = scale; entity.quaternion = q; entity.visible = true;
  }
}
app.onUpdate(syncOrthographicCameraFrame);

let levels = [{ id: generateLevelId(), name: 'Level 1', objects: [], environment: null, playerSettings: null, ui: null, description: '', ambientAudio: null }];
let currentLevelIndex = 0;
// Which level a fresh Play session boots into -- distinct from
// currentLevelIndex (which level is open for EDITING). A project with a
// "final boss" level authored last, but meant to be played from level 0,
// needs these to be independently settable.
let startLevelIndex = 0;
// Project-wide (not per-level) -- how switching levels DURING PLAY looks,
// not gameplay-affecting. Real wall-clock time (setTimeout), not
// simulation time, so a fade transition works identically whether or not
// the game happens to be paused at the moment it fires.
let levelTransitionConfig = { mode: 'instant', duration: 0.4 };
// Export Tiers metadata -- project-wide identification, not gameplay-
// affecting. Title (if set) becomes the exported HTML's document.title;
// Author/Version/Description are otherwise just carried through Save/
// Load/Export for the author's own record-keeping (a itch.io/TPT listing,
// a changelog entry) -- deliberately NOT forced into any in-game UI, since
// Start Screen/HUD text is already separately authorable and shouldn't be
// silently overwritten by unrelated metadata fields.
function defaultProjectMeta() { return { title: '', author: '', version: '1.0.0', description: '' }; }
let projectMeta = defaultProjectMeta();
// Portable project identity only; player preferences never enter project data.
let playerPreferenceScope;
let gamepadTuningRuntime = null;
// Contexts gate logical Actions, never physical source-owned input leases.
let inputContexts = {kind:'InputContexts',version:1,contexts:[]};
let inputContextRuntime = null;
let editingInputContextId = '';
// Matches Renderer's own constructor defaults (engine/src/09-renderer.js) --
// applied whenever a level has no saved environment of its own, so
// switching TO a level that never customized its mood doesn't inherit
// whatever a DIFFERENT level's environment happened to leave behind.
const DEFAULT_ENVIRONMENT = { lightDir: new Opus.Vec3(-0.5, -1.0, -0.3), skyTop: [0.06, 0.10, 0.24], skyHorizon: [0.62, 0.68, 0.80], groundColor: [0.16, 0.16, 0.14], sunColor: [1.0, 0.92, 0.75], fogDensity: 0.035, postProcessing: {enabled:false,exposure:0,saturation:1}, lighting2D: {enabled:false,ambient:0.25} };
// Same "apply whenever a level never customized this" role as DEFAULT_ENVIRONMENT
// above, one entry per controller since each exposes different tunables.
const DEFAULT_PLAYER_SETTINGS = {
  platformer2d: { controllerType: 'platformer2d', platformerObjectRef: null, maxHealth: 100 },
  topdown2d: { controllerType: 'topdown2d', topdownObjectRef: null, maxHealth: 100 },
  hovercraft: { controllerType: 'hovercraft', moveSpeed: 11, acceleration: 10, steeringRate: 1.6, boostImpulse: 4.5, boostAcceleration: 6, boostMaxSpeed: 17, drag: 0.72, maxHealth: 100 },
  topdown: { controllerType: 'topdown', moveSpeed: 6, acceleration: 24, rotateToMovement: true, collisionRadius: 0.5, maxHealth: 100 },
  thirdperson: { controllerType: 'thirdperson', moveSpeed: 6.5, acceleration: 30, collisionRadius: 0.5, maxHealth: 100, jumpEnabled: false, gravity: 20, jumpSpeed: 8 },
  firstperson: { controllerType: 'firstperson', moveSpeed: 6, acceleration: 40, collisionRadius: 0.4, maxHealth: 100, gravity: 20, jumpSpeed: 8, mouseSensitivity: 0.0022, fovDegrees: 70, eyeHeight: 0.6 },
};
function defaultPlayerSettings(controllerType) {
  const type = DEFAULT_PLAYER_SETTINGS[controllerType] ? controllerType : 'hovercraft';
  return Object.assign({}, DEFAULT_PLAYER_SETTINGS[type]);
}
// Compose existing controller settings without discarding creator-owned extensions.
function buildPlayerControllerSettings(current, type, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_PLAYER_SETTINGS,type)) return {ok:false,reason:'Choose a supported Player play style.'};
  if (!current || typeof current!=='object' || Array.isArray(current)) return {ok:false,reason:'Current Player settings are unavailable; retain the project for recovery.'};
  const next=JSON.parse(JSON.stringify(current)),previous=Object.prototype.hasOwnProperty.call(DEFAULT_PLAYER_SETTINGS,current.controllerType)?DEFAULT_PLAYER_SETTINGS[current.controllerType]:{};
  if(type!==current.controllerType || options.resetDefaults===true) for(const [key,value] of Object.entries(DEFAULT_PLAYER_SETTINGS[type])) {
    if(key==='controllerType'||key==='maxHealth')continue;
    if(options.resetDefaults===true || !Object.prototype.hasOwnProperty.call(current,key) || current[key]===previous[key])next[key]=value;
  }
  next.controllerType=type;
  if(options.resetView===true){next.initialYaw=0;next.initialPitch=type==='thirdperson'?0.28:0;if(type==='firstperson'){next.fovDegrees=70;next.eyeHeight=0.6;}}
  return {ok:true,settings:next};
}
function changePlayerControllerType(type) {
  if(playMode)return false;
  const result=buildPlayerControllerSettings(currentPlayerSettings,type);
  if(!result.ok||JSON.stringify(result.settings)===JSON.stringify(currentPlayerSettings))return false;
  pushUndo();currentPlayerSettings=result.settings;renderPlayerSettingsPanel();renderInputActionPanel();return true;
}
// Wave 6B (Priority A): a skinned Player Character visual -- deliberately
// NOT baked into DEFAULT_PLAYER_SETTINGS above (which would need adding to
// all 4 controller types, most irrelevant), read lazily via
// `settings.visual || defaultPlayerVisual()` everywhere it's needed instead,
// so an old saved level with no `.visual` field at all keeps behaving
// exactly like "Default / Primitive" -- the pre-Wave-6B body, visible,
// unchanged. `mode: 'primitive'` is that same default; `'skinned'` swaps in
// a real character model as a SEPARATE visual entity synced to the
// (still-authoritative-for-physics) controller body, never the skeleton
// itself as the collision shape.
function defaultPlayerVisual() {
  return {
    mode: 'primitive', assetId: null, scale: 1, rotationOffsetY: 0,
    positionOffset: { x: 0, y: -0.5, z: 0 },
    clipMap: { idle: null, walk: null, run: null, jump: null, fall: null, attack: null, death: null },
    blendTime: 0.15,
  };
}
// The active level's player config -- read by spawnPlayer() to pick a
// controller and by each controller's spawn/update to read its tunables.
let currentPlayerSettings = defaultPlayerSettings('hovercraft');
// Author-only draft; never survives a settings/document/session boundary.
let playerBuilderDraft = null;

// HUD/UI authoring: HUD elements, the optional Start Screen, and Win/Lose
// title/message overrides, all per-level (a boss level might want a
// different HUD than a puzzle level) -- same "apply whenever a level never
// customized this" pattern as environment/playerSettings above.
function defaultUiConfig() {
  // Wave 6 (Priority E): `howToPlay`/`credits` join the same startScreen
  // object (the Start Screen doubles as the Main Menu) -- both default to
  // '', which keeps their buttons hidden (see updateMainMenuExtras) and
  // keeps an untouched project's saved startScreen record shaped exactly
  // as it was before this priority existed once title/subtitle/buttonText
  // are also at their own defaults.
  // Public Showcase Recovery pass (Section 6B): `controlsHint` -- the
  // on-screen "WASD to move..." style reminder shown briefly at Play start
  // -- joins the same startScreen object for the same reason howToPlay/
  // credits do (one player-facing text bag, one blank-hides-it convention).
  // Previously this text was a single string hardcoded into editor/
  // index.html itself (literally the original Crate Run demo's own
  // hovercraft instructions), shown verbatim on every game using the
  // Hovercraft controller regardless of what that game actually was --
  // e.g. Survival Arena 2/3 (about surviving hunter waves) displayed
  // Crate Run's "Collect crates... Cyan pads give a speed boost" text.
  // Blank by default: an unauthored game now shows no hint at all, never a
  // wrong one.
  return { hudElements: [], startScreen: { enabled: false, title: '', subtitle: '', buttonText: 'Start', howToPlay: '', credits: '', controlsHint: '' }, winTitle: '', winMessage: '', loseTitle: '', loseMessage: '' };
}
let currentUiConfig = defaultUiConfig();
let hudAuthoringCanvas = null;
let hudBindingCatalog = [];
let nextHudElementId = 1;
// Screen pause ownership is transient, never part of authored level UI.
const gameplayScreenPauseOwners = new Set();
let gameplayScreenPauseWasAlreadyPaused = false;
let menuScreenStack = null;
let menuScreenPreview = false;
let menuScreenReturnFocus = null;
let dialoguePresentation = null;
let dialoguePresentationGeneration = 0;
const dialogueChoiceCallbacks = new Map();
function acquireGameplayScreenPause(owner) {
  if (!gameplayScreenPauseOwners.size) gameplayScreenPauseWasAlreadyPaused = app.paused;
  gameplayScreenPauseOwners.add(owner);
  if (!app.paused) app.pause();
  if (typeof syncPauseScreen === 'function') syncPauseScreen(app.paused);
}
function releaseGameplayScreenPause(owner) {
  if (!gameplayScreenPauseOwners.delete(owner)) return;
  if (!gameplayScreenPauseOwners.size && !gameplayScreenPauseWasAlreadyPaused && app.paused) app.resume();
  if (typeof syncPauseScreen === 'function') syncPauseScreen(app.paused);
}
function resetTransientScreens() {
  if(typeof closeLevelFlowEditor==='function')closeLevelFlowEditor();
  if(typeof cancelLevelTransition==='function')cancelLevelTransition();
  if(typeof closePlayerBuilder==='function')closePlayerBuilder();
  clearCameraShake();
  app.input?.resetDevice?.();
  touchLookPointerId = null;
  gamepadTuningRuntime = null;
  inputContextRuntime = null;
  if (typeof clearHudTweens === 'function') clearHudTweens();
  if (typeof clearDialoguePresentation === 'function') clearDialoguePresentation(true);
  menuScreenStack = null; menuScreenPreview = false; menuScreenReturnFocus = null;
  gameplayScreenPauseOwners.clear(); gameplayScreenPauseWasAlreadyPaused = false;
  playerRebindingAction = null;
  for (const id of ['controls-panel','howtoplay-overlay','credits-overlay','inventory-overlay','dialogue-overlay','menu-screen-overlay']) document.getElementById(id)?.classList.remove('visible');
}
function generateHudElementId() {
  const used = new Set((currentUiConfig.hudElements || []).map(el => el.id));
  for (const level of levels) for (const el of level.ui?.hudElements || []) used.add(el.id);
  let id; do { id = `hud${nextHudElementId++}`; } while (used.has(id));
  return id;
}
function copyUiConfig(input) {
  const copy = JSON.parse(JSON.stringify(input || {}));
  if(Array.isArray(copy.hudElements)){
    // Historical public HUD records predate authored IDs. Migrate only the
    // independent copy, deterministically, so reload/history never allocates
    // fresh identities or loses content. Reserve authored IDs before filling
    // holes; keep the first duplicate's existing reference identity intact.
    const valid=id=>typeof id==='string'&&id.trim().length>0||typeof id==='number'&&Number.isFinite(id);
    const reserved=new Set(copy.hudElements.filter(record=>record&&typeof record==='object'&&!Array.isArray(record)&&valid(record.id)).map(record=>String(record.id))),seen=new Set();
    copy.hudElements.forEach((record,index)=>{if(!record||typeof record!=='object'||Array.isArray(record))return;const key=valid(record.id)?String(record.id):null;if(key!==null&&!seen.has(key)){seen.add(key);return;}const base='hud-legacy-'+(index+1);let id=base,suffix=2;while(reserved.has(id)||seen.has(id))id=base+'-'+suffix++;record.id=id;reserved.add(id);seen.add(id);});
  }
  return Object.assign(defaultUiConfig(), copy, { hudElements: Array.isArray(copy.hudElements) ? copy.hudElements : [], startScreen: Object.assign(defaultUiConfig().startScreen, copy.startScreen) });
}
const authoredUiConfigs = new Map();
function captureAuthoredUiConfigs() {
  authoredUiConfigs.clear();
  for (const level of levels) authoredUiConfigs.set(level.id, copyUiConfig(level.ui));
  if (levels[currentLevelIndex]) authoredUiConfigs.set(levels[currentLevelIndex].id, copyUiConfig(currentUiConfig));
}
function restoreAuthoredUiConfigs() {
  for (const level of levels) if (authoredUiConfigs.has(level.id)) level.ui = copyUiConfig(authoredUiConfigs.get(level.id));
  if (authoredUiConfigs.has(levels[currentLevelIndex]?.id)) applyLevelUiConfig(currentLevelIndex);
  authoredUiConfigs.clear();
}

// Wave 6B (Priority E): Sequence authoring -- bounded, NOT a cinematic
// timeline. A Sequence is an ordered list of existing actions (reusing
// ACTION_TYPES/executeAction directly, no second per-action implementation)
// plus an optional Delay/Wait step between them, same "apply whenever a
// level never customized this" per-level pattern every other authoring
// surface here (Environment/Player/UI/Ambient Audio) already follows. A
// step is `{ kind: 'action', actionType, params }` or `{ kind: 'delay',
// seconds }` -- deliberately just these two shapes, no track/layer/keyframe
// concept.
let currentSequences = [];
let selectedSequenceId = null;
let nextSequenceId = 1;
function generateSequenceId() { const ids=new Set([...(Array.isArray(currentSequences)?currentSequences:[]),...levels.flatMap(level=>Array.isArray(level.sequences)?level.sequences:[])].map(record=>record?.id));let id;do{id=`sequence${nextSequenceId++}`;}while(ids.has(id));return id; }
function defaultSequence(name) { return { id: generateSequenceId(), name: name || `Sequence ${currentSequences.length + 1}`, steps: [] }; }
function findSequenceById(id) { const matches = id && Array.isArray(currentSequences) ? currentSequences.filter(s=>s&&s.id===id) : []; return matches.length===1?matches[0]:undefined; }
// Wave 7 (Priority F, Sections 42-46): a small structured Objective system
// on top of the pre-existing Objective Text/flags/counters/inventory -- NOT
// an RPG quest database. Definitions (`{id, title, description,
// nextObjective}`) are authored per-level data, same "global mirror synced
// into levels[currentLevelIndex] on every syncCurrentLevelObjects" pattern
// `currentSequences` immediately above already established. RUNTIME state
// (`window.__gameObjectives[id] = 'inactive'|'active'|'complete'|'failed'`)
// is separate, reset every fresh Play, and is what Priority E's Save Game
// actually persists.
let currentObjectiveDefs = [];
let nextObjectiveDefId = 1;
function generateObjectiveDefId() { const ids=new Set([...(Array.isArray(currentObjectiveDefs)?currentObjectiveDefs:[]),...levels.flatMap(level=>Array.isArray(level.objectiveDefs)?level.objectiveDefs:[])].map(record=>record?.id));let id;do{id=`objective${nextObjectiveDefId++}`;}while(ids.has(id));return id; }
function findObjectiveDefById(id) { return id ? currentObjectiveDefs.find((o) => o?.id === id) : undefined; }
// Wave 9C (Priority A): Scatter LAYERS -- persisted, level-scoped authoring
// definitions ({id, name, seed, sources:[{prefabName,weight}], scaleMin,
// scaleMax, randomYaw, minSpacing, maxSlope, brushRadius, density}) that
// CONFIGURE the existing weighted `performScatter`/`scatterPlaceOne`
// machinery (Wave 8) -- not a second Scatter implementation. Same mirror
// pattern `currentObjectiveDefs`/`currentSequences` already established:
// a global working copy, synced into `levels[currentLevelIndex]` by
// `syncCurrentLevelObjects` and read back by `applyLevelScatterLayers` on
// level switch. Level-scoped (Section 5) per the spec's own "a Forest
// Layer is normally level content."
let currentScatterLayers = [];
let selectedScatterLayerId = null;
let nextScatterLayerCounter = 1;
function generateScatterLayerId() { return `scatterlayer${nextScatterLayerCounter++}`; }
function findScatterLayerById(id) { return id ? currentScatterLayers.find((l) => l.id === id) : undefined; }
function defaultScatterLayer() {
  return {
    id: generateScatterLayerId(), name: 'New Layer', seed: Math.floor(Math.random() * 1e6),
    sources: [], scaleMin: 0.85, scaleMax: 1.2, randomYaw: true,
    minSpacing: 1.2, maxSlope: 35, brushRadius: 6, density: 0.6,
  };
}
// Wave 8 (Priority D, Sections 25-28): Item Definitions -- a bounded
// PROJECT-level registry (not per-level, unlike Objectives -- an item
// should mean the same thing on every level of one project), NOT a full
// RPG item database. `{id, name, description, iconTextureAssetId,
// stackable, maxStack, equipSlot, useAction}`. Runtime Inventory
// (`window.__gameInventory`) keeps using its EXISTING plain
// `{name: count}` shape and its existing free-typed-name actions
// unchanged (Section 27's own explicit backward-compatibility
// requirement) -- an Item Definition's own `id` is simply ONE valid
// string an author can give/remove/carry, exactly like any other
// inventory key, just one with real metadata (icon/stack limit/use
// action) attached for the Inventory UI and Use Item to read.
let currentItemDefs = [];
// Project authoring records and runtime draw progress deliberately independent.
// Retained nonarray JSON libraries stay unavailable, not silently erased.
let lootTables = [];
let inventoryTemplates = [];
function copyInventoryTemplateLibrary(value) { return value===undefined?[]:OpusInventoryTemplates.copy(value); }
let lootDrawCounters = Object.create(null);
let nextLootTableId = 1;
function copyLootLibrary(value) { return value===undefined?[]:OpusLootTables.copyData(value); }
// Loot chooses existing collectible Prefabs, not direct inventory grants.
function lootTableById(id) {
  if(typeof id!=='string'||!Array.isArray(lootTables))return null;
  const matches=lootTables.filter(table=>{if(!table||typeof table!=='object')return false;const field=Object.getOwnPropertyDescriptor(table,'id');return field&&Object.prototype.hasOwnProperty.call(field,'value')&&field.value===id;});
  return matches.length===1&&OpusLootTables.validate(matches[0]).valid?matches[0]:null;
}
function lootPickupPrefab(name, dependencies) {
  const fail=reason=>({ok:false,reason});
  // Runtime/editor callers omit dependencies and retain live-library behavior;
  // detached preflight supplies its exact portable dependency libraries.
  const prefabLibrary=dependencies===undefined?prefabs:dependencies?.prefabs;
  const itemDefinitions=dependencies===undefined?currentItemDefs:dependencies?.itemDefs;
  if(typeof name!=='string'||!Array.isArray(prefabLibrary))return fail('prefab');
  const matches=prefabLibrary.filter(prefab=>{if(!prefab||typeof prefab!=='object')return false;const field=Object.getOwnPropertyDescriptor(prefab,'name');return field&&Object.prototype.hasOwnProperty.call(field,'value')&&field.value===name;});
  if(matches.length!==1)return fail('prefab');
  const prefab=matches[0];
  try{OpusLootTables.copyPrefabData(prefab);}catch{return fail('prefab-data');}
  const assembly=prefab.records!==undefined;
  if(assembly&&(!Array.isArray(prefab.records)||!prefab.records.length))return fail('prefab-records');
  const records=assembly?prefab.records:prefab.record?[prefab.record]:[];
  try{validateImportedSceneRecords(records,'Loot Pickup Prefab',!assembly);}catch{return fail('prefab-records');}
  if(assembly&&(records.some(record=>!['cube','sprite','tilemap','camera','spawner','emitter','light','path'].includes(record.kind)||typeof record.id!=='string'||!record.id)||new Set(records.map(record=>record.id)).size!==records.length))return fail('prefab-records');
  const root=records.find(record=>record?.id===prefab.rootId)||records[0];
  if(!root||!['cube','sprite'].includes(root.kind)||(!prefab.records&&root.kind!=='cube'))return fail('prefab-root');
  const position=root.position||root.options?.position;
  if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return fail('prefab-position');
  const policy=root.components?.pickup,interaction=root.components?.interactable;
  if(!policy||policy.version!==1||policy.enabled!==true||policy.collectorRef||typeof policy.removeOnCollect!=='boolean'||!Number.isInteger(policy.quantity)||policy.quantity<1||policy.quantity>1000)return fail('pickup');
  const definitions=Array.isArray(itemDefinitions)?itemDefinitions.filter(def=>def?.id===policy.itemRef):[];
  if(typeof policy.itemRef!=='string'||['__proto__','constructor','prototype'].includes(policy.itemRef)||definitions.length!==1)return fail('item');
  const max=definitions[0].stackable===false?1:definitions[0].maxStack==null?99:definitions[0].maxStack;
  if(!Number.isSafeInteger(max)||max<policy.quantity)return fail('item-capacity');
  const collectors=(Array.isArray(root.behaviors)?root.behaviors:[]).filter(behavior=>behavior?.trigger==='interact'&&behavior.action==='collectPickup');
  if(!interaction||interaction.version!==1||interaction.enabled!==true||!Number.isFinite(interaction.range)||interaction.range<=0||collectors.length!==1||collectors[0].params?.targetId&&collectors[0].params.targetId!==root.id)return fail('collection-wiring');
  return {ok:true,prefab,root};
}
function inspectLootTable(table, dependencies) {
  const policy=OpusLootTables.validate(table);
  if(!policy.valid)return {ok:false,reason:'Invalid table '+policy.reason};
  for(const entry of table.entries)if(entry.kind==='prefab'){
    const state=lootPickupPrefab(entry.prefabName,dependencies);
    if(!state.ok)return {ok:false,reason:'Repair Pickup Prefab “'+entry.prefabName+'”: '+state.reason};
  }
  return {ok:true};
}
function dropLoot(p,item) {
  const fail=reason=>({dropped:false,reason});
  if(!playMode||gameEnded||app.paused||!item||!placed.includes(item)||!item.entity)return fail('inactive');
  const table=lootTableById(p?.tableId);if(!table)return fail('table');
  const available=inspectLootTable(table);if(!available.ok)return fail(available.reason);
  const offsets=['dx','dy','dz'].map(key=>p[key]===undefined?0:p[key]);
  const base=item.entity.position;
  if(!base||!offsets.every(Number.isFinite)||![base.x,base.y,base.z].every(Number.isFinite))return fail('position');
  const position=new Opus.Vec3(base.x+offsets[0],base.y+offsets[1],base.z+offsets[2]);
  if(![position.x,position.y,position.z].every(Number.isFinite))return fail('position');
  const draw=Object.prototype.hasOwnProperty.call(lootDrawCounters,table.id)?lootDrawCounters[table.id]:0;
  const selected=OpusLootTables.sample(table,draw);if(!selected.selected)return fail(selected.reason);
  if(selected.kind==='none'){lootDrawCounters[table.id]=draw+1;return {dropped:true,kind:'none',drawIndex:draw};}
  const result=spawnPrefabAssembly(lootPickupPrefab(selected.prefabName).prefab,position);
  if(!result?.rootItem)return fail('spawn');
  lootDrawCounters[table.id]=draw+1;
  return {dropped:true,kind:'prefab',prefabName:selected.prefabName,drawIndex:draw,rootId:result.rootItem.id};
}
let nextItemDefId = 1;
function generateItemDefId() {
  let n = nextItemDefId;
  while (Number.isSafeInteger(n) && n < Number.MAX_SAFE_INTEGER && currentItemDefs.some(def => def?.id === 'item'+n)) n++;
  if (!Number.isSafeInteger(n) || n < 1 || n >= Number.MAX_SAFE_INTEGER) return null;
  nextItemDefId = n + 1;
  return 'item'+n;
}
function restoreItemDefinitionAllocator(project) {
  let next = Number.isSafeInteger(project.nextItemDefId) && project.nextItemDefId > 0 ? project.nextItemDefId : 1;
  const reserve = id => { const match = /^item([1-9][0-9]*)$/.exec(typeof id === 'string' ? id : ''); if (match && Number.isSafeInteger(Number(match[1]))) next = Math.max(next, Number(match[1]) + 1); };
  for (const definition of project.itemDefs || []) reserve(definition?.id);
  const reserveObject = object => reserve(object?.components?.pickup?.itemRef);
  for (const level of project.levels || []) {
    for (const object of level?.objects || []) reserveObject(object);
    for (const equipment of level?.playerSettings?.equipmentDefs || []) reserve(equipment?.itemName);
  }
  for (const prefab of project.prefabs || []) { reserveObject(prefab?.record); for (const object of prefab?.records || []) reserveObject(object); }
  // Historical projects have no allocator field. Reserve retained typed callers
  // as well as live definitions so deleted Item references cannot be rebound.
  for (const use of collectEditorReferenceUses(project)) if (use.referenceType === 'item') reserve(use.referenceValue);
  nextItemDefId = next;
}
function findItemDefById(id) { return id ? currentItemDefs.find((d) => d?.id === id) : undefined; }

// Named patterns share the existing inventory, with explicit strict quantities.
// Historical free-name Give/Remove/Has Item keep their original semantics.
function namedInventoryItemSelection(itemId, quantity = 1) {
  if(typeof itemId!=='string'||!itemId||['__proto__','constructor','prototype'].includes(itemId))return null;
  if(!Number.isSafeInteger(quantity)||quantity<1)return null;
  const matches=currentItemDefs.filter(d=>d?.id===itemId),current=window.__gameInventory?.[itemId]??0;
  if(matches.length!==1||!Number.isSafeInteger(current)||current<quantity)return null;
  return {itemId,quantity,current};
}
// Preflight only authored direct Use Item links. No effects or counts are
// touched while checking; valid nested uses retain their historical ordering.
function itemUseActionHasCycle(itemId) {
  const seen = new Set();
  let id = itemId;
  while (id) {
    if (seen.has(id)) return true;
    seen.add(id);
    const definition = findItemDefById(id);
    if (definition?.useAction?.action !== 'useItem') return false;
    id = definition.useAction.params?.itemId;
  }
  return false;
}
let collectedPickupObjects = new WeakSet();
function activateCheckpointComponent(item) {
  const c = item?.components?.checkpoint;
  const fail = reason => ({ activated: false, reason });
  if (!playMode || gameEnded || app.paused || !player || !item || !placed.includes(item) || !['cube','sprite'].includes(item.kind) || !item.entity?.visible || item.entity.spriteRenderer?.visible === false) return fail('inactive');
  if (!c || c.version !== 1 || c.enabled !== true || !Array.isArray(c.offset) || c.offset.length !== 3 || !c.offset.every(Number.isFinite)) return fail('policy');
  if (c.autosave !== undefined && typeof c.autosave !== 'boolean') return fail('policy');
  const event = window.__currentTrigger2DEvent;
  if (c.activatorRef) {
    const actor = findItemById(c.activatorRef);
    if (!actor || actor === item || !placed.includes(actor) || !actor.entity || (event && event.targetObjectId !== actor.id)) return fail('actor');
  } else if (event) return fail('actor');
  const marker = c.respawnPointRef ? findItemById(c.respawnPointRef) : item;
  const position = marker?.entity?.position;
  if (!marker || !placed.includes(marker) || !position || ![position.x,position.y,position.z].every(Number.isFinite)) return fail('marker');
  const location = position.clone().add(new Opus.Vec3(...c.offset));
  if (![location.x,location.y,location.z].every(Number.isFinite)) return fail('position');
  ACTION_TYPES.setCheckpoint.exec({}, { entity: { position: location } });
  if (c.autosave === true) return { activated: true, position: [location.x,location.y,location.z], autosaved: ACTION_TYPES.autosave.exec() === true };
  return { activated: true, position: [location.x,location.y,location.z] };
}
// Explicit opt-in Item rules. Historical free-name Give/Remove stay unchanged.
function grantInventoryItem(itemId, quantity, item) {
  const fail = reason => ({ granted: false, reason });
  if (typeof itemId !== 'string' || !itemId || ['__proto__', 'constructor', 'prototype'].includes(itemId)) return fail('item');
  const definitions = currentItemDefs.filter(def => def?.id === itemId);
  if (definitions.length !== 1) return fail('item');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) return fail('quantity');
  const definition = definitions[0];
  const max = definition.stackable === false ? 1 : definition.maxStack == null ? 99 : definition.maxStack;
  const current = window.__gameInventory?.[itemId] ?? 0;
  if (!Number.isSafeInteger(max) || max < 1 || !Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(current + quantity) || current + quantity > max) return fail('capacity');
  ACTION_TYPES.giveItem.exec({ name: itemId, count: quantity }, item);
  return { granted: true, itemId, quantity };
}

// Opt-in synchronous purchase: ordinary named Items remain the only balances.
// Historical sequential Graph Give/Remove is deliberately not transactional.
function purchaseInventoryItem(params, item) {
  const fail = reason => ({ purchased: false, reason });
  if (!playMode || gameEnded || app.paused) return fail('inactive');
  const quantity = value => typeof value === 'number' || typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  const price = quantity(params.price), count = quantity(params.count);
  if (!Number.isSafeInteger(price) || price < 1 || price > 1000 || !Number.isSafeInteger(count) || count < 1 || count > 1000) return fail('quantity');
  if (params.currencyItemId === params.itemId) return fail('same-item');
  const funds = namedInventoryItemSelection(params.currencyItemId, price);
  if (!funds) return fail('funds');
  // Canonical grant preflights the whole reward before its single synchronous
  // inventory write. It has no user callback; debit follows only actual grant.
  const grant = grantInventoryItem(params.itemId, count, item);
  if (!grant.granted) return fail(grant.reason);
  window.__gameInventory[funds.itemId] = funds.current - funds.quantity;
  return { purchased: true, itemId: grant.itemId, quantity: grant.quantity, currencyItemId: funds.itemId, price };
}

function collectPickup(item) {
  const policy = item?.components?.pickup;
  const fail = reason => ({ collected: false, reason });
  if (!playMode || gameEnded || app.paused || !item || !placed.includes(item) || !['cube', 'sprite'].includes(item.kind) || !item.entity?.visible || item.entity.spriteRenderer?.visible === false || collectedPickupObjects.has(item)) return fail('inactive');
  if (!policy || policy.version !== 1 || policy.enabled !== true || !Number.isInteger(policy.quantity) || policy.quantity < 1 || policy.quantity > 1000) return fail('invalid-policy');
  const event = window.__currentTrigger2DEvent;
  if (policy.collectorRef) {
    const collector = findItemById(policy.collectorRef);
    if (!collector || collector === item || !placed.includes(collector) || !collector.entity || (event && event.targetObjectId !== collector.id)) return fail('collector');
  } else if (!player || event) return fail('player'); // Trigger2D requires explicit authored actor identity.
  const grant = grantInventoryItem(policy.itemRef, policy.quantity, item);
  if (!grant.granted) return fail(grant.reason);
  if (policy.removeOnCollect === true) removeAssembly(item, true);
  else collectedPickupObjects.add(item);
  return { collected: true, itemId: grant.itemId, quantity: grant.quantity };
}

// Guards the narrow window inside loadProjectFull between `levels` being
// assigned the freshly-normalized (correct) incoming data and
// loadProjectData() actually populating `placed` to match it. During that
// window `placed` still reflects whichever OLD scene was live before this
// load started -- calling syncCurrentLevelObjects() in there (e.g. from an
// asset-library render triggered by loadAssets/loadTextureAssets/
// loadAudioAssets computing a usage count) would overwrite the just-loaded
// level's real objects with a serialization of that stale scene. See
// API-FRICTION.md finding #57.
let loadingProjectGuard = false;
function syncCurrentLevelObjects() {
  if (loadingProjectGuard) return;
  // Keep the live level view for Restart; project outputs read a separate
  // session authoring view rather than replacing runtime records in-place.
  levels[currentLevelIndex].objects = serializeScene(playMode || arguments[0] === true);
  // Wave 6 (Priority H): app.getEnvironment().skyTexture is a LIVE GPU
  // texture handle (a WebGLTexture), never JSON-serializable -- the same
  // "handle vs persisted reference" split every other texture-bearing field
  // in this editor already follows (entity.texture is live; item.textureAssetId
  // is what's actually saved). Strip the raw handle and persist the asset id
  // instead (currentSkyTextureAssetId, kept in sync by the Sky Panorama
  // dropdown below); applyLevelEnvironment is the one place that resolves
  // it back into a live handle on the way back in.
  const env = app.getEnvironment();
  delete env.skyTexture;
  env.skyTextureAssetId = currentSkyTextureAssetId || undefined;
  levels[currentLevelIndex].environment = env;
  levels[currentLevelIndex].playerSettings = currentPlayerSettings;
  const authoredUi = playMode && arguments[0] !== true && authoredUiConfigs.get(levels[currentLevelIndex].id);
  levels[currentLevelIndex].ui = copyUiConfig(authoredUi || currentUiConfig);
  levels[currentLevelIndex].ambientAudio = currentAmbientAudioConfig;
  levels[currentLevelIndex].sequences = currentSequences;
  levels[currentLevelIndex].objectiveDefs = currentObjectiveDefs;
  levels[currentLevelIndex].scatterLayers = currentScatterLayers;
}
let nextItemId = 1;
function generateItemId() { return `obj${nextItemId++}`; }
// Same fix shape as reconcileGraphNodeIdCounter (AUDIT.md finding #3):
// nextItemId resets to 1 on every fresh page load, so loading a project
// whose items already have higher-numbered ids must bump the counter past
// them before any NEW item is created, or a fresh id could collide with
// one already in the loaded scene.
function reconcileItemIdCounter(id) {
  const match = /^obj(\d+)$/.exec(id);
  if (match) nextItemId = Math.max(nextItemId, Number(match[1]) + 1);
}
// The single choke point every placed item is added through -- assigns an
// id if the item doesn't already have one (a fresh item) and leaves an
// existing id alone (loaded from a saved record), so every future
// placed.push call site gets id assignment for free instead of needing to
// remember it individually.
function addPlaced(item) {
  if (!item.id) item.id = generateItemId();
  reconcileItemIdCounter(item.id);
  if (item.groupId) reconcileGroupIdCounter(item.groupId);
  placed.push(item);
  if (item.components && item.components['trigger-collider-2d']) trigger2DObjects.add(item);
  if (item.components && item.components['body-2d']) body2DObjects.add(item);
  if (item.entity) item.entity.renderStableId = item.id;
  syncSpriteSortingForItem(item);
  if (item.kind === 'tilemap') syncTilemapRenderer(item);
  return item;
}
// Group ids get their own counter/reconcile pair rather than reusing
// generateItemId's -- a loaded project's group ids ('group3', say) don't
// bump nextItemId at all (reconcileItemIdCounter only recognizes 'objN'),
// so a same-session-created group could otherwise land on a number a
// loaded project already used, silently merging two unrelated groups.
let nextGroupId = 1;
function generateGroupId() { return `group${nextGroupId++}`; }
function reconcileGroupIdCounter(id) {
  const match = /^group(\d+)$/.exec(id);
  if (match) nextGroupId = Math.max(nextGroupId, Number(match[1]) + 1);
}
function findItemById(id) {
  return id ? placed.find((p) => p.id === id) : undefined;
}

