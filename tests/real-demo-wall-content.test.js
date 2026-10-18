'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fit=require('../tools/showcase-wall-collision');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'games/catalog.json'))).games.filter(g=>g.visibility==='public');
let panels=0,games=0,passable=0,pillars=0,computerBanks=0;
for(const game of catalog){
  const p=JSON.parse(fs.readFileSync(path.join(root,'games',game.file))),assets=new Map(p.assets.map(a=>[a.id,a]));let count=0;
  for(const level of p.levels)for(const o of level.objects){
    if(o.assetId==='showcase-broken-wall')assert.strictEqual(o.solid,true,`${game.id}/${o.id}: non-solid broken masonry must be composed from actual blocking stones, not silently remain pass-through`);
    if(o.assetId==='showcase-wall-panel'){
      assert.strictEqual(o.solid,true,`${game.id}/${o.id}: rendered architectural wall must block`);
      assert.deepStrictEqual(o.collider,fit('wall-panel',assets.get(o.assetId),o.scale,o.rotationY||0).collider,`${game.id}/${o.id}: collider follows measured mesh, scale, origin and yaw`);
      panels++;count++;
    }
    if(o.assetId==='showcase-pillar'){
      assert.strictEqual(o.solid,true,`${game.id}/${o.id}: architectural stone pillar must block`);
      assert(o.collider?.shape==='box',`${game.id}/${o.id}: pillar uses explicit measured bounds, not the historical centred cube`);
      pillars++;
    }
    if(o.assetId==='showcase-computer-bank'){
      assert.strictEqual(o.solid,true,`${game.id}/${o.id}: substantial computer-bank cabinet cannot be an accidental walkthrough prop`);
      assert.deepStrictEqual(o.collider,fit('computer-bank',assets.get(o.assetId),o.scale,o.rotationY||0).collider);
      computerBanks++;
    }
    if(['showcase-support-column','showcase-crate','showcase-barricade'].includes(o.assetId)){
      assert.strictEqual(o.solid,true,`${game.id}/${o.id}: structural support and physical cover must block`);
      assert(o.collider&&['box','sphere'].includes(o.collider.shape),`${game.id}/${o.id}: preserve explicit physical cover geometry`);
    }
    if(o.assetId&&/showcase-(tree|grass|flower)/.test(o.assetId)&&o.solid!==true)passable++;
  }if(count)games++;
}
assert(panels>=148&&games>=10,'all reproduced wall-panel content families covered');
assert(passable>0,'foliage remains passable; not a blanket solid conversion');
assert(pillars>=114,'reproduced pillar content family covered');
assert(computerBanks>=6,'all reproduced computer-bank content records covered');
assert.deepStrictEqual(fit('tree-pine',{positions:[]},1),{},'non-wall props keep authored policy');
const valley=JSON.parse(fs.readFileSync(path.join(root,'games/valley-run.json')));
for(const id of ['obj101','obj102','obj103','obj104']){
  const stone=valley.levels[0].objects.find(o=>o.id===id);
  assert.strictEqual(stone.solid,true,`Valley Run ${id}: advertised stepping stone must support actual jumps`);
}
const firstStone=valley.levels[0].objects.find(o=>o.id==='obj101');
assert.deepStrictEqual(firstStone.position,[0,.4,6],'Valley first stone remains within the native ridge jump route');
assert.deepStrictEqual(firstStone.scale,[2,.5,2],'Accessibility repair does not enlarge the platform');
const moving=JSON.parse(fs.readFileSync(path.join(root,'games/moving-temple.json'))).levels[0];
const survival3=JSON.parse(fs.readFileSync(path.join(root,'games/survival-arena-3.json')));
const hunter=survival3.prefabs.find(prefab=>prefab.name==='Hunter').record;
assert.strictEqual(hunter.ai.collideWithSolids,true,'Spawned Hunter cannot bypass the actual Defense transmitter');
assert.strictEqual(hunter.ai.collisionRadius,hunter.collider.radius,'Use the authored drone radius, not an enlarged obstacle');
const survival1=JSON.parse(fs.readFileSync(path.join(root,'games/survival-arena.json')));
const actorPolicy=require('../tools/real-demo-actor-policy');
for(const [game,ids]of Object.entries(actorPolicy.targets)){
 const project=JSON.parse(fs.readFileSync(path.join(root,'games',game+'.json')));
 for(const record of project.levels.flatMap(level=>level.objects).filter(record=>ids.includes(record.id))){
  if(record.isSpawnPoint){assert.strictEqual(game,'forest-range');assert.deepStrictEqual([record.position[0],record.position[2]],[-7,-7],'Forest arrival stays clear of physical waypoint rails/floor');assert(Number.isFinite(record.position[1]));continue;}
  assert.strictEqual(record.ai.collideWithSolids,true,`${game}/${record.id}: actual actor consumes the shared solid policy`);
  assert.strictEqual(record.ai.collisionRadius,game==='forest-range' ? (record.id==='obj823' ? .16 : .35) : record.collider.radius);
 }
}
{const project=JSON.parse(fs.readFileSync(path.join(root,'games/forest-range.json'))),spawn=project.levels[0].objects.find(o=>o.id==='obj394');const before=JSON.stringify(spawn);actorPolicy.apply(project,'forest-range');assert.strictEqual(JSON.stringify(spawn),before,'Measured terrain spawn repair is idempotent');spawn.position[0]=-9;assert.throws(()=>actorPolicy.apply(project,'forest-range'),/Preserve changed Forest arrival/,'Protect subsequently authored arrival rather than silently overwriting it');}
const iron=JSON.parse(fs.readFileSync(path.join(root,'games/iron-arena.json'))).levels[0];
const deck=iron.objects.find(record=>record.id==='deep3-5');
const sentinel=JSON.parse(fs.readFileSync(path.join(root,'games/sentinel-maze.json'))).levels[0],sentinelGuard=sentinel.objects.find(o=>o.id==='obj59');
assert.deepStrictEqual(sentinelGuard.position,[10,0,7.5],'Guardian starts clear of physical exit-arch post, on the existing maze floor');
assert.deepStrictEqual(sentinelGuard.ai.base,sentinelGuard.position,'Spawn repair preserves matching AI origin');
for(const actor of iron.objects.filter(record=>record.ai)){
 const dx=Math.max(0,Math.abs(actor.position[0]-deck.position[0])-deck.scale[0]/2),dz=Math.max(0,Math.abs(actor.position[2]-deck.position[2])-deck.scale[2]/2);
 assert(Math.hypot(dx,dz)>actor.collider.radius+.1,'Authored actor spawn clears the North fighting deck');
}
const silent=JSON.parse(fs.readFileSync(path.join(root,'games/silent-sector.json')));
for(const guard of silent.levels[0].objects.filter(record=>record.ai?.mode==='stateMachine')) {
  assert.strictEqual(guard.ai.collideWithSolids,true,'Guard movement cards must respect Shielded machinery');
  assert.strictEqual(guard.ai.collisionRadius,guard.collider.radius);
}
for(const drone of survival1.levels[0].objects.filter(record=>record.ai?.type==='follow')) {
  assert.strictEqual(drone.ai.collideWithSolids,true,'Arena drones cannot bypass actual Arena identity pillars');
  assert.strictEqual(drone.ai.collisionRadius,drone.collider.radius);
}
const crossing=moving.objects.find(o=>o.id==='obj57'),landing=moving.objects.find(o=>o.id==='obj58');
const end=crossing.animationClips.find(c=>c.name==='Cross').tracks.position.at(-1).value;
const gap=landing.position[0]-landing.scale[0]/2-end[0]-crossing.scale[0]/2;
assert(gap>=moving.playerSettings.collisionRadius*2+.2,'Crossing slab cannot crush the player into the landing slab');
console.log(`Real-demo architectural wall content: ${panels} measured solid panels across ${games} games; ${passable} passable foliage records preserved`);
