// --- Waypoint Graph pathfinding (Wave 4) ---
// A bounded navigation layer on top of Waypoint objects -- real A* over
// author-connected waypoints, NOT a navmesh (no dynamic obstacle avoidance
// beyond "the graph already routes around static walls because that's how
// the author connected it"). Deliberately separate from the existing Patrol
// Route AI type: Patrol Route visits an ORDERED list directly with no graph/
// pathfinding at all (unchanged); Navigate To Target (below) computes the
// shortest CONNECTED route to wherever a target currently is, recomputing
// periodically since the target moves -- the actual point of a real
// pathfinder rather than a fixed route.
function nearestWaypointTo(position) {
  let best = null, bestDist = Infinity;
  for (const item of placed) {
    if (!item.isWaypoint) continue;
    const d = item.entity.position.sub(position).length();
    if (d < bestDist) { bestDist = d; best = item; }
  }
  return best;
}
// Standard A* over the waypoint graph -- straight-line distance heuristic
// (admissible: never overestimates the true connected-path cost). Returns
// an array of waypoint ids from start to goal (inclusive), or null if the
// graph has no connected route between them.
function findWaypointPath(startId, goalId) {
  if(!findItemById(startId)?.isWaypoint||!findItemById(goalId)?.isWaypoint)return null;
  if (startId === goalId) return [startId];
  const dist = (a, b) => { const wa = findItemById(a), wb = findItemById(b); return wa && wb ? wa.entity.position.sub(wb.entity.position).length() : Infinity; };
  const open = new Set([startId]);
  const cameFrom = new Map();
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, dist(startId, goalId)]]);
  const guard = placed.length + 10; // cycle/runaway safety, not a real graph-size limit
  for (let step = 0; step < guard && open.size > 0; step++) {
    let current = null, currentF = Infinity;
    for (const id of open) { const f = fScore.get(id) ?? Infinity; if (f < currentF) { currentF = f; current = id; } }
    if (current === goalId) {
      const path = [current];
      while (cameFrom.has(current)) { current = cameFrom.get(current); path.unshift(current); }
      return path;
    }
    open.delete(current);
    const currentItem = findItemById(current);
    if (!currentItem) continue;
    for (const neighborId of (Array.isArray(currentItem.connections)?currentItem.connections:[])) {
      if (!findItemById(neighborId)?.isWaypoint) continue;
      const tentativeG = (gScore.get(current) ?? Infinity) + dist(current, neighborId);
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + dist(neighborId, goalId));
        open.add(neighborId);
      }
    }
  }
  return null; // no connected route
}
// Recomputes at most every `recomputeInterval` seconds, or immediately if
// there's no path yet -- not every frame, since A* over a real graph isn't
// free and the target rarely needs sub-second path updates to look correct.
function navigateToTargetTick(item, ai, pos, targetEntity, dt) {
  // Once the route through the graph is fully walked (navPathIndex reaches
  // the end), the AI is deliberately off-graph and steering straight for
  // the target's live position for the final stretch -- recomputing on the
  // usual timer in that state would find "the nearest waypoint to HERE"
  // (now off-graph, near wherever it currently is) and briefly steer back
  // toward it before continuing, a visible back-and-forth wobble with no
  // actual benefit. finishedRoute suppresses recompute for as long as the
  // AI stays off-graph; a genuinely new chase (new target, or called again
  // after losing/regaining a path) still recomputes normally via the
  // `!ai.navPath` branch below.
  const offGraph = ai.navPath && ai.navPathIndex >= ai.navPath.length;
  if (!offGraph) {
    ai.navRecomputeTimer = (ai.navRecomputeTimer || 0) - dt;
    if (!ai.navPath || ai.navRecomputeTimer <= 0) {
      ai.navRecomputeTimer = 0.75;
      // Seed the recompute from the waypoint the AI is CURRENTLY heading to,
      // not from nearestWaypointTo(pos) -- found by dogfooding Sentinel Maze:
      // when the AI is near the midpoint between two waypoints in its route,
      // "nearest to raw position" flip-flops between them every recompute,
      // resetting navPathIndex to 0 each time and making the AI oscillate
      // back and forth forever instead of progressing (it would re-walk
      // toward a waypoint it had already just passed). Continuing from the
      // in-progress target waypoint is stable under that flip-flop and still
      // correctly re-routes if the connected graph changed; nearestWaypointTo
      // is still used to seed a BRAND NEW chase (no path yet).
      const currentTargetWp = (ai.navPath && ai.navPathIndex < ai.navPath.length) ? findItemById(ai.navPath[ai.navPathIndex]) : null;
      const startWp = currentTargetWp || nearestWaypointTo(pos);
      const goalWp = nearestWaypointTo(targetEntity.position);
      ai.navPath = (startWp && goalWp) ? findWaypointPath(startWp.id, goalWp.id) : null;
      ai.navPathIndex = 0;
    }
  }
  // Follow the computed route through the graph, then the final unguided
  // stretch from the last waypoint to the target's actual live position --
  // matching how Patrol Route/Follow already move (direct steering, no
  // avoidance), just chained after a real connected route instead of one
  // straight line through a wall.
  let aimPos = targetEntity.position;
  if (ai.navPath && ai.navPathIndex < ai.navPath.length) {
    const wp = findItemById(ai.navPath[ai.navPathIndex]);
    if (wp) {
      aimPos = wp.entity.position;
      // Navigation movement is XZ and retains the actor's height. Marker Y
      // must not strand an actor that has already reached the horizontal node.
      if (Math.hypot(pos.x-wp.entity.position.x,pos.z-wp.entity.position.z) < 0.4) ai.navPathIndex += 1;
    } else {
      ai.navPath = null; // a waypoint in the route vanished -- force a clean recompute next tick
    }
  }
  const toAim = aimPos.sub(pos);
  toAim.y = 0;
  const d = toAim.length();
  if (d > 0.1) {
    const step = toAim.scale(Math.min(1, (ai.speed * dt) / d));
    pos.set(pos.x + step.x, pos.y, pos.z + step.z);
  }
}
// Wave 7 (Priority D): the entire pre-Wave-7 movement dispatch, pulled into
// its own function so BOTH the existing "Simple" single-type AI (unchanged
// call site, `ai` itself) and the new State Machine (a state's own
// `movement` sub-object, shaped identically to `ai`) drive movement through
// the exact same code -- a state's `movement` is not a second movement
// language, just the same fields on a different, per-state object (so
// `resolvedWaypointIds`/`wanderTarget`/`navPath`-style per-run caches stay
// correctly scoped to whichever state actually owns them).
function applyAiMovementStep(item, ai, pos, dt, elapsed) {
  // Opt-in on the owning actor, including State Machine movement cards.
  // Historical path/orbit animation and platform translation stay unchanged.
  const collisionPolicy = item.entity.ai;
  const previousPosition = collisionPolicy && collisionPolicy.collideWithSolids === true ? pos.clone() : null;
  // No runtime target is saved and retargeting never touches attack deadlines.
  // Absent/fixed selection preserves historical strict named-target/Player semantics.
  let followTargetEntity = null;
  if (ai.targetSelection === 'nearestTag') {
    const tag = ai.targetTag, range = ai.targetRange;
    if (typeof tag === 'string' && tag && tag.trim() === tag && Number.isFinite(range) && range >= 0 &&
        [pos.x,pos.y,pos.z].every(Number.isFinite)) {
      let nearestDistance = Infinity, nearestId = null;
      for (const candidate of placed) {
        const entity = candidate?.entity, point = entity?.position;
        if (candidate === item || candidate?.kind !== 'cube' || !entity || entity.destroyed || entity.visible === false ||
            typeof candidate.id !== 'string' || !candidate.id || !Array.isArray(candidate.tags) || !candidate.tags.includes(tag) ||
            !point || ![point.x,point.y,point.z].every(Number.isFinite) ||
            (candidate.health != null && (!Number.isFinite(candidate.health.current) || candidate.health.current <= 0))) continue;
        const distance = Math.hypot(point.x-pos.x,point.y-pos.y,point.z-pos.z);
        if (Number.isFinite(distance) && distance <= range &&
            (distance < nearestDistance || (distance === nearestDistance && candidate.id < nearestId))) {
          followTargetEntity = entity; nearestDistance = distance; nearestId = candidate.id;
        }
      }
    }
  } else if (ai.targetSelection === undefined || ai.targetSelection === 'fixed') {
    followTargetEntity = ai.targetId ? targetEntity(findItemById(ai.targetId)) : (player ? player.entity : null);
  }
  if (ai.type === 'follow' && followTargetEntity) {
    const toTarget = followTargetEntity.position.sub(pos);
    toTarget.y = 0;
    const dist = toTarget.length();
    if (dist > 0.1) {
      const step = toTarget.scale(Math.min(1, (ai.speed * dt) / dist));
      pos.set(pos.x + step.x, pos.y, pos.z + step.z);
    }
  } else if (ai.type === 'followPath' && ai.pathId) {
    // Wave 8 (Priority I, Sections 58-59): Follow Path -- reusing the SAME
    // shared movement dispatch every other AI/State-Machine movement type
    // already funnels through (so a moving platform, an ordinary AI
    // character, AND a State Machine state's own `movement.type` can all
    // use it for free, zero special-casing per consumer). `ai._pathT`
    // (normalized [0,1] progress) advances by real speed-in-units/second
    // divided by the path's own real sampled length (cached, recomputed
    // if the path reference changes), not a fixed per-tick t-step -- so
    // Speed genuinely means "units per second" regardless of how many/how
    // far apart a path's own control points are.
    const pathItem = findItemById(ai.pathId);
    if (pathItem && pathItem.kind === 'path' && pathItem.pointIds && pathItem.pointIds.length > 1) {
      if (ai._pathLengthFor !== ai.pathId) {
        let len = 0;
        const SAMPLES = 40;
        let prev = samplePathPosition(pathItem, 0);
        for (let s = 1; s <= SAMPLES; s++) { const cur = samplePathPosition(pathItem, s / SAMPLES); len += cur.sub(prev).length(); prev = cur; }
        ai._pathLength = Math.max(0.01, len);
        ai._pathLengthFor = ai.pathId;
        ai._pathT = ai._pathT || 0;
        ai._pathDir = ai._pathDir || 1;
      }
      const dt_t = ((ai.speed || 2) * dt) / ai._pathLength;
      if (pathItem.loop) {
        ai._pathT = (ai._pathT + dt_t) % 1;
        if (ai._pathT < 0) ai._pathT += 1;
      } else if (ai.pingpong) {
        ai._pathT += dt_t * ai._pathDir;
        if (ai._pathT >= 1) { ai._pathT = 1; ai._pathDir = -1; }
        else if (ai._pathT <= 0) { ai._pathT = 0; ai._pathDir = 1; }
      } else {
        ai._pathT = Math.min(1, ai._pathT + dt_t);
      }
      const target = samplePathPosition(pathItem, ai._pathT);
      pos.set(target.x, target.y, target.z);
    }
  } else if (ai.type === 'flee' && player) {
    const away = pos.sub(player.entity.position);
    away.y = 0;
    const dist = away.length();
    if (dist > 0.1 && dist < ai.radius) {
      const step = away.normalize().scale(Math.min(dist, ai.speed * dt));
      pos.set(pos.x + step.x, pos.y, pos.z + step.z);
    }
  } else if (ai.type === 'faceTarget' && followTargetEntity) {
    const toTarget = followTargetEntity.position.sub(pos);
    if (Math.hypot(toTarget.x, toTarget.z) > 0.05) item.entity.rotationY = Math.atan2(toTarget.x, toTarget.z);
  } else if (ai.type === 'patrolRoute') {
    if (!ai.resolvedWaypointIds) {
      const names = (ai.waypointNames || '').split(',').map((s) => s.trim()).filter(Boolean);
      ai.resolvedWaypointIds = names
        .map((name) => placed.find((p) => p.isWaypoint && p.name === name))
        .filter(Boolean)
        .map((p) => p.id);
      ai.currentWaypointIndex = 0;
      ai.direction = 1;
    }
    const routeIds = ai.resolvedWaypointIds;
    if (routeIds.length > 0) {
      const target = findItemById(routeIds[ai.currentWaypointIndex]);
      if (target) {
        const toTarget = target.entity.position.sub(pos);
        toTarget.y = 0;
        const dist = toTarget.length();
        if (dist > 0.15) {
          const step = toTarget.scale(Math.min(1, (ai.speed * dt) / dist));
          pos.set(pos.x + step.x, pos.y, pos.z + step.z);
        } else if (ai.pingpong && routeIds.length > 1) {
          const next = ai.currentWaypointIndex + ai.direction;
          if (next < 0 || next >= routeIds.length) { ai.direction *= -1; ai.currentWaypointIndex += ai.direction; }
          else ai.currentWaypointIndex = next;
        } else {
          ai.currentWaypointIndex += 1;
          if (ai.currentWaypointIndex >= routeIds.length) ai.currentWaypointIndex = ai.loop ? 0 : routeIds.length - 1;
        }
      }
    }
  } else if (ai.type === 'navigateToTarget' && followTargetEntity) {
    navigateToTargetTick(item, ai, pos, followTargetEntity, dt);
  } else if (ai.type === 'orbit') {
    // Wave 7 (Priority D/M): a State Machine state's own `movement` object
    // has no author-facing "base" field in the v1 card UI (unlike ordinary
    // Simple-AI, whose `ai.base` is always set when Orbit/Wander is first
    // chosen via placeItem/Create Animated Enemy) -- lazily anchor to
    // wherever this AI actually is the first time Orbit/Wander runs on it,
    // rather than crashing on a real, found-via-dogfood gap. Harmless no-op
    // for the ordinary Simple-AI path, which already always has `ai.base`.
    if (!ai.base) ai.base = pos.clone();
    ai.angle = (ai.angle || 0) + (ai.speed * dt) / Math.max(0.5, ai.radius);
    // Canonical Brain capture stores anchors as portable XYZ arrays, including
    // State Machine movement slots. Read either representation without changing
    // authored data or replacing an existing anchor with the current position.
    const orbitBase = Array.isArray(ai.base) ? new Opus.Vec3(...ai.base) : ai.base;
    pos.set(orbitBase.x + Math.cos(ai.angle) * ai.radius, pos.y, orbitBase.z + Math.sin(ai.angle) * ai.radius);
  } else if (ai.type === 'investigate') {
    // Wave 9 (Priority B, Sections 35-36): move toward the last heard noise
    // position via direct movement (no new pathfinder, per Section 36) --
    // stops once within 0.5 units, leaving the character facing where the
    // noise came from until a transition (e.g. `timeInStateAtLeast`) moves
    // it on to Search/Patrol. No noise heard yet at all is a harmless no-op
    // (stands still) rather than a crash.
    const target = item._lastHeardNoisePos;
    if (target) {
      const toTarget = target.sub(pos);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist > 0.5) {
        const step = toTarget.scale(Math.min(1, (ai.speed * dt) / dist));
        pos.set(pos.x + step.x, pos.y, pos.z + step.z);
        item.entity.rotationY = Math.atan2(toTarget.x, toTarget.z);
      }
    }
  } else if (ai.type === 'wander') {
    if (ai.restartOnEnter===true) { if(!ai._entryBase)ai._entryBase=pos.clone(); }
    else if (!ai.base) ai.base = pos.clone();
    const authoredBase=ai.restartOnEnter===true?ai._entryBase:ai.base;
    const wanderBase=Array.isArray(authoredBase)?new Opus.Vec3(...authoredBase):authoredBase;
    ai.wanderTimer = (ai.wanderTimer || 0) - dt;
    if (!ai.wanderTarget || ai.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * ai.radius;
      ai.wanderTarget = new Opus.Vec3(wanderBase.x + Math.cos(angle) * r, pos.y, wanderBase.z + Math.sin(angle) * r);
      ai.wanderTimer = 1.5 + Math.random() * 2;
    }
    const toTarget = ai.wanderTarget.sub(pos);
    toTarget.y = 0;
    const dist = toTarget.length();
    if (dist > 0.1) {
      const step = toTarget.scale(Math.min(1, (ai.speed * dt) / dist));
      pos.set(pos.x + step.x, pos.y, pos.z + step.z);
    }
  }
  if (previousPosition) resolveAiSolidMovement(item, previousPosition, dt);
  return followTargetEntity;
}
// Reuse the actor's opted-in legacy solid policy for every kinematic segment,
// including hit reaction. A later AI tick cannot recover a push that already
// crossed a thin wall because its starting position is then on the far side.
function resolveAiSolidMovement(item, previousPosition, dt) {
  const collisionPolicy = item.entity.ai;
  const pos = item.entity.position;
  if (collisionPolicy && collisionPolicy.collideWithSolids === true && (pos.x !== previousPosition.x || pos.z !== previousPosition.z)) {
    const radius = Number.isFinite(collisionPolicy.collisionRadius) && collisionPolicy.collisionRadius > 0 ? collisionPolicy.collisionRadius : 0.35;
    const height = Math.max(0.1, Math.abs(item.entity.scale.y));
    let velocity = pos.sub(previousPosition).scale(1 / Math.max(dt, 1e-6));
    for (const obstacle of placed) {
      if (obstacle === item || !obstacle.entity || obstacle.entity.solid !== true || obstacle.entity.visible === false || obstacle.kind === 'ramp') continue;
      const cfg = itemColliderConfig(obstacle), center = obstacle.entity.position.add(cfg.offset);
      const halfY = cfg.shape === 'box' ? cfg.half.y : cfg.radius;
      // Actor origins are feet. Supporting floors are not horizontal walls;
      // neither are ceilings or solids entirely below the actor.
      if (center.y + halfY <= Math.min(previousPosition.y, pos.y) + 0.05 || center.y - halfY >= Math.max(previousPosition.y, pos.y) + height) continue;
      const hit = resolveItemColliderCollision(pos, velocity, radius, obstacle, previousPosition);
      if (hit.collided) { pos.set(hit.correctedPosition.x, pos.y, hit.correctedPosition.z); velocity = hit.correctedVelocity; }
    }
  }
}
// Enemy ranged attack (Wave 4) -- likewise pulled into its own function so
// a State Machine state's own `attack` sub-object (same field names:
// attackEnabled/attackPrefab/attackRadius/attackCooldown/attackDamage/
// attackSpeed) drives it identically to `ai` itself.
function applyAiAttackStep(item, ai, pos, followTargetEntity, elapsed) {
  // A real shot needs a usable, unique single-Cube Prefab. Retained missing or
  // assembly references remain authored but cannot crash or consume a fake shot.
  if(aiProjectilePrefabIssue(ai.attackPrefab))return;
  if (ai.attackEnabled && ai.attackPrefab && followTargetEntity) {
    const distToTarget = followTargetEntity.position.sub(pos).length();
    if (distToTarget <= (ai.attackRadius || 8)) {
      ai._attackCooldownUntil = ai._attackCooldownUntil || 0;
      if (elapsed >= ai._attackCooldownUntil) {
        ai._attackCooldownUntil = elapsed + (ai.attackCooldown || 1.5);
        const dir = followTargetEntity.position.sub(pos);
        fireProjectile(ai.attackPrefab, pos.clone(), dir, ai.attackSpeed || 12, ai.attackDamage ?? 10, item.tags && item.tags[0], 3, 0.3, 0, '', undefined, ai.attackDamageType);
        triggerCharacterAttackAnim(item);
      }
    }
  }
}
