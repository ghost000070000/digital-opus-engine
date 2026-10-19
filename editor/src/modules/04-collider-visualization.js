// --- Collider visualization (Wave 6, Priority A/Section 10) -------------
// "Show Colliders" -- an editor-only toggle, off by default, that draws a
// translucent marker over every Solid/Trigger's REAL collision bounds
// (Box or Sphere, offset-adjusted, oriented) so an author can see exactly
// what will physically block/trigger, independent of what the rendered
// mesh looks like. Never serialized, never visible during Play (same
// "editor furniture" convention every other gizmo/marker here already
// follows). One marker entity per item, reused across syncs rather than
// destroyed/recreated -- the same pooling pattern selection markers and
// the rotate gizmo's rings already established.
let showColliders = false;
const colliderVizHandles = new Map(); // primary ID / secondary dual-role owner -> marker entity
const combatVizHandles = new Map(); // selected Object only, bounded editor furniture
let colliderSphereVizMesh = null;
function getColliderSphereVizMesh() {
  if (colliderSphereVizMesh) return colliderSphereVizMesh;
  const positions=[],normals=[],indices=[],latitudes=12,longitudes=24;
  for(let latitude=0;latitude<=latitudes;latitude++)for(let longitude=0;longitude<=longitudes;longitude++){
    const theta=latitude*Math.PI/latitudes,phi=longitude*Math.PI*2/longitudes;
    const x=Math.sin(theta)*Math.cos(phi),y=Math.cos(theta),z=Math.sin(theta)*Math.sin(phi);
    positions.push(x*.5,y*.5,z*.5);normals.push(x,y,z);
  }
  for(let latitude=0;latitude<latitudes;latitude++)for(let longitude=0;longitude<longitudes;longitude++){
    const a=latitude*(longitudes+1)+longitude,b=a+longitudes+1;
    indices.push(a,a+1,b,b,a+1,b+1);
  }
  colliderSphereVizMesh=Opus.Mesh.fromArrays(new Float32Array(positions),new Float32Array(normals),new Uint16Array(indices));
  return colliderSphereVizMesh;
}
function syncCombatVolumeViz() {
  const wanted=new Set();
  if(showColliders&&!playMode&&selectedItem?.entity&&selectedItem.entity.visible!==false){
    for(const id of ['hurtbox','hitbox']){
      const sphere=OpusCombatVolumes.worldSphere(selectedItem.components?.[id],selectedItem.entity.position);
      if(!sphere)continue;
      const c=new Opus.Vec3(sphere.center.x,sphere.center.y,sphere.center.z),r=sphere.radius,color=id==='hurtbox'?[.2,.8,1]:[1,.5,.15];
      for(let plane=0;plane<3;plane++)for(let segment=0;segment<24;segment++){
        const point=i=>{const a=i*Math.PI*2/24,x=r*Math.cos(a),y=r*Math.sin(a);return c.add(plane===0?new Opus.Vec3(x,y,0):plane===1?new Opus.Vec3(x,0,y):new Opus.Vec3(0,x,y));};
        const a=point(segment),b=point(segment+1),delta=b.sub(a),mid=a.add(b).scale(.5),len=delta.length(),key=id+':'+plane+':'+segment;
        wanted.add(key);let marker=combatVizHandles.get(key);
        if(!marker){marker=app.addEntity({mesh:cubeMesh,color,unlit:true,position:mid,scale:new Opus.Vec3(.012,.012,len)});combatVizHandles.set(key,marker);}
        else{marker.position.set(mid.x,mid.y,mid.z);marker.scale.set(.012,.012,len);}
        marker.unlit=true;
        marker.quaternion=Opus.Quat.fromEuler(Math.atan2(-delta.y,Math.hypot(delta.x,delta.z)),Math.atan2(delta.x,delta.z),0);
      }
    }
  }
  for(const [key,marker] of combatVizHandles)if(!wanted.has(key)){app.scene.remove(marker);combatVizHandles.delete(key);}
}
function syncColliderViz() {
  const legend = document.getElementById('collider-viz-legend');
  if (legend) legend.hidden = !showColliders || playMode;
  syncCombatVolumeViz();
  if (!showColliders || playMode) {
    for (const entity of colliderVizHandles.values()) app.scene.remove(entity);
    colliderVizHandles.clear();
    return;
  }
  const wanted = new Set();
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.visible) continue;
    const isSolidCollider = !!item.entity.solid;
    const isTriggerVolume = !!item.isTrigger;
    if (!isSolidCollider && !isTriggerVolume) continue;
    // Both roles can coexist with different geometry. Keep the historical
    // primary ID key; the secondary solid uses its actual owner as a key,
    // avoiding collisions with user-authored string IDs.
    for (const role of [isTriggerVolume && 'trigger', isSolidCollider && 'solid'].filter(Boolean)) {
    const key = role === 'solid' && isTriggerVolume ? item : item.id;
    wanted.add(key);
    let center; let half; let quat; let color; let sphere = false;
    if (role === 'trigger') {
      color = [0.85, 0.35, 0.95];
      if (item.triggerShape === 'sphere') {
        sphere = true;
        const r = 1.5 * Math.max(item.entity.scale.x, item.entity.scale.z);
        center = item.entity.position; half = new Opus.Vec3(r, r, r); quat = null;
      } else {
        center = item.entity.position; half = item.entity.scale.scale(0.5); quat = item.entity.quaternion;
      }
    } else {
      color = [0.3, 1, 0.5];
      const cfg = itemColliderConfig(item);
      center = item.entity.position.add(cfg.offset);
      if (cfg.shape === 'sphere') { sphere = true; half = new Opus.Vec3(cfg.radius, cfg.radius, cfg.radius); quat = null; }
      else { half = cfg.half; quat = item.entity.quaternion; }
    }
    let marker = colliderVizHandles.get(key);
    const mesh = sphere ? getColliderSphereVizMesh() : cubeMesh;
    if (!marker) {
      marker = app.addEntity({ mesh, color, position: center, scale: half.scale(2), unlit: true, alpha: 0.22 });
      colliderVizHandles.set(key, marker);
    } else {
      marker.position.set(center.x, center.y, center.z);
      marker.scale.set(half.x * 2, half.y * 2, half.z * 2);
      marker.color = color;
      marker.mesh = mesh;
    }
    // Entity material fields are mutable properties, not constructor options.
    marker.alpha = 0.22;
    marker.unlit = true;
    marker.quaternion = quat || Opus.Quat.identity();
    }
  }
  for (const [id, entity] of colliderVizHandles) {
    if (!wanted.has(id)) { app.scene.remove(entity); colliderVizHandles.delete(id); }
  }
}
// The synchronizer itself retires editor-only markers during Play. Skipping
// it in Play leaves stale scene furniture and prevents clean Stop recovery.
app.onUpdate(() => { syncColliderViz(); });

// Wave 6 (Priority I): given a desired WORLD-space forward direction,
// returns the quaternion that points an entity's local +Z at it -- the
// exact inverse of the forward-vector formula the First-Person controller's
// own look code already established (yawForward = (sin(yaw), 0, cos(yaw))
// at pitch 0; see applyFirstPersonLook), derived algebraically from that
// same fromEuler(pitch, yaw, 0) composition rather than a new look-rotation-
// from-vectors algorithm. Reused for every Billboard, not a second facing
// formula.
function quatFacingDirection(dir) {
  const d = dir.normalize();
  const yaw = Math.atan2(d.x, d.z);
  const pitch = -Math.asin(Math.max(-1, Math.min(1, d.y)));
  return Opus.Quat.fromEuler(pitch, yaw, 0);
}
// Reorients every placed Billboard to face the camera, every frame, in
// BOTH edit and Play (unconditional -- unlike collider visualization, a
// Billboard's facing IS part of what it looks like, not an editor-only
// aid, so WYSIWYG requires this to run continuously in the editor preview
// too). 'cylindrical' zeroes the direction's Y component first, keeping
// the billboard upright (grass/trees/signs) instead of tilting to stare
// straight up/down when the camera is far overhead/underneath.
function syncBillboards() {
  const eye = app.camera.eye;
  for (const item of placed) {
    if (!item.isBillboard || !item.entity.visible) continue;
    let dir = eye.sub(item.entity.position);
    if (item.billboardMode === 'cylindrical') dir = new Opus.Vec3(dir.x, 0, dir.z);
    if (dir.length() < 1e-6) continue; // camera exactly at the billboard's own position -- no well-defined facing, skip this frame
    item.entity.quaternion = quatFacingDirection(dir);
  }
}
const selectionMarkers = new Map(); // item -> its own marker entity

function itemPosition(item) {
  // Wave 8 (Priority I): a Path has neither `.entity` nor `.handle` -- its
  // own "position" (for selection markers/gizmo purposes only; a Path
  // itself is never moved as a unit, only its individual point markers
  // are) is its first point's real position, falling back to the origin
  // for a genuinely empty path (shouldn't normally happen -- placeItem
  // always creates one point immediately -- but never throws either way).
  if (item.kind === 'path') { const first = (item.pointIds || []).map(findItemById).find(Boolean); return first ? first.entity.position : new Opus.Vec3(); }
  return item.entity ? item.entity.position : item.handle.position;
}

function itemLabel(item, index) {
  if (item.kind === 'path') return `Path #${index + 1}`; // Wave 8 (Priority I) -- checked before the `item.entity.ai` fallback below, which assumes every OTHER kind has an `.entity`
  if (item.kind === 'sprite') return `Sprite #${index + 1}`;
  if (item.kind === 'tilemap') return `${item.name || 'Tilemap'} #${index + 1}`;
  if (item.isBillboard) return `Billboard #${index + 1}`;
  if (item.kind === 'terrain') return `Terrain #${index + 1}`;
  if (item.kind === 'water') return `Water #${index + 1}`;
  if (item.kind === 'emitter') return `Particle Emitter #${index + 1}`;
  if (item.kind === 'camera') return `Camera #${index + 1}`;
  if (item.kind === 'spawner') return `Spawner #${index + 1}`;
  if (item.kind === 'light') return item.options.lightType === 'spot' ? `Spot Light #${index + 1}` : `Point Light #${index + 1}`;
  if (item.isTrigger) return `Trigger Volume #${index + 1}`;
  if (item.isWaypoint) return `Waypoint #${index + 1}`;
  if (item.isPathPoint) return `Path Point #${index + 1}`;
  if (item.isSpawnPoint) return item.isDefaultSpawn ? `Spawn Point (Default) #${index + 1}` : `Spawn Point #${index + 1}`;
  if (item.entity.ai) return `Enemy #${index + 1}`;
  // Cubes all look the same in this list otherwise, even though a scene can
  // now mix crates/hazards/boost pads/plain cubes — name by role, not shape.
  const behaviors = item.behaviors || [];
  if (behaviors.some((b) => b.action === 'boost')) return `Boost Pad #${index + 1}`;
  if (behaviors.some((b) => b.action === 'lose')) return item.entity.patrol ? `Patrol Hazard #${index + 1}` : `Hazard #${index + 1}`;
  if (behaviors.some((b) => b.action === 'win')) return `Win Trigger #${index + 1}`;
  if (behaviors.some((b) => b.action === 'script')) return `Crate #${index + 1}`;
  if (behaviors.some((b) => b.action === 'graph')) return `Bonus Crate #${index + 1}`;
  if (![cubeMesh, mineMesh, boostMesh].includes(item.entity.mesh)) return `Model #${index + 1}`;
  return `Cube #${index + 1}`;
}

function screenToGroundPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const ray = app.camera.screenPointToRay(ndcX, ndcY, canvas.width / Math.max(canvas.height, 1));
  if (Math.abs(ray.direction.y) < 1e-6) return null;
  const t = -ray.origin.y / ray.direction.y;
  if (t < 0) return null;
  return ray.origin.add(ray.direction.scale(t));
}

// General ray/plane intersection (Wave 5) -- screenToGroundPoint above is
// the special case `planeOrigin=(0,0,0), planeNormal=(0,1,0)`, which is all
// the Y-only rotate gizmo ever needed. Full XYZ rotation needs the SAME
// operation against an arbitrary plane (the one perpendicular to whichever
// axis ring is being dragged), so this generalizes it rather than adding a
// second ray-casting implementation next to it.
function screenToPlanePoint(clientX, clientY, planeOrigin, planeNormal) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const ray = app.camera.screenPointToRay(ndcX, ndcY, canvas.width / Math.max(canvas.height, 1));
  const denom = ray.direction.dot(planeNormal);
  if (Math.abs(denom) < 1e-6) return null;
  const t = planeOrigin.sub(ray.origin).dot(planeNormal) / denom;
  if (t < 0) return null;
  return ray.origin.add(ray.direction.scale(t));
}

// The inverse of screenPointToRay -- the engine only ever needed
// screen-to-world (for placement/picking), so world-to-screen doesn't exist
// in the public API. Built entirely from what Camera already exposes
// publicly (eye, getBasis(), projection settings), not a matrix the engine
// hides. This is the inverse of both Camera.screenPointToRay branches and
// returns null for a point behind the camera.
function worldToScreen(worldPos) {
  const cam = app.camera;
  const { forward, right, up } = cam.getBasis();
  const v = worldPos.sub(cam.eye);
  const viewZ = v.dot(forward);
  if (viewZ <= 0.01) return null;
  const aspect = canvas.width / Math.max(canvas.height, 1);
  let ndcX; let ndcY;
  if (cam.projection === 'orthographic') {
    const height = Number.isFinite(cam.orthographicHeight) && cam.orthographicHeight > 0 ? cam.orthographicHeight : 10;
    ndcX = v.dot(right) / ((height / 2) * aspect);
    ndcY = v.dot(up) / (height / 2);
  } else {
    const tanHalfFov = Math.tan(cam.fovY / 2);
    ndcX = v.dot(right) / (viewZ * tanHalfFov * aspect);
    ndcY = v.dot(up) / (viewZ * tanHalfFov);
  }
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((ndcX + 1) / 2) * rect.width + rect.left,
    y: ((1 - ndcY) / 2) * rect.height + rect.top,
  };
}

// Phase123 selected-only, non-pickable editor furniture. No saved/runtime state.
let showAiPerception = false;
function clipAiPerceptionPolygon(points) {
  const camera=app.camera,forward=camera.getBasis().forward;
  const depth=point=>point.sub(camera.eye).dot(forward)-0.011;
  const clipped=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=depth(a),db=depth(b);
    if(da>=0)clipped.push(a);
    if((da>=0)!==(db>=0))clipped.push(a.add(b.sub(a).scale(da/(da-db))));
  }
  return clipped;
}
function syncAiPerceptionOverlay() {
  let overlay=document.getElementById('ai-perception-overlay');
  const item=selectedItem;
  const attached=item&&Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain');
  const captured=item?.entity?.ai&&OpusAiBrain.captureLegacy(item.entity.ai);
  const allowed=showAiPerception&&!playMode&&selectedItems.size===1&&item?.kind==='cube'&&item.entity.visible!==false&&captured?.ok&&(!attached||(OpusAiBrain.inspect(item.components['ai-brain']).ok&&item.components['ai-brain'].enabled));
  if(!allowed){if(overlay){overlay.replaceChildren();overlay.style.display='none';}return;}
  const ns='http://www.w3.org/2000/svg';
  if(!overlay){overlay=document.createElementNS(ns,'svg');overlay.id='ai-perception-overlay';overlay.setAttribute('aria-label','Selected AI perception preview');overlay.style.cssText='position:absolute;pointer-events:none;overflow:hidden;z-index:5';canvas.parentElement.appendChild(overlay);}
  const rect=canvas.getBoundingClientRect(),parentRect=canvas.parentElement.getBoundingClientRect();
  overlay.style.left=`${rect.left-parentRect.left}px`;overlay.style.top=`${rect.top-parentRect.top}px`;overlay.style.width=`${rect.width}px`;overlay.style.height=`${rect.height}px`;overlay.style.display='block';
  overlay.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);overlay.replaceChildren();
  const p=captured.record.config.perception||{},vision=p.visionDistance??15,fov=p.fovDegrees??100,hearing=p.hearingRadius??0;
  const origin=item.entity.position,forward=item.entity.forward;
  const heading=Math.atan2(forward.x,forward.z),flatLength=Math.hypot(forward.x,forward.z);
  const screen=point=>{const v=worldToScreen(point);return v?{x:v.x-rect.left,y:v.y-rect.top}:null;};
  const polygon=(name,worldPoints,color,fill)=>{const points=clipAiPerceptionPolygon(worldPoints).map(screen);if(points.length<3||points.some(v=>!v))return;const shape=document.createElementNS(ns,'polygon');shape.setAttribute('data-ai-perception-shape',name);shape.setAttribute('points',points.map(v=>`${v.x},${v.y}`).join(' '));shape.setAttribute('stroke',color);shape.setAttribute('stroke-width','2');shape.setAttribute('fill',fill);overlay.appendChild(shape);};
  const arc=flatLength<1e-6?Math.PI*2:fov*Math.PI/180;
  const points=Array.from({length:65},(_,i)=>{const a=heading-arc/2+i/64*arc;return origin.add(new Opus.Vec3(Math.sin(a)*vision,0,Math.cos(a)*vision));});
  polygon('vision',arc<Math.PI*2?[origin,...points]:points,'#57dfed','rgba(87,223,237,0.09)');
  if(hearing>0)polygon('hearing',Array.from({length:64},(_,i)=>{const a=i/64*Math.PI*2;return origin.add(new Opus.Vec3(Math.sin(a)*hearing,0,Math.cos(a)*hearing));}),'#ffcd69','none');
  const legacy=!['topdown2d','platformer2d'].includes(currentPlayerSettings.controllerType);
  overlay.setAttribute('data-los-result','not-previewed');
  if(legacy){const target=computeSpawnPoint(),a=screen(origin),b=screen(target);if(a&&b){const clear=hasLineOfSightToPosition(origin,target,item);const line=document.createElementNS(ns,'line');line.setAttribute('data-ai-perception-shape','los');for(const [k,v]of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:clear?'#91e5ac':'#ff8b8b','stroke-width':2,'stroke-dasharray':'5 4'}))line.setAttribute(k,String(v));overlay.appendChild(line);overlay.setAttribute('data-los-result',clear?'clear':'blocked');}}
  const label=document.createElementNS(ns,'text');label.setAttribute('x','12');label.setAttribute('y','22');label.setAttribute('fill','#e7efff');label.setAttribute('font-size','12');label.textContent=`AI preview · Vision ${vision} / FOV ${fov}° · Hearing ${hearing} (3D) · ${legacy?'spawn LOS':'no legacy spawn LOS'}`;overlay.appendChild(label);
}

// Phase 015 Sprite authoring overlay. The frame is projected from the same
// pivot-aware local rectangle used by rendering and picking. Width/Height and
// Pivot remain owned solely by the Sprite Renderer component; this DOM is
// transient editor furniture and is never part of project serialization.
const spriteDirectOverlay = document.getElementById('sprite-direct-overlay');
const spriteDirectPolygon = document.querySelector('#sprite-direct-frame polygon');
const spriteDirectSize = document.getElementById('sprite-direct-size');
const spritePivotHandle = document.getElementById('sprite-pivot-handle');
const spriteResizeHandles = [...document.querySelectorAll('[data-sprite-resize]')];
let spriteAspectLock = false;
let spriteDirectDragState = null;

// Phase 041/042 Collider 2D authoring furniture. Project truth stays in the
// independent Box, Circle, and Trigger component records; this selected-only
// overlay is never serialized and is absent in Play or Playable-only mode.
const collider2DOverlay = document.getElementById('collider-2d-overlay');
const collider2DFrame = document.getElementById('collider-2d-frame');
const collider2DHandles = document.getElementById('collider-2d-handles');
let activeCollider2DComponentId = 'box-collider-2d';
let collider2DDragState = null;

function selectedCollider2DItem() {
  if (playMode || selectedItems.size !== 1 || !selectedItem || !selectedItem.entity || !['cube', 'sprite'].includes(selectedItem.kind)) return null;
  const bag = selectedItem.components || {};
  return bag['box-collider-2d'] || bag['circle-collider-2d'] || bag['trigger-collider-2d'] ? selectedItem : null;
}

function colliderLocalWorldPoint(item, x, y) {
  return item.entity.position.add(item.entity.right.scale(x * item.entity.scale.x)).add(item.entity.up.scale(y * item.entity.scale.y));
}

function colliderScreenPoint(item, x, y) {
  const point = worldToScreen(colliderLocalWorldPoint(item, x, y));
  if (!point) return null;
  const rect = canvas.getBoundingClientRect();
  return { x: point.x - rect.left, y: point.y - rect.top };
}

function colliderHandle(button, componentId, handle, point, label) {
  if (!point) return;
  button.className = `collider-2d-handle${componentId === 'trigger-collider-2d' ? ' trigger' : ''}`;
  button.dataset.colliderComponent = componentId;
  button.dataset.colliderHandle = handle;
  button.setAttribute('aria-label', label);
  button.style.left = `${point.x}px`; button.style.top = `${point.y}px`;
  collider2DHandles.appendChild(button);
}

function syncCollider2DOverlay() {
  const item = selectedCollider2DItem();
  collider2DFrame.replaceChildren(); collider2DHandles.replaceChildren();
  if (!item || !globalThis.OpusCollider2D) { collider2DOverlay.classList.remove('active'); return; }
  const bag = item.components || {}; let shown = 0;
  const svgNS = 'http://www.w3.org/2000/svg';
  for (const componentId of ['box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d']) {
    const component = bag[componentId]; if (!component) continue;
    const isTrigger = componentId === 'trigger-collider-2d';
    const shapeKind = isTrigger ? component.shape : componentId === 'box-collider-2d' ? 'box' : 'circle';
    const shape = OpusCollider2D.resolveCollider2DWorldShape(item, { ...component, enabled: true }, shapeKind);
    if (!shape) continue; shown++;
    const active = componentId === activeCollider2DComponentId;
    let anchor = null;
    if (shapeKind === 'box') {
      const [ox, oy] = component.offset, [width, height] = component.size;
      const local = [[ox-width/2,oy-height/2],[ox+width/2,oy-height/2],[ox+width/2,oy+height/2],[ox-width/2,oy+height/2]];
      const screen = local.map((point) => colliderScreenPoint(item, point[0], point[1])); if (screen.some((point) => !point)) continue;
      const polygon = document.createElementNS(svgNS, 'polygon'); polygon.setAttribute('points', screen.map((point) => `${point.x},${point.y}`).join(' ')); polygon.setAttribute('class', `collider-shape${isTrigger ? ' trigger' : ''}${component.enabled === false ? ' disabled' : ''}`); collider2DFrame.appendChild(polygon);
      if (componentId === 'box-collider-2d' && bag['one-way-platform-2d']?.enabled && bag['body-2d']?.enabled && bag['body-2d']?.type === 'static') {
        const top = OpusOneWay2D.horizontalTop(shape);
        const slopeTop = !top && OpusCharacterSlope2D.surfaceFromShape(shape, item.id, true);
        if (top || slopeTop) {
          const a = worldToScreen(new Opus.Vec3(top ? top.minX : slopeTop.p0.x, top ? top.y : slopeTop.p0.y, item.entity.position.z));
          const b = worldToScreen(new Opus.Vec3(top ? top.maxX : slopeTop.p1.x, top ? top.y : slopeTop.p1.y, item.entity.position.z));
          if (a && b) {
            const edge = document.createElementNS(svgNS, 'line'); edge.setAttribute('x1', String(a.x - canvas.getBoundingClientRect().left)); edge.setAttribute('y1', String(a.y - canvas.getBoundingClientRect().top)); edge.setAttribute('x2', String(b.x - canvas.getBoundingClientRect().left)); edge.setAttribute('y2', String(b.y - canvas.getBoundingClientRect().top)); edge.setAttribute('class', 'one-way-top-edge'); collider2DFrame.appendChild(edge);
          }
        }
      }
      anchor = screen[2];
      if (active) {
        const centers = { center:[ox,oy], w:[ox-width/2,oy], e:[ox+width/2,oy], n:[ox,oy+height/2], s:[ox,oy-height/2] };
        for (const [handle, point] of Object.entries(centers)) colliderHandle(document.createElement('button'), componentId, handle, colliderScreenPoint(item, point[0], point[1]), `${handle === 'center' ? 'Move' : 'Resize'} Box Collider 2D ${handle}`);
      }
    } else {
      const [ox, oy] = component.offset, radius = component.radius;
      const points = Array.from({ length: 48 }, (_, index) => { const angle = index / 48 * Math.PI * 2; return colliderScreenPoint(item, ox + Math.cos(angle) * radius, oy + Math.sin(angle) * radius); });
      if (points.some((point) => !point)) continue;
      const polygon = document.createElementNS(svgNS, 'polygon'); polygon.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' ')); polygon.setAttribute('class', `collider-shape${isTrigger ? ' trigger' : ''}${component.enabled === false ? ' disabled' : ''}`); collider2DFrame.appendChild(polygon);
      anchor = points[12];
      if (active) {
        colliderHandle(document.createElement('button'), componentId, 'center', colliderScreenPoint(item, ox, oy), 'Move Circle Collider 2D');
        colliderHandle(document.createElement('button'), componentId, 'radius', colliderScreenPoint(item, ox + radius, oy), 'Resize Circle Collider 2D radius');
      }
    }
    if (anchor) { const label = document.createElement('div'); label.className = `collider-2d-label${isTrigger ? ' trigger' : ''}`; label.textContent = isTrigger ? `Trigger Collider 2D · ${shapeKind === 'box' ? 'Box' : 'Circle'}${component.enabled === false ? ' · Disabled' : ''}` : `${componentId === 'box-collider-2d' ? 'Box' : 'Circle'} Collider 2D${component.enabled === false ? ' · Disabled' : ''}`; label.style.left = `${anchor.x}px`; label.style.top = `${anchor.y}px`; collider2DHandles.appendChild(label); }
  }
  collider2DOverlay.classList.toggle('active', shown > 0);
}

collider2DHandles.addEventListener('pointerdown', (event) => {
  const button = event.target.closest('[data-collider-component]'); const item = selectedCollider2DItem(); if (!button || !item || event.button !== 0) return;
  const component = item.components[button.dataset.colliderComponent]; if (!component) return;
  activeCollider2DComponentId = button.dataset.colliderComponent;
  collider2DDragState = { pointerId: event.pointerId, item, componentId: button.dataset.colliderComponent, handle: button.dataset.colliderHandle, moved: false };
  button.setPointerCapture?.(event.pointerId); event.preventDefault(); event.stopPropagation();
});
collider2DHandles.addEventListener('pointermove', (event) => {
  const state = collider2DDragState; if (!state || state.pointerId !== event.pointerId || selectedItem !== state.item) return;
  const hit = screenToPlanePoint(event.clientX, event.clientY, state.item.entity.position, state.item.entity.forward); if (!hit) return;
  const local = OpusCollider2D.worldToLocal(OpusCollider2D.objectWorldMatrix(state.item), { x: hit.x, y: hit.y }); if (!local) return;
  const component = state.item.components[state.componentId]; const box = state.componentId === 'box-collider-2d' || (state.componentId === 'trigger-collider-2d' && component.shape === 'box'); const edit = box ? OpusCollider2D.editBoxFromLocalHandle(component, state.handle, local) : OpusCollider2D.editCircleFromLocalHandle(component, state.handle, local);
  if (!edit) return; if (!state.moved) { pushUndo(); state.moved = true; }
  Object.assign(component, edit); syncCollider2DOverlay(); event.preventDefault(); event.stopPropagation();
});
function finishCollider2DDrag(event) { if (!collider2DDragState || (event && collider2DDragState.pointerId !== event.pointerId)) return; const moved = collider2DDragState.moved; collider2DDragState = null; if (moved) { renderInspector(); validateCurrentProject(); } }
window.addEventListener('pointerup', finishCollider2DDrag);
window.addEventListener('blur', () => finishCollider2DDrag());

// Phase 033 Tilemap editing targets one stable local Layer ID. Active Layer is
// transient editor state and never enters project/runtime serialization.
// It never creates per-cell scene objects and never steals Alt/right-button
// camera navigation.
const tilemapOverlay = document.getElementById('tilemap-overlay');
const tilemapToolbar = document.getElementById('tilemap-edit-toolbar');
const tilemapGridLines = document.getElementById('tilemap-grid-lines');
const tilemapOriginLines = document.getElementById('tilemap-origin-lines');
const tilemapBrushPreview = document.getElementById('tilemap-brush-preview');
const tilemapCollisionShapes = document.getElementById('tilemap-collision-shapes');
const tilemapMarkerShapes = document.getElementById('tilemap-marker-shapes');
const tilemapCellReadout = document.getElementById('tilemap-cell-readout');
let tilemapTool = null; let tilemapGridVisible = true; let tilemapCollisionVisible = false; let tilemapMarkersVisible = true; let tilemapHoverCell = null; let tilemapStroke = null; let tilemapBrushTileId = null; let tilemapBrushKind = 'manual-tile'; let tilemapBrushAutoTileSetId = null; let tilemapBrushTerrainId = null; let tilemapFootprintShape = 'single'; let tilemapFootprintRadius = 1; let tilemapPlacementPrefabName = ''; let selectedSpawnMarkerId = null; let selectedTilemapChunkId = null; let tilemapChunkCaptureStart = null; let tilemapChunkStampPlan = null;
const tilemapActiveLayerIds = new WeakMap();

function selectedTilemap() { return !playMode && selectedItems.size === 1 && selectedItem && selectedItem.kind === 'tilemap' ? selectedItem : null; }
function activeTilemapLayer(item) {
  if (!item || !Array.isArray(item.layers)) return null;
  const retained = OpusAuthoringPlumbing.getTilemapLayer(item, tilemapActiveLayerIds.get(item));
  if (retained) return retained;
  const chosen = [...item.layers].reverse().find((layer) => layer.visible !== false && !layer.locked) || item.layers[0] || null;
  if (chosen) tilemapActiveLayerIds.set(item, chosen.id);
  return chosen;
}
function finishTilemapStroke() {
  if (!tilemapStroke) return; const changed = tilemapStroke.changed; tilemapStroke = null;
  if (changed) { renderInspector(); renderSceneList(); }
}
function selectTilemapLayer(item, layerId) { finishTilemapStroke(); if (OpusAuthoringPlumbing.getTilemapLayer(item, layerId)) tilemapActiveLayerIds.set(item, layerId); syncTilemapOverlay(); }
function tilemapWorldCell(item, clientX, clientY) {
  const hit = screenToPlanePoint(clientX, clientY, item.entity.position, item.entity.forward); if (!hit) return null;
  const local = spriteLocalPoint(item.entity, hit); const size = OpusAuthoringPlumbing.safeTilesetCellSize(findTilesetById(item.tilesetRef));
  return { x: Math.floor(local.x / size.width), y: Math.floor(local.y / size.height) };
}
function tilemapWorldPoint(item, x, y) {
  return item.entity.position.add(item.entity.right.scale(x * item.entity.scale.x)).add(item.entity.up.scale(y * item.entity.scale.y));
}
// Runtime-facing, read-only query. It reports metadata and current derived
// cell-center world positions; it never draws editor overlays or instantiates.
function queryTilemapSpawnMarkers(tilemapId) {
  const item = placed.find((entry) => entry.kind === 'tilemap' && entry.id === tilemapId); if (!item) return Object.freeze([]);
  return OpusAuthoringPlumbing.getTilemapSpawnMarkers(item, findTilesetById(item.tilesetRef), { position: item.entity.position, right: item.entity.right, up: item.entity.up, scale: item.entity.scale }, prefabs);
}
window.getTilemapSpawnMarkers = queryTilemapSpawnMarkers;
function syncTilemapOverlay() {
  const item = selectedTilemap(); const active = !!(item && tilemapTool);
  tilemapOverlay.classList.toggle('active', active); tilemapToolbar.classList.toggle('active', active);
  if (!active) return;
  const size = OpusAuthoringPlumbing.safeTilesetCellSize(findTilesetById(item.tilesetRef));
  const occupied = OpusAuthoringPlumbing.tilemapOccupiedBounds(item); const h = tilemapHoverCell || { x: 0, y: 0 };
  const minX = Math.max(-100, Math.min(h.x - 6, occupied ? occupied.minX - 1 : -6)); const maxX = Math.min(100, Math.max(h.x + 6, occupied ? occupied.maxX + 1 : 6));
  const minY = Math.max(-100, Math.min(h.y - 6, occupied ? occupied.minY - 1 : -6)); const maxY = Math.min(100, Math.max(h.y + 6, occupied ? occupied.maxY + 1 : 6));
  const wrap = tilemapOverlay.getBoundingClientRect(); const project = (x, y) => { const p = worldToScreen(tilemapWorldPoint(item, x, y)); return p && [p.x - wrap.left, p.y - wrap.top]; };
  const segs = []; const origins = [];
  if (tilemapGridVisible) {
    for (let x = minX; x <= maxX + 1; x++) { const a = project(x * size.width, minY * size.height), b = project(x * size.width, (maxY + 1) * size.height); if (a && b) (x === 0 ? origins : segs).push(`M${a[0]},${a[1]}L${b[0]},${b[1]}`); }
    for (let y = minY; y <= maxY + 1; y++) { const a = project(minX * size.width, y * size.height), b = project((maxX + 1) * size.width, y * size.height); if (a && b) (y === 0 ? origins : segs).push(`M${a[0]},${a[1]}L${b[0]},${b[1]}`); }
  }
  tilemapGridLines.setAttribute('d', segs.join('')); tilemapOriginLines.setAttribute('d', origins.join(''));
  const layer = activeTilemapLayer(item);
  const collisionPolygons = [];
  if (tilemapCollisionVisible && layer && layer.visible !== false) {
    const tileset = findTilesetById(item.tilesetRef);
    for (const entry of OpusAuthoringPlumbing.resolveTilemapLayerCollisions(item, tileset, layer.id)) {
      const rect = entry.rect; const pts = [project(rect.minX, rect.minY), project(rect.maxX, rect.minY), project(rect.maxX, rect.maxY), project(rect.minX, rect.maxY)];
      if (pts.every(Boolean)) {
        const polygon = entry.mode === 'slope' ? (entry.slope === 'up-left' ? [pts[0], pts[1], pts[3]] : [pts[0], pts[1], pts[2]]) : pts;
        const topA = entry.mode === 'slope' && entry.slope === 'up-right' ? pts[0] : pts[3];
        const topB = entry.mode === 'slope' && entry.slope === 'up-left' ? pts[1] : pts[2];
        collisionPolygons.push(`<polygon data-collision-tile="${escapeHtml(entry.tileId)}" data-collision-cell="${entry.cellX},${entry.cellY}" points="${polygon.map((p) => `${p[0]},${p[1]}`).join(' ')}"></polygon>${entry.oneWay ? `<line class="one-way-top-edge" x1="${topA[0]}" y1="${topA[1]}" x2="${topB[0]}" y2="${topB[1]}"></line><text class="one-way-top-label" x="${(topA[0] + topB[0]) / 2}" y="${(topA[1] + topB[1]) / 2 - 5}">↑</text>` : ''}`);
      }
    }
  }
  tilemapCollisionShapes.innerHTML = collisionPolygons.join('');
  const markerShapes = [];
  if (tilemapMarkersVisible) for (const marker of item.spawnMarkers || []) { const point = project((marker.x + 0.5) * size.width, (marker.y + 0.5) * size.height); if (point) markerShapes.push(`<g data-spawn-marker="${escapeHtml(marker.id)}"><path class="spawn-marker-pin${selectedSpawnMarkerId === marker.id ? ' selected' : ''}" d="M${point[0]},${point[1] - 10}a7,7 0 1,1 0,14l-7,8l-7,-8a7,7 0 0,1 7,-14z"></path><text x="${point[0] + 10}" y="${point[1] - 4}">${escapeHtml(marker.name)}</text></g>`); }
  tilemapMarkerShapes.innerHTML = markerShapes.join('');
  let footprint = tilemapHoverCell && (tilemapBrushKind === 'terrain' || tilemapTool === 'erase') ? OpusAuthoringPlumbing.terrainFootprintCells(h.x, h.y, tilemapFootprintShape, tilemapFootprintRadius) : (tilemapHoverCell ? [h] : []);
  if (tilemapTool === 'capture-chunk' && tilemapChunkCaptureStart && tilemapHoverCell) { footprint = []; for (let y = Math.min(tilemapChunkCaptureStart.y, h.y); y <= Math.max(tilemapChunkCaptureStart.y, h.y); y++) for (let x = Math.min(tilemapChunkCaptureStart.x, h.x); x <= Math.max(tilemapChunkCaptureStart.x, h.x); x++) footprint.push({ x, y }); }
  if (tilemapTool === 'stamp-chunk' && tilemapChunkStampPlan && tilemapChunkStampPlan.valid) footprint = tilemapChunkStampPlan.changedCells.filter((cell) => !cell.removed).map((cell) => ({ x: cell.x, y: cell.y }));
  tilemapBrushPreview.innerHTML = footprint.map((cell) => { const x = cell.x * size.width, y = cell.y * size.height; const pts = [project(x, y), project(x + size.width, y), project(x + size.width, y + size.height), project(x, y + size.height)]; return pts.every(Boolean) ? `<polygon points="${pts.map((point) => `${point[0]},${point[1]}`).join(' ')}"></polygon>` : ''; }).join('');
  let previewTileId = tilemapBrushKind === 'manual-tile' ? (tilemapBrushTileId || activeTileId) : null;
  if (tilemapHoverCell && tilemapBrushKind === 'auto-tile') { const tileset = findTilesetById(item.tilesetRef), set = OpusAuthoringPlumbing.getAutoTileSetById(tileset, tilemapBrushAutoTileSetId); if (OpusAuthoringPlumbing.autoTileSetCanResolve(tileset, set)) { const mask = OpusAuthoringPlumbing.resolveAutoTileMask(item, layer.id, h.x, h.y, set.id, set.neighborMode, { x: h.x, y: h.y, autoTileSetId: set.id }); previewTileId = OpusAuthoringPlumbing.resolveAutoTileOutput(tileset, set, mask, set.defaultTileId); } }
  if (tilemapHoverCell && tilemapBrushKind === 'terrain') { const tileset = findTilesetById(item.tilesetRef), brush = OpusAuthoringPlumbing.getTerrainBrushById(tileset, tilemapBrushTerrainId); if (brush && brush.mode === 'weighted-tiles') previewTileId = OpusAuthoringPlumbing.resolveTerrainWeightedTile(tileset, brush, layer.id, h.x, h.y); else if (brush && brush.mode === 'auto-tile') { const set = OpusAuthoringPlumbing.getAutoTileSetById(tileset, brush.autoTileSetId); if (set) { const mask = OpusAuthoringPlumbing.resolveAutoTileMask(item, layer.id, h.x, h.y, set.id, set.neighborMode, { x: h.x, y: h.y, autoTileSetId: set.id }); previewTileId = OpusAuthoringPlumbing.resolveAutoTileOutput(tileset, set, mask, set.defaultTileId); } } }
  if (previewTileId) tilemapBrushPreview.dataset.resolvedTile = previewTileId; else delete tilemapBrushPreview.dataset.resolvedTile;
  tilemapBrushPreview.classList.toggle('erase', tilemapTool === 'erase');
  const blocked = layer && (layer.visible === false ? ' · hidden' : layer.locked ? ' · locked' : '');
  document.getElementById('tilemap-active-layer-readout').textContent = layer ? `Layer: ${layer.name}${blocked}` : 'Layer —';
  const hoveredCell = layer && tilemapHoverCell ? OpusAuthoringPlumbing.getTilemapCell(item, layer.id, h.x, h.y) : null; const brushTileset = findTilesetById(item.tilesetRef); const hoveredSet = hoveredCell && OpusAuthoringPlumbing.getAutoTileSetById(brushTileset, hoveredCell.autoTileSetId); const hoveredTerrain = hoveredCell && OpusAuthoringPlumbing.getTerrainBrushById(brushTileset, hoveredCell.terrainBrushId);
  tilemapCellReadout.textContent = tilemapHoverCell ? `Cell ${h.x}, ${h.y}${hoveredTerrain ? ` · Terrain: ${hoveredTerrain.name}` : hoveredSet ? ` · Auto-Tile: ${hoveredSet.name}` : ''}${hoveredCell ? ` · Resolved: ${(OpusAuthoringPlumbing.getTileById(brushTileset, hoveredCell.tileId) || {}).name || hoveredCell.tileId}` : ''}` : 'Cell —';
  const brushSet = tilemapBrushKind === 'auto-tile' && OpusAuthoringPlumbing.getAutoTileSetById(brushTileset, tilemapBrushAutoTileSetId), terrainBrush = tilemapBrushKind === 'terrain' && OpusAuthoringPlumbing.getTerrainBrushById(brushTileset, tilemapBrushTerrainId), previewTile = OpusAuthoringPlumbing.getTileById(brushTileset, previewTileId); document.getElementById('tilemap-brush-readout').textContent = terrainBrush ? `Terrain: ${terrainBrush.name} · ${terrainBrush.mode === 'weighted-tiles' ? 'Weighted' : 'Auto-Tile'}${previewTile ? ` · Would resolve: ${previewTile.name}` : ''}` : brushSet ? `Auto-Tile: ${brushSet.name} · ${brushSet.neighborMode === 'eight-way' ? '8-Way / Corners' : '4-Way'}${previewTile ? ` · Would resolve: ${previewTile.name}` : ''}` : 'Manual Tile Brush';
  document.getElementById('tilemap-footprint-count').textContent = `${footprint.length || OpusAuthoringPlumbing.terrainFootprintCells(0, 0, tilemapFootprintShape, tilemapFootprintRadius).length} cell${(footprint.length || 1) === 1 ? '' : 's'}`;
  document.getElementById('tilemap-paint-tool').setAttribute('aria-pressed', tilemapTool === 'paint');
  document.getElementById('tilemap-erase-tool').setAttribute('aria-pressed', tilemapTool === 'erase');
  document.getElementById('tilemap-place-object-tool').setAttribute('aria-pressed', tilemapTool === 'place-object');
  document.getElementById('tilemap-spawn-marker-tool').setAttribute('aria-pressed', tilemapTool === 'spawn-marker');
  document.getElementById('tilemap-capture-chunk-tool').setAttribute('aria-pressed', tilemapTool === 'capture-chunk');
  document.getElementById('tilemap-stamp-chunk-tool').setAttribute('aria-pressed', tilemapTool === 'stamp-chunk');
  document.getElementById('tilemap-collision-toggle').setAttribute('aria-pressed', tilemapCollisionVisible);
  document.getElementById('tilemap-collision-toggle').classList.toggle('active', tilemapCollisionVisible);
}
function setTilemapTool(tool) {
  tilemapTool = ['paint', 'erase', 'place-object', 'spawn-marker', 'capture-chunk', 'stamp-chunk'].includes(tool) ? tool : null; tilemapHoverCell = null; tilemapStroke = null; tilemapChunkCaptureStart = null; tilemapChunkStampPlan = null;
  const select = document.getElementById('tilemap-prefab-select'); if (select) { select.innerHTML = `<option value="">Choose Prefab…</option>${prefabs.map((prefab) => `<option value="${escapeHtml(prefab.name)}"${tilemapPlacementPrefabName === prefab.name ? ' selected' : ''}>${escapeHtml(prefab.name)}</option>`).join('')}`; }
  syncTilemapOverlay();
}
function placePrefabAtTilemapCell(item, cell) {
  const prefab = prefabs.find((entry) => entry.name === tilemapPlacementPrefabName); if (!prefab) { showStatus('Choose a Prefab before placing an object'); return false; }
  const size = OpusAuthoringPlumbing.safeTilesetCellSize(findTilesetById(item.tilesetRef)); const point = tilemapWorldPoint(item, (cell.x + 0.5) * size.width, (cell.y + 0.5) * size.height); pushUndo();
  let newItems;
  if (prefab.records && prefab.records.length) newItems = instantiatePrefabAssembly(prefab, point);
  else { const record = prefab.record; if (!record) return false; const placedItem = record.kind === 'sprite' ? instantiateSpriteRecord(record, point) : instantiateCubeRecord(record, point); placedItem.id = generateItemId(); newItems = [placedItem]; newItems._newRootId = placedItem.id; }
  for (const placedItem of newItems) addPlaced(placedItem); hierarchyTickToken++; updateHierarchyTransforms(); selectedItems.clear(); for (const placedItem of newItems) selectedItems.add(placedItem); selectedItem = newItems.find((placedItem) => placedItem.id === newItems._newRootId) || newItems[0]; if (selectedItem) selectedItem.sourcePrefabName = prefab.name; renderSceneList(); renderInspector(); showStatus(`Placed ${prefab.name} at cell ${cell.x}, ${cell.y}`); return true;
}
function chooseTilemapChunkMapping(chunk, item) {
  const suggested = OpusAuthoringPlumbing.suggestTilemapChunkLayerMapping(chunk, item, (activeTilemapLayer(item) || {}).id); const mapping = {};
  for (const layer of chunk.layers) {
    const suggestion = OpusAuthoringPlumbing.getTilemapLayer(item, suggested[layer.id]);
    const answer = prompt(`Map Chunk Layer "${layer.name}" to a distinct visible, unlocked target Layer name. Enter NEW to create one.\n\nAvailable: ${(item.layers || []).map((entry) => `${entry.name}${entry.locked ? ' (locked)' : entry.visible === false ? ' (hidden)' : ''}`).join(', ')}`, suggestion ? suggestion.name : 'NEW');
    if (answer == null) return null; const value = answer.trim();
    if (value.toLowerCase() === 'new') mapping[layer.id] = { create: true, name: layer.name };
    else { const matches = (item.layers || []).filter((entry) => entry.name.toLowerCase() === value.toLowerCase()); if (matches.length !== 1) { showStatus(`Mapping for "${layer.name}" must name exactly one target Layer`); return null; } mapping[layer.id] = matches[0].id; }
  }
  const issues = OpusAuthoringPlumbing.validateTilemapChunkLayerMapping(chunk, item, mapping); if (issues.length) { showStatus(issues[0].message); return null; } return mapping;
}
function finishTilemapChunkCapture(item, from, to) {
  const active = activeTilemapLayer(item); const defaultNames = active ? active.name : ''; const selectedNames = prompt(`Create Chunk from rectangular region ${Math.abs(to.x - from.x) + 1} × ${Math.abs(to.y - from.y) + 1}.\n\nEnter comma-separated Tile Layer names to capture. Hidden and locked Layers are allowed when named explicitly.\n\nOrdinary scene objects are not included in Tilemap Chunks. Use Prefabs or Spawn Markers for reusable object intent.`, defaultNames);
  if (selectedNames == null) return; const wanted = selectedNames.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean); const layerIds = (item.layers || []).filter((layer) => wanted.includes(layer.name.toLowerCase())).map((layer) => layer.id); const includeSpawnMarkers = confirm('Include Spawn Markers in this Chunk?\n\nDefault is No. Markers are semantic templates and each stamp creates new marker identities.');
  const name = prompt('Chunk name:', 'Tilemap Chunk'); if (!name || !name.trim()) return; const id = OpusAuthoringPlumbing.uniqueTilemapChunkId(tilemapChunks, name); const chunk = OpusAuthoringPlumbing.captureTilemapChunk(item, { id, name: OpusAuthoringPlumbing.uniqueTilemapChunkName(tilemapChunks, name), from, to, layerIds, includeSpawnMarkers, tileset: findTilesetById(item.tilesetRef) });
  if (!chunk) { showStatus('Chunk was not created: select at least one occupied Cell or include a Spawn Marker in the region'); return; } pushUndo(); tilemapChunks.push(chunk); selectedTilemapChunkId = chunk.id; renderTilemapChunkLibrary(); showStatus(`Created Chunk "${chunk.name}" · ${chunk.width}×${chunk.height} · ${OpusAuthoringPlumbing.tilemapChunkCellCount(chunk)} cells · ${chunk.spawnMarkers.length} markers; ordinary objects excluded`);
}
function updateTilemapChunkStampPreview(item, cell) {
  const chunk = findTilemapChunkById(selectedTilemapChunkId); if (!chunk || !cell) { tilemapChunkStampPlan = null; return; }
  if (!tilemapChunkMapping || tilemapChunkMapping.chunkId !== chunk.id || tilemapChunkMapping.tilemapId !== item.id) { const mapping = chooseTilemapChunkMapping(chunk, item); if (!mapping) { setTilemapTool(null); return; } tilemapChunkMapping = { chunkId: chunk.id, tilemapId: item.id, mapping }; }
  tilemapChunkStampPlan = OpusAuthoringPlumbing.planTilemapChunkStamp(chunk, item, findTilesetById(item.tilesetRef), cell, tilemapChunkMapping.mapping, prefabs);
  if (tilemapChunkStampPlan.valid) tilemapCellReadout.textContent = `Anchor ${cell.x}, ${cell.y} · ${tilemapChunkStampPlan.cellsAdded} add · ${tilemapChunkStampPlan.cellsOverwritten} replace · ${tilemapChunkStampPlan.markersCreated.length} markers`;
}
let tilemapChunkMapping = null;
function applyTilemapStrokeCell(item, cell) {
  const layer = tilemapStroke && OpusAuthoringPlumbing.getTilemapLayer(item, tilemapStroke.layerId); if (!layer || layer.locked || layer.visible === false) return;
  const centers = (tilemapBrushKind === 'terrain' || tilemapTool === 'erase') ? OpusAuthoringPlumbing.terrainFootprintCells(cell.x, cell.y, tilemapFootprintShape, tilemapFootprintRadius) : [cell]; const targets = centers.filter((target) => { const key = `${target.x},${target.y}`; if (tilemapStroke.seen.has(key)) return false; tilemapStroke.seen.add(key); return true; }); if (!targets.length) return;
  const tileset = findTilesetById(item.tilesetRef); const tile = OpusAuthoringPlumbing.getTileById(tileset, tilemapBrushTileId || activeTileId); const autoSet = OpusAuthoringPlumbing.getAutoTileSetById(tileset, tilemapBrushAutoTileSetId); const terrainBrush = OpusAuthoringPlumbing.getTerrainBrushById(tileset, tilemapBrushTerrainId);
  const changes = tilemapTool === 'erase' ? targets.some((target) => OpusAuthoringPlumbing.getTilemapCell(item, layer.id, target.x, target.y)) : tilemapBrushKind === 'terrain' ? OpusAuthoringPlumbing.terrainBrushCanPaint(tileset, terrainBrush) : tilemapBrushKind === 'auto-tile' ? !!autoSet : !!tile;
  if (!changes) return; if (!tilemapStroke.changed) { pushUndo(); tilemapStroke.changed = true; }
  if (tilemapTool === 'erase') OpusAuthoringPlumbing.eraseTerrainCells(item, layer.id, targets, tileset);
  else if (tilemapBrushKind === 'terrain') OpusAuthoringPlumbing.paintTerrainCells(item, layer.id, targets, tileset, terrainBrush.id);
  else if (tilemapBrushKind === 'auto-tile') OpusAuthoringPlumbing.paintAutoTileCell(item, layer.id, cell.x, cell.y, tileset, autoSet.id);
  else OpusAuthoringPlumbing.paintManualTileCell(item, layer.id, cell.x, cell.y, tile.id, tileset);
  syncTilemapRenderer(item); syncTilemapOverlay();
}

canvas.addEventListener('pointerdown', (event) => {
  const item = selectedTilemap(); if (!item || !tilemapTool || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey) return;
  const cell = tilemapWorldCell(item, event.clientX, event.clientY); if (!cell) return;
  if (tilemapTool === 'capture-chunk') { if (!tilemapChunkCaptureStart) { tilemapChunkCaptureStart = cell; tilemapHoverCell = cell; showStatus(`Chunk capture started at ${cell.x}, ${cell.y}; choose the opposite corner`); } else { const from = tilemapChunkCaptureStart; tilemapChunkCaptureStart = null; finishTilemapChunkCapture(item, from, cell); } justDragged = true; suppressCameraDrag(); event.preventDefault(); event.stopImmediatePropagation(); syncTilemapOverlay(); return; }
  if (tilemapTool === 'stamp-chunk') { updateTilemapChunkStampPreview(item, cell); if (!tilemapChunkStampPlan || !tilemapChunkStampPlan.valid) { showStatus((tilemapChunkStampPlan && tilemapChunkStampPlan.problems[0] || {}).message || 'Chunk stamp is invalid'); return; } const summary = `${tilemapChunkStampPlan.cellsAdded} cells will be added\n${tilemapChunkStampPlan.cellsOverwritten} cells will be replaced\n${tilemapChunkStampPlan.markersCreated.length} Spawn Markers will be created\n${tilemapChunkStampPlan.newLayers.length} Layers will be created\n\nEmpty Chunk holes do not erase target cells.`; if (!confirm(`Stamp "${findTilemapChunkById(selectedTilemapChunkId).name}" at ${cell.x}, ${cell.y}?\n\n${summary}`)) return; pushUndo(); OpusAuthoringPlumbing.commitTilemapChunkStamp(item, tilemapChunkStampPlan); syncTilemapRenderer(item); renderInspector(); renderSceneList(); showStatus(`Stamped Chunk in one Undo step · ${tilemapChunkStampPlan.cellsAdded} added · ${tilemapChunkStampPlan.cellsOverwritten} replaced`); justDragged = true; suppressCameraDrag(); event.preventDefault(); event.stopImmediatePropagation(); syncTilemapOverlay(); return; }
  if (tilemapTool === 'place-object') { if (placePrefabAtTilemapCell(item, cell)) { justDragged = true; suppressCameraDrag(); event.preventDefault(); event.stopImmediatePropagation(); } return; }
  if (tilemapTool === 'spawn-marker') {
    const existing = (item.spawnMarkers || []).find((marker) => marker.x === cell.x && marker.y === cell.y);
    pushUndo(); const marker = existing || OpusAuthoringPlumbing.createSpawnMarker(item, { name: 'Spawn', x: cell.x, y: cell.y, prefabRef: tilemapPlacementPrefabName || null }); if (!marker) return;
    selectedSpawnMarkerId = marker.id; tilemapStroke = { pointerId: event.pointerId, item, markerId: marker.id, last: cell, markerMove: true, changed: !existing }; renderInspector(); syncTilemapOverlay(); justDragged = true; canvas.setPointerCapture?.(event.pointerId); suppressCameraDrag(); event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  const layer = activeTilemapLayer(item); if (!layer) { showStatus('Add a Tile Layer before editing'); return; }
  if (layer.visible === false) { showStatus('Show this layer to edit its cells.'); return; }
  if (layer.locked) { showStatus('Unlock this layer to edit its cells.'); return; }
  if (tilemapTool === 'paint') { const tileset = findTilesetById(item.tilesetRef); const valid = tilemapBrushKind === 'terrain' ? OpusAuthoringPlumbing.terrainBrushCanPaint(tileset, OpusAuthoringPlumbing.getTerrainBrushById(tileset, tilemapBrushTerrainId)) : tilemapBrushKind === 'auto-tile' ? OpusAuthoringPlumbing.autoTileSetCanResolve(tileset, OpusAuthoringPlumbing.getAutoTileSetById(tileset, tilemapBrushAutoTileSetId)) : OpusAuthoringPlumbing.getTileById(tileset, tilemapBrushTileId || activeTileId); if (!item.tilesetRef || !valid) { showStatus(tilemapBrushKind === 'terrain' ? 'Choose a valid Terrain Brush before painting' : tilemapBrushKind === 'auto-tile' ? 'Choose a valid Auto-Tile Set with a Default Tile before painting' : 'Open this Tilemap’s Tile Palette and select a valid Tile before painting'); return; } }
  tilemapStroke = { pointerId: event.pointerId, item, layerId: layer.id, last: cell, seen: new Set(), changed: false }; applyTilemapStrokeCell(item, cell);
  justDragged = true; // consume the synthetic click so narrow-screen Inspector drawers do not reopen over every painted cell
  canvas.setPointerCapture?.(event.pointerId); suppressCameraDrag(); event.preventDefault(); event.stopImmediatePropagation();
});
canvas.addEventListener('pointermove', (event) => {
  const item = selectedTilemap(); if (!item || !tilemapTool) return;
  const cell = tilemapWorldCell(item, event.clientX, event.clientY); tilemapHoverCell = cell; if (tilemapTool === 'stamp-chunk' && tilemapChunkMapping) updateTilemapChunkStampPreview(item, cell); syncTilemapOverlay();
  if (!tilemapStroke || tilemapStroke.pointerId !== event.pointerId || !cell) return;
  if (tilemapStroke.markerMove) { const marker = OpusAuthoringPlumbing.getSpawnMarkerById(item, tilemapStroke.markerId); if (marker && (marker.x !== cell.x || marker.y !== cell.y)) { OpusAuthoringPlumbing.updateSpawnMarker(item, marker.id, { x: cell.x, y: cell.y }); tilemapStroke.changed = true; tilemapStroke.last = cell; renderInspector(); syncTilemapOverlay(); } suppressCameraDrag(); event.preventDefault(); event.stopImmediatePropagation(); return; }
  for (const step of OpusAuthoringPlumbing.tilemapStrokeCells(tilemapStroke.last.x, tilemapStroke.last.y, cell.x, cell.y)) applyTilemapStrokeCell(item, step);
  tilemapStroke.last = cell; suppressCameraDrag(); event.preventDefault(); event.stopImmediatePropagation();
});
window.addEventListener('pointerup', (event) => { if (tilemapStroke && tilemapStroke.pointerId === event.pointerId) finishTilemapStroke(); });
window.addEventListener('blur', finishTilemapStroke);

document.getElementById('tilemap-paint-tool').onclick = () => setTilemapTool('paint');
document.getElementById('tilemap-erase-tool').onclick = () => setTilemapTool('erase');
document.getElementById('tilemap-place-object-tool').onclick = () => setTilemapTool('place-object');
document.getElementById('tilemap-spawn-marker-tool').onclick = () => setTilemapTool('spawn-marker');
document.getElementById('tilemap-capture-chunk-tool').onclick = () => setTilemapTool('capture-chunk');
document.getElementById('tilemap-stamp-chunk-tool').onclick = () => { if (!findTilemapChunkById(selectedTilemapChunkId)) { showStatus('Select a Tilemap Chunk in the Asset Library first'); return; } tilemapChunkMapping = null; setTilemapTool('stamp-chunk'); };
document.getElementById('tilemap-prefab-select').onchange = (event) => { tilemapPlacementPrefabName = event.target.value; syncTilemapOverlay(); };
document.getElementById('tilemap-grid-toggle').onclick = () => { tilemapGridVisible = !tilemapGridVisible; document.getElementById('tilemap-grid-toggle').classList.toggle('active', tilemapGridVisible); document.getElementById('tilemap-grid-toggle').setAttribute('aria-pressed', tilemapGridVisible); syncTilemapOverlay(); };
document.getElementById('tilemap-collision-toggle').onclick = () => { tilemapCollisionVisible = !tilemapCollisionVisible; syncTilemapOverlay(); };
document.getElementById('tilemap-marker-toggle').onclick = () => { tilemapMarkersVisible = !tilemapMarkersVisible; document.getElementById('tilemap-marker-toggle').classList.toggle('active', tilemapMarkersVisible); document.getElementById('tilemap-marker-toggle').setAttribute('aria-pressed', tilemapMarkersVisible); syncTilemapOverlay(); };
document.getElementById('tilemap-exit-edit').onclick = () => setTilemapTool(null);
document.getElementById('tilemap-open-palette').onclick = () => { const item = selectedTilemap(); if (item && item.tilesetRef) openTilePalette(item.tilesetRef); else showStatus('Assign a Tileset first'); };
document.getElementById('tilemap-footprint-shape').onchange = (event) => { tilemapFootprintShape = event.target.value; document.getElementById('tilemap-footprint-radius').disabled = tilemapFootprintShape === 'single'; syncTilemapOverlay(); };
document.getElementById('tilemap-footprint-radius').onchange = (event) => { tilemapFootprintRadius = Math.max(1, Math.min(8, Math.round(Number(event.target.value) || 1))); event.target.value = tilemapFootprintRadius; syncTilemapOverlay(); };

function selectedSpriteComponent() {
  if (playMode || selectedItems.size !== 1 || !selectedItem || selectedItem.kind !== 'sprite') return null;
  return selectedItem.components && selectedItem.components['sprite-renderer'];
}

function spriteWorldPoint(entity, localX, localY) {
  return entity.position
    .add(entity.right.scale(localX * entity.scale.x))
    .add(entity.up.scale(localY * entity.scale.y));
}

function spriteLocalPoint(entity, worldPoint) {
  const delta = worldPoint.sub(entity.position);
  return {
    x: delta.dot(entity.right) / Math.max(Math.abs(entity.scale.x), 1e-7),
    y: delta.dot(entity.up) / Math.max(Math.abs(entity.scale.y), 1e-7),
  };
}

function syncSpriteDirectManipulation() {
  const component = selectedSpriteComponent();
  if (!component || !selectedItem.entity || !globalThis.OpusSpriteAuthoring) {
    spriteDirectOverlay.classList.remove('active');
    return;
  }
  const b = OpusSpriteAuthoring.bounds(component);
  const local = {
    nw: [b.left, b.top], n: [(b.left + b.right) / 2, b.top], ne: [b.right, b.top],
    e: [b.right, (b.bottom + b.top) / 2], se: [b.right, b.bottom],
    s: [(b.left + b.right) / 2, b.bottom], sw: [b.left, b.bottom],
    w: [b.left, (b.bottom + b.top) / 2],
  };
  const wrapRect = spriteDirectOverlay.parentElement.getBoundingClientRect();
  const projected = {};
  for (const [key, point] of Object.entries(local)) {
    const screen = worldToScreen(spriteWorldPoint(selectedItem.entity, point[0], point[1]));
    if (!screen) { spriteDirectOverlay.classList.remove('active'); return; }
    projected[key] = { x: screen.x - wrapRect.left, y: screen.y - wrapRect.top };
  }
  spriteDirectPolygon.setAttribute('points', ['nw', 'ne', 'se', 'sw'].map((key) => `${projected[key].x},${projected[key].y}`).join(' '));
  for (const handle of spriteResizeHandles) {
    const p = projected[handle.dataset.spriteResize];
    handle.style.left = `${p.x}px`; handle.style.top = `${p.y}px`;
  }
  const pivot = worldToScreen(selectedItem.entity.position);
  if (!pivot) { spriteDirectOverlay.classList.remove('active'); return; }
  spritePivotHandle.style.left = `${pivot.x - wrapRect.left}px`;
  spritePivotHandle.style.top = `${pivot.y - wrapRect.top}px`;
  spriteDirectSize.style.left = `${projected.s.x}px`;
  spriteDirectSize.style.top = `${projected.s.y}px`;
  spriteDirectSize.textContent = `${b.width.toFixed(2)} × ${b.height.toFixed(2)}${spriteAspectLock ? ' • aspect locked' : ''}`;
  spriteDirectOverlay.classList.add('active');
}

function syncSpriteInspectorGeometryFields(component) {
  for (const key of ['width', 'height', 'pivotX', 'pivotY']) {
    const input = inspectorBody.querySelector(`[data-field-editor-key="${key}"]`);
    if (input) input.value = component[key];
  }
}

function beginSpriteDirectDrag(event, type, handle) {
  const component = selectedSpriteComponent();
  if (!component) return;
  const entity = selectedItem.entity;
  const originScreen = worldToScreen(entity.position);
  const xScreen = worldToScreen(spriteWorldPoint(entity, 1, 0));
  const yScreen = worldToScreen(spriteWorldPoint(entity, 0, 1));
  if (!originScreen || !xScreen || !yScreen) return;
  const xAxis = { x: xScreen.x - originScreen.x, y: xScreen.y - originScreen.y };
  const yAxis = { x: yScreen.x - originScreen.x, y: yScreen.y - originScreen.y };
  const determinant = xAxis.x * yAxis.y - xAxis.y * yAxis.x;
  if (Math.abs(determinant) < 1e-4) { showStatus('Sprite is too edge-on for direct editing; orbit the camera slightly'); return; }
  spriteDirectDragState = {
    type, handle, pointerId: event.pointerId, item: selectedItem,
    start: { width: component.width, height: component.height, pivotX: component.pivotX, pivotY: component.pivotY },
    grabClientX: event.clientX, grabClientY: event.clientY, xAxis, yAxis, determinant, moved: false,
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault(); event.stopPropagation();
}

for (const handle of spriteResizeHandles) {
  handle.addEventListener('pointerdown', (event) => beginSpriteDirectDrag(event, 'resize', handle.dataset.spriteResize));
}
spritePivotHandle.addEventListener('pointerdown', (event) => beginSpriteDirectDrag(event, 'pivot', 'pivot'));

window.addEventListener('pointermove', (event) => {
  const state = spriteDirectDragState;
  if (!state || event.pointerId !== state.pointerId || selectedItem !== state.item) return;
  if (!state.moved) { pushUndo(); state.moved = true; }
  // Solve the two projected local axes for the cursor delta. Unlike a ray
  // intersecting a nearly edge-on plane, this remains bounded and matches
  // the pixels the creator is actually dragging.
  const screenX = event.clientX - state.grabClientX;
  const screenY = event.clientY - state.grabClientY;
  const local = {
    x: (screenX * state.yAxis.y - screenY * state.yAxis.x) / state.determinant,
    y: (state.xAxis.x * screenY - state.xAxis.y * screenX) / state.determinant,
  };
  const component = state.item.components['sprite-renderer'];
  if (state.type === 'resize') {
    const next = OpusSpriteAuthoring.resize(
      state.start, state.handle,
      local.x, local.y,
      spriteAspectLock, gizmoSnap.enabled ? gizmoSnap.scale : 0,
    );
    component.width = next.width; component.height = next.height;
  } else {
    const next = OpusSpriteAuthoring.pivotFromLocalPoint(state.start, local.x, local.y);
    component.pivotX = next.pivotX; component.pivotY = next.pivotY;
  }
  syncSpriteRenderer(state.item);
  syncSpriteInspectorGeometryFields(component);
  syncSpriteDirectManipulation();
  event.preventDefault(); event.stopPropagation();
});

window.addEventListener('pointerup', (event) => {
  if (!spriteDirectDragState || event.pointerId !== spriteDirectDragState.pointerId) return;
  const changed = spriteDirectDragState.moved;
  spriteDirectDragState = null;
  if (changed) renderInspector();
  syncSpriteDirectManipulation();
});

// Terrain footprint, for raycast picking -- approximated as an AABB over its
// square size (not the true circular island shape, same spirit as the cube's
// sphere approximation below: close enough for a click/drag hit-test).
function terrainAABB(item) {
  const opts = item.options;
  const half = (opts.size ?? 22) * 0.5;
  const pos = item.handle.position;
  return new Opus.Physics.AABB(
    new Opus.Vec3(pos.x - half, pos.y - 3, pos.z - half),
    new Opus.Vec3(pos.x + half, pos.y + 3, pos.z + half),
  );
}

function pickEntity(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const ray = app.camera.screenPointToRay(ndcX, ndcY, canvas.width / Math.max(canvas.height, 1));

  // A Tilemap is selected as one scene object. Its pick footprint is the
  // occupied sparse bounds (or one origin cell while empty), transformed by
  // the Tilemap entity; individual cells never become selectable entities.
  let closestTilemapT = Infinity; let tilemapHit = null;
  for (const item of placed) {
    if (item.kind !== 'tilemap') continue;
    if (playMode && item.entity.visible === false) continue;
    const normal = item.entity.forward; const denom = ray.direction.dot(normal);
    if (Math.abs(denom) < 1e-7) continue;
    const t = item.entity.position.sub(ray.origin).dot(normal) / denom;
    if (t < 0 || t >= closestTilemapT) continue;
    const local = spriteLocalPoint(item.entity, ray.origin.add(ray.direction.scale(t)));
    const ts = findTilesetById(item.tilesetRef); const size = OpusAuthoringPlumbing.safeTilesetCellSize(ts);
    const bounds = OpusAuthoringPlumbing.tilemapOccupiedBounds(item) || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    if (local.x >= bounds.minX * size.width && local.x <= (bounds.maxX + 1) * size.width
      && local.y >= bounds.minY * size.height && local.y <= (bounds.maxY + 1) * size.height) {
      closestTilemapT = t; tilemapHit = item;
    }
  }
  if (tilemapHit) return tilemapHit;

  // Sprites use their real pivot-aware oriented rectangle, not the cube's
  // sphere approximation. This keeps selection honest for non-centred
  // pivots, authored rotation, and Transform scale.
  let closestSpriteT = Infinity;
  let spriteHit = null;
  for (const item of placed) {
    if (item.kind !== 'sprite') continue;
    const entity = item.entity;
    if (playMode && (entity.visible === false || entity.spriteRenderer?.visible === false)) continue;
    const sprite = entity.spriteRenderer || { width: 1, height: 1, pivotX: 0.5, pivotY: 0.5 };
    const normal = entity.forward;
    const denom = ray.direction.dot(normal);
    if (Math.abs(denom) < 1e-7) continue;
    const t = entity.position.sub(ray.origin).dot(normal) / denom;
    if (t < 0 || t >= closestSpriteT) continue;
    const hit = ray.origin.add(ray.direction.scale(t)).sub(entity.position);
    const x = hit.dot(entity.right) / Math.max(Math.abs(entity.scale.x), 1e-7);
    const y = hit.dot(entity.up) / Math.max(Math.abs(entity.scale.y), 1e-7);
    if (x >= -sprite.pivotX * sprite.width && x <= (1 - sprite.pivotX) * sprite.width
      && y >= -sprite.pivotY * sprite.height && y <= (1 - sprite.pivotY) * sprite.height) {
      closestSpriteT = t;
      spriteHit = item;
    }
  }
  if (spriteHit) return spriteHit;

  // Water is deliberately excluded: it's a single large backdrop plane
  // spanning most of the map, so making it raycast-pickable would mean
  // almost every click lands on it -- including the "click empty space to
  // deselect" gesture, which would stop working almost everywhere. It
  // stays Scene-list-only, as before.
  //
  // Cubes are checked -- and always preferred -- ahead of terrain, not
  // merged into one closest-t comparison. An object resting on an island
  // sits INSIDE that terrain's own AABB (which spans a generous +-3 in y to
  // approximate the whole heightfield), so its near face is almost always
  // closer to the camera than anything resting inside it. A raw
  // closest-hit comparison would make the terrain win nearly every time a
  // crate/hazard/boost pad sits on land -- exactly backwards from what
  // clicking or dragging a crate should do. Found by dragging a crate that
  // sits on an island and grabbing the whole island instead.
  let closestCubeT = Infinity;
  let cubeHit = null;
  // Authoring picks the real mesh (or box) under the cursor, so a crate on a
  // table selects the crate rather than the table's oversized bounding
  // sphere. Play keeps the generous sphere for gameplay clicks, and the
  // sphere still catches near-misses on tiny markers when nothing is hit.
  if (!playMode && typeof surfaceRayEntity === 'function') {
    const o = [ray.origin.x, ray.origin.y, ray.origin.z], d = [ray.direction.x, ray.direction.y, ray.direction.z];
    for (const item of placed) {
      if (item.kind !== 'cube' || !item.entity || !item.entity.mesh || !item.entity.modelMatrix) continue;
      const t = surfaceRayEntity(o, d, item.entity, closestCubeT);
      if (t !== null && t < closestCubeT) { closestCubeT = t; cubeHit = item; }
    }
    if (cubeHit) return cubeHit;
  }
  for (const item of placed) {
    if (item.kind !== 'cube') continue;
    // Hidden gameplay objects cannot intercept visible interactions. Editor
    // selection intentionally retains them so creators can author/reveal them.
    if (playMode && item.entity.visible === false) continue;
    const radius = 0.6 * Math.max(item.entity.scale.x, item.entity.scale.y, item.entity.scale.z);
    const t = Opus.Physics.raySphere(ray.origin, ray.direction, item.entity.position, radius);
    if (t !== null && t < closestCubeT) {
      closestCubeT = t;
      cubeHit = item;
    }
  }
  if (cubeHit) return cubeHit;

  let closestTerrainT = Infinity;
  let terrainHit = null;
  for (const item of placed) {
    if (item.kind !== 'terrain') continue;
    // Canonical Terrain is a rendered handle, not an Entity with visibility.
    const t = Opus.Physics.rayAABB(ray.origin, ray.direction, terrainAABB(item));
    if (t !== null && t < closestTerrainT) {
      closestTerrainT = t;
      terrainHit = item;
    }
  }
  return terrainHit;
}

