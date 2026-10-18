class AABB {
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }

  static fromCenterSize(center, size) {
    const half = size.scale(0.5);
    return new AABB(center.sub(half), center.add(half));
  }

  containsPoint(p) {
    return p.x >= this.min.x && p.x <= this.max.x
      && p.y >= this.min.y && p.y <= this.max.y
      && p.z >= this.min.z && p.z <= this.max.z;
  }

  intersectsAABB(other) {
    return this.min.x <= other.max.x && this.max.x >= other.min.x
      && this.min.y <= other.max.y && this.max.y >= other.min.y
      && this.min.z <= other.max.z && this.max.z >= other.min.z;
  }
}

function sphereSphereIntersect(centerA, radiusA, centerB, radiusB) {
  const r = radiusA + radiusB;
  return centerA.sub(centerB).dot(centerA.sub(centerB)) <= r * r;
}

// dir must be normalized. Returns nearest positive hit distance, or null.
function raySphere(origin, dir, center, radius) {
  const oc = origin.sub(center);
  const b = oc.dot(dir);
  const c = oc.dot(oc) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  const t0 = -b - sqrtDisc;
  const t1 = -b + sqrtDisc;
  const t = t0 >= 0 ? t0 : t1;
  return t >= 0 ? t : null;
}

// Slab method. dir must be normalized. Returns nearest positive hit distance, or null.
function rayAABB(origin, dir, box) {
  let tMin = -Infinity;
  let tMax = Infinity;
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const lo = [box.min.x, box.min.y, box.min.z];
  const hi = [box.max.x, box.max.y, box.max.z];

  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < lo[i] || o[i] > hi[i]) return null;
      continue;
    }
    let t1 = (lo[i] - o[i]) / d[i];
    let t2 = (hi[i] - o[i]) / d[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin >= 0 ? tMin : (tMax >= 0 ? tMax : null);
}

// Stateless finite-segment query for an opt-in chase camera. Box expansion is
// deliberately conservative at corners (not a new mesh/terrain collision system).
// A target already inside an expanded obstacle has no valid segment-side entry;
// ignore that container rather than interpreting rayAABB/raySphere's EXIT as entry
// or inventing global depenetration. Other obstacles still participate normally.
function cameraObstructionDistance(origin, desiredEye, radius, obstacles) {
  const delta = desiredEye.sub(origin), length = delta.length();
  if (!Number.isFinite(length) || length < 1e-6) return null;
  const direction = delta.scale(1 / length);
  const validVector = value => value instanceof Vec3 && [value.x, value.y, value.z].every(Number.isFinite);
  let nearest = null;
  for (const obstacle of obstacles) {
    if (!obstacle || !validVector(obstacle.center)) continue;
    let hit;
    if (obstacle.shape === 'sphere') {
      if (!Number.isFinite(obstacle.radius) || obstacle.radius <= 0) continue;
      const expanded = obstacle.radius + radius;
      if (!Number.isFinite(expanded) || origin.sub(obstacle.center).length() <= expanded) continue;
      hit = raySphere(origin, direction, obstacle.center, expanded);
    } else if (obstacle.shape === 'box') {
      if (!validVector(obstacle.half) || [obstacle.half.x, obstacle.half.y, obstacle.half.z].some(n => n <= 0)) continue;
      const q = obstacle.quat;
      if (q != null && (!(q instanceof Quat) || ![q.x, q.y, q.z, q.w].every(Number.isFinite) || Math.abs(q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w - 1) > 1e-4)) continue;
      const localOrigin = q ? q.conjugate().rotateVec3(origin.sub(obstacle.center)) : origin.sub(obstacle.center);
      const localDirection = q ? q.conjugate().rotateVec3(direction) : direction;
      const half = obstacle.half.add(new Vec3(radius, radius, radius));
      if (![half.x, half.y, half.z].every(Number.isFinite)) continue;
      const box = new AABB(half.scale(-1), half);
      if (box.containsPoint(localOrigin)) continue;
      hit = rayAABB(localOrigin, localDirection, box);
    } else continue;
    if (hit !== null && Number.isFinite(hit) && hit >= 0 && hit <= length && (nearest === null || hit < nearest)) nearest = hit;
  }
  return nearest;
}

class TriggerVolume {
  // Wave 6 (Priority A/Section 8): `shape` is optional and defaults to
  // 'sphere' -- every pre-Wave-6 caller (which never passed `shape`/`half`/
  // `quat` at all) gets EXACTLY its old sphere-only behavior, unchanged.
  // 'box' is the fix for the long-standing "a Trigger Volume always LOOKED
  // like a box but always BEHAVED like a giant sphere" mismatch: a wide
  // flat Box Trigger now actually has a wide flat hit-test, not a sphere
  // sized off its longest horizontal edge.
  constructor({ center, radius, shape, half, quat, onEnter, onExit, onStay }) {
    vector(center, 'options.center', 'Physics.TriggerVolume');
    this.shape = shape === 'box' ? 'box' : 'sphere';
    if (this.shape === 'sphere') {
      positive(radius, 'options.radius', 'Physics.TriggerVolume');
    } else {
      vector(half, 'options.half', 'Physics.TriggerVolume');
    }
    callback(onEnter, 'options.onEnter', 'Physics.TriggerVolume', true);
    callback(onExit, 'options.onExit', 'Physics.TriggerVolume', true);
    callback(onStay, 'options.onStay', 'Physics.TriggerVolume', true);
    this.center = center;
    this.radius = radius;
    this.half = half;
    this.quat = quat || null;
    this.onEnter = onEnter;
    this.onExit = onExit;
    this.onStay = onStay;
    this.inside = false;
  }

  // Local-space helpers shared by containment and the swept ray check below
  // -- the exact same "rotate into the box's own unrotated frame" technique
  // resolveOrientedBoxCollision already established, so a rotated Box
  // Trigger is just as accurate as a rotated Box Collider.
  _toLocal(point) {
    const rel = point.sub(this.center);
    return this.quat ? this.quat.conjugate().rotateVec3(rel) : rel;
  }

  containsPoint(point) {
    if (this.shape === 'sphere') return point.sub(this.center).length() <= this.radius;
    const local = this._toLocal(point);
    return Math.abs(local.x) <= this.half.x && Math.abs(local.y) <= this.half.y && Math.abs(local.z) <= this.half.z;
  }

  update(point, previousPoint = point) {
    vector(point, 'point', 'TriggerVolume.update');
    vector(previousPoint, 'previousPoint', 'TriggerVolume.update');
    const nowInside = this.containsPoint(point);
    const delta = point.sub(previousPoint);
    const distance = delta.length();
    let hit = null;
    if (distance > 0) {
      const dir = delta.scale(1 / distance);
      if (this.shape === 'sphere') {
        hit = raySphere(previousPoint, dir, this.center, this.radius);
      } else {
        const localOrigin = this._toLocal(previousPoint);
        const localDir = this.quat ? this.quat.conjugate().rotateVec3(dir) : dir;
        const localBox = new AABB(
          new Vec3(-this.half.x, -this.half.y, -this.half.z),
          new Vec3(this.half.x, this.half.y, this.half.z),
        );
        hit = rayAABB(localOrigin, localDir, localBox);
      }
    }
    if ((nowInside || hit !== null && hit <= distance) && !this.inside) {
      this.inside = true;
      if (this.onEnter) this.onEnter();
    }
    if (!nowInside && this.inside) {
      this.inside = false;
      if (this.onExit) this.onExit();
    }
    // Fires every update() call the point is inside, including the frame it
    // just entered on -- callers wanting a slower cadence (e.g. damage every
    // N seconds while standing in lava) own their own cooldown timing on top
    // of this, the same way the editor's repeat-on-stay Damage Zone does.
    if (this.inside && this.onStay) this.onStay();
  }
}

// Slope normal calculation helper using finite differences around (x, z)
function sampleTerrainNormal(x, z, opts, delta = 0.2) {
  const hL = islandHeight(x - delta, z, opts);
  const hR = islandHeight(x + delta, z, opts);
  const hD = islandHeight(x, z - delta, opts);
  const hU = islandHeight(x, z + delta, opts);
  const nX = (hL - hR) / (2 * delta);
  const nZ = (hD - hU) / (2 * delta);
  return new Vec3(nX, 1.0, nZ).normalize();
}

function resolveTerrainCollision(position, velocity, radius = 0.5, terrainOpts = {}) {
  // position/velocity/the returned corrections are all world-space; height
  // sampling below is local to the terrain, so world coords must be offset
  // by the terrain's own position first (same convention as the per-instance
  // .sampleHeight()/.sampleNormal() handles) — this was previously missing,
  // so collision only ever worked correctly for terrain placed at world origin.
  const originX = terrainOpts.position ? terrainOpts.position.x : 0;
  const originY = terrainOpts.position ? terrainOpts.position.y : 0;
  const originZ = terrainOpts.position ? terrainOpts.position.z : 0;
  const x = position.x - originX;
  const z = position.z - originZ;
  const halfSize = (terrainOpts.size ?? 22) * 0.5;
  const inBounds = Math.abs(x) <= halfSize && Math.abs(z) <= halfSize;
  const terrainHeight = (inBounds ? islandHeight(x, z, terrainOpts) : (terrainOpts.oceanFloor ?? -2.4)) + originY;
  const normal = sampleTerrainNormal(x, z, terrainOpts);

  const slopeRadians = Math.acos(Math.max(-1.0, Math.min(1.0, normal.y)));
  const maxDriveSlope = 0.75; // ~43 degrees
  const steep = slopeRadians > maxDriveSlope;

  let collided = false;
  let grounded = false;
  const correctedPosition = position.clone();
  const correctedVelocity = velocity.clone();

  // Bottom of object
  const bottomY = position.y - radius;

  if (bottomY < terrainHeight) {
    collided = true;
    grounded = true;

    if (steep) {
      // Steep terrain acts as a wall / barrier: project velocity along slope tangent
      const dot = correctedVelocity.dot(normal);
      if (dot < 0) {
        // Remove velocity moving into the steep slope
        const proj = normal.scale(dot);
        const slided = correctedVelocity.sub(proj);
        correctedVelocity.x = slided.x * 0.85;
        correctedVelocity.y = slided.y * 0.85;
        correctedVelocity.z = slided.z * 0.85;
      }
      // Push position outward along normal horizontal component
      const horizontalNormal = new Vec3(normal.x, 0, normal.z).normalize();
      const penetration = terrainHeight - bottomY;
      correctedPosition.x += horizontalNormal.x * penetration * 0.8;
      correctedPosition.z += horizontalNormal.z * penetration * 0.8;
      correctedPosition.y = terrainHeight + radius;
    } else {
      // Gentle terrain: set height to terrain surface + radius
      correctedPosition.y = terrainHeight + radius;
      if (correctedVelocity.y < 0) correctedVelocity.y = 0;
    }
  }

  return {
    collided,
    grounded,
    steep,
    terrainHeight,
    slopeRadians,
    normal,
    correctedPosition,
    correctedVelocity,
    inBounds,
  };
}

function applyMapBoundary(position, velocity, radius = 0.5, boundaryRadius = 18.0) {
  const dist = Math.hypot(position.x, position.z);
  const maxAllowed = Math.max(0.1, boundaryRadius - radius);

  const correctedPosition = position.clone();
  const correctedVelocity = velocity.clone();
  let warning = false;
  let intensity = 0;

  const warningStart = maxAllowed * 0.8;
  if (dist > warningStart) {
    warning = true;
    intensity = Math.min(1.0, (dist - warningStart) / Math.max(0.001, maxAllowed - warningStart));
    if (dist > 0) {
      const nx = position.x / dist;
      const nz = position.z / dist;
      const outward = correctedVelocity.x * nx + correctedVelocity.z * nz;
      const inwardStrength = intensity * intensity * 0.35;
      if (outward > -inwardStrength) {
        const adjustment = (outward + inwardStrength) * Math.min(1, 0.15 + intensity * 0.35);
        correctedVelocity.x -= nx * adjustment;
        correctedVelocity.z -= nz * adjustment;
      }
    }
  }

  if (dist > maxAllowed) {
    const overflow = dist - maxAllowed;
    const nx = position.x / dist;
    const nz = position.z / dist;

    // Correct progressively without teleporting to the edge.
    const correction = Math.min(overflow, 0.12 + overflow * 0.35);
    correctedPosition.x -= nx * correction;
    correctedPosition.z -= nz * correction;

    // Apply inward force to velocity
    const normalDir = new Vec3(nx, 0, nz);
    const velDot = correctedVelocity.dot(normalDir);
    if (velDot > 0) {
      // Moving outwards: damp outward velocity and apply inward bounce
      correctedVelocity.x -= normalDir.x * velDot * 1.5;
      correctedVelocity.z -= normalDir.z * velDot * 1.5;
    }
  }

  return {
    warning,
    intensity,
    correctedPosition,
    correctedVelocity,
  };
}

// Circle-vs-AABB collision, resolved in the XZ plane only -- deliberately
// not full 3D sphere-vs-box, since every mover this engine has (a hovering
// craft) is already height-managed separately by terrain/water sampling;
// a horizontal-only push is the correct fix for "an object physically
// blocks the craft," the actual gap this closes (see AABB above, which
// already existed for picking/queries but had no collision RESOLUTION).
// box: { min: {x,z}, max: {x,z} } in world space (Y ignored).
function resolveBoxCollision(position, velocity, radius, box) {
  const closestX = Math.max(box.min.x, Math.min(position.x, box.max.x));
  const closestZ = Math.max(box.min.z, Math.min(position.z, box.max.z));
  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  const distSq = dx * dx + dz * dz;

  const correctedPosition = position.clone();
  const correctedVelocity = velocity.clone();
  let collided = false;

  if (distSq < radius * radius) {
    collided = true;
    const dist = Math.sqrt(distSq);
    let nx; let nz;
    if (dist > 1e-6) {
      // Outside the box but within radius of its nearest edge/corner: push
      // out along the vector from that nearest point to the mover.
      nx = dx / dist;
      nz = dz / dist;
    } else {
      // Mover's center is exactly on or inside the box edge (dist ~0, e.g.
      // clipped through a thin wall in one frame) -- push out along
      // whichever axis has the least penetration, a standard AABB
      // resolution fallback for the degenerate "already inside" case.
      const penLeft = position.x - box.min.x;
      const penRight = box.max.x - position.x;
      const penDown = position.z - box.min.z;
      const penUp = box.max.z - position.z;
      const minPen = Math.min(penLeft, penRight, penDown, penUp);
      if (minPen === penLeft) { nx = -1; nz = 0; }
      else if (minPen === penRight) { nx = 1; nz = 0; }
      else if (minPen === penDown) { nx = 0; nz = -1; }
      else { nx = 0; nz = 1; }
    }
    const penetration = radius - dist;
    correctedPosition.x += nx * penetration;
    correctedPosition.z += nz * penetration;
    const outward = correctedVelocity.x * nx + correctedVelocity.z * nz;
    if (outward < 0) {
      correctedVelocity.x -= nx * outward;
      correctedVelocity.z -= nz * outward;
    }
  }

  return { collided, correctedPosition, correctedVelocity };
}

// Wave 6 (Priority A/Section 5): the oriented generalization of
// resolveBoxCollision above -- a rotated wall/door/box collider should
// physically block a mover along its ACTUAL rotated edges, not its
// axis-aligned world bounding footprint. Deliberately built by REUSING
// resolveBoxCollision's own exact math rather than a second XZ-circle-vs-box
// implementation: transform the mover into the box's own local (unrotated)
// frame via the box's world quaternion, run the identical logic there
// against a plain axis-aligned local box, then rotate the correction back
// out to world space. `obb` is `{ center: Vec3, half: Vec3, quat: Opus.Quat
// | null }` -- an absent/identity quat degenerates to EXACTLY
// resolveBoxCollision's own axis-aligned answer (proven bit-exact by the
// dedicated regression test), so every pre-Wave-6 unrotated solid is
// completely unaffected by routing through this function instead.
// Y is passed through the rotation too (harmless -- resolveBoxCollision
// never reads or writes position.y/velocity.y) rather than special-cased
// out, since a plain 3D quaternion rotation is simpler than reconstructing
// a yaw-only 2D rotation separately.
function resolveOrientedBoxCollision(position, velocity, radius, obb) {
  const quat = obb.quat;
  const rel = position.sub(obb.center);
  const localPos = quat ? quat.conjugate().rotateVec3(rel) : rel;
  const localVel = quat ? quat.conjugate().rotateVec3(velocity) : velocity.clone();
  const localBox = new AABB(
    new Vec3(-obb.half.x, -obb.half.y, -obb.half.z),
    new Vec3(obb.half.x, obb.half.y, obb.half.z),
  );
  const local = resolveBoxCollision(localPos, localVel, radius, localBox);
  if (!local.collided) return { collided: false, correctedPosition: position.clone(), correctedVelocity: velocity.clone() };
  const correctedPosition = (quat ? quat.rotateVec3(local.correctedPosition) : local.correctedPosition).add(obb.center);
  const correctedVelocity = quat ? quat.rotateVec3(local.correctedVelocity) : local.correctedVelocity;
  return { collided: true, correctedPosition, correctedVelocity };
}

// Continuous XZ collision for fast movers. Callers retain the ordinary
// overlap resolver first; this catches crossing a thin wall in one frame.
function resolveSweptOrientedBoxCollision(previousPosition, position, velocity, radius, obb) {
  const quat = obb.quat;
  const inverse = quat ? quat.conjugate() : null;
  const toLocal = (point) => {
    const relative = point.sub(obb.center);
    return inverse ? inverse.rotateVec3(relative) : relative;
  };
  const start = toLocal(previousPosition);
  const end = toLocal(position);
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const minX = -obb.half.x - radius;
  const maxX = obb.half.x + radius;
  const minZ = -obb.half.z - radius;
  const maxZ = obb.half.z + radius;
  let enter = 0;
  let exit = 1;
  let normalX = 0;
  let normalZ = 0;
  const slab = (startValue, delta, min, max, axis) => {
    if (Math.abs(delta) < 1e-9) return startValue >= min && startValue <= max;
    let near = (min - startValue) / delta;
    let far = (max - startValue) / delta;
    let nearSign = -1;
    if (near > far) { [near, far] = [far, near]; nearSign = 1; }
    if (near > enter) {
      enter = near;
      normalX = axis === 'x' ? nearSign : 0;
      normalZ = axis === 'z' ? nearSign : 0;
    }
    exit = Math.min(exit, far);
    return enter <= exit;
  };
  if (!slab(start.x, deltaX, minX, maxX, 'x')
      || !slab(start.z, deltaZ, minZ, maxZ, 'z')
      || enter < 0 || enter > 1
      || (normalX === 0 && normalZ === 0)) {
    return { collided: false, correctedPosition: position.clone(), correctedVelocity: velocity.clone() };
  }
  const hitLocal = new Vec3(start.x + deltaX * enter + normalX * 1e-4, end.y, start.z + deltaZ * enter + normalZ * 1e-4);
  const localVelocity = inverse ? inverse.rotateVec3(velocity) : velocity.clone();
  const inward = localVelocity.x * normalX + localVelocity.z * normalZ;
  if (inward < 0) {
    localVelocity.x -= normalX * inward;
    localVelocity.z -= normalZ * inward;
  }
  const correctedPosition = (quat ? quat.rotateVec3(hitLocal) : hitLocal).add(obb.center);
  const correctedVelocity = quat ? quat.rotateVec3(localVelocity) : localVelocity;
  return { collided: true, correctedPosition, correctedVelocity,
    timeOfImpact: enter, contactNormal: quat ? quat.rotateVec3(new Vec3(normalX, 0, normalZ)) : new Vec3(normalX, 0, normalZ) };
}

// Wave 6 (Priority A/Section 7): circle-vs-circle collision in the XZ
// plane, the Sphere Collider's own resolution -- same "walls push
// horizontally, Y is left to terrain/water/vertical-box height handling"
// scoping every other solid-push function here already commits to, and the
// exact same structure as resolveBoxCollision (degenerate exactly-centered
// case pushes along a fixed deterministic direction rather than leaving the
// mover stuck with an undefined normal).
function resolveSphereCollision(position, velocity, radius, center, colliderRadius) {
  const dx = position.x - center.x;
  const dz = position.z - center.z;
  const distSq = dx * dx + dz * dz;
  const minDist = radius + colliderRadius;

  const correctedPosition = position.clone();
  const correctedVelocity = velocity.clone();
  let collided = false;

  if (distSq < minDist * minDist) {
    collided = true;
    const dist = Math.sqrt(distSq);
    let nx; let nz;
    if (dist > 1e-6) {
      nx = dx / dist;
      nz = dz / dist;
    } else {
      nx = 1;
      nz = 0;
    }
    const penetration = minDist - dist;
    correctedPosition.x += nx * penetration;
    correctedPosition.z += nz * penetration;
    const outward = correctedVelocity.x * nx + correctedVelocity.z * nz;
    if (outward < 0) {
      correctedVelocity.x -= nx * outward;
      correctedVelocity.z -= nz * outward;
    }
  }

  return { collided, correctedPosition, correctedVelocity };
}

// Segment-vs-expanded-circle companion to resolveSphereCollision.
function resolveSweptSphereCollision(previousPosition, position, velocity, radius, center, colliderRadius) {
  const sx = previousPosition.x - center.x;
  const sz = previousPosition.z - center.z;
  const dx = position.x - previousPosition.x;
  const dz = position.z - previousPosition.z;
  const expanded = radius + colliderRadius;
  const a = dx * dx + dz * dz;
  const b = 2 * (sx * dx + sz * dz);
  const c = sx * sx + sz * sz - expanded * expanded;
  const discriminant = b * b - 4 * a * c;
  if (a < 1e-12 || c <= 0 || discriminant < 0) {
    return { collided: false, correctedPosition: position.clone(), correctedVelocity: velocity.clone() };
  }
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (t < 0 || t > 1) return { collided: false, correctedPosition: position.clone(), correctedVelocity: velocity.clone() };
  const hitX = previousPosition.x + dx * t;
  const hitZ = previousPosition.z + dz * t;
  const length = Math.hypot(hitX - center.x, hitZ - center.z) || 1;
  const nx = (hitX - center.x) / length;
  const nz = (hitZ - center.z) / length;
  const correctedPosition = position.clone();
  correctedPosition.x = hitX + nx * 1e-4;
  correctedPosition.z = hitZ + nz * 1e-4;
  const correctedVelocity = velocity.clone();
  const inward = correctedVelocity.x * nx + correctedVelocity.z * nz;
  if (inward < 0) {
    correctedVelocity.x -= nx * inward;
    correctedVelocity.z -= nz * inward;
  }
  return { collided: true, correctedPosition, correctedVelocity,
    timeOfImpact: t, contactNormal: new Vec3(nx, 0, nz) };
}

// The vertical (Y-aware) half of "a solid object can be a platform" --
// resolveBoxCollision above deliberately stays XZ-only (every existing
// mover is height-managed by terrain/water instead), so a mover that wants
// to actually LAND on top of a box, or bonk its head on the underside while
// jumping into one, needs this instead. Bounded on purpose: only resolves
// the mover's own vertical extent against the box's top/bottom faces while
// the mover's XZ footprint overlaps the box -- no side faces
// (resolveBoxCollision already owns those).
//
// Wave 5, Priority E/section 29 re-investigated this for real tunneling
// risk at high dt, not assumed fixed or assumed broken: `landTolerance`
// below scales by `|velocity.y| * dt`, which is EXACTLY the distance the
// mover traveled this frame. Since `position` is always the caller's
// POST-this-frame position, comparing `feetY >= box.max.y - landTolerance`
// is algebraically the SAME comparison as "did the mover's feet START this
// frame at or above the top face" (`feetY + distanceTraveled >= box.max.y`)
// -- this formula was already an effective swept check, just expressed as
// a tolerance band instead of an explicit previous-position reconstruction.
// A first attempt at rewriting it as an explicit swept check (`prevFeetY =
// feetY - velocity.y*dt`) proved exactly that: it was mathematically
// near-equivalent, and only differed by accidentally dropping the
// `Math.max(0.4, ...)` FLOOR this formula also needs for the low-speed
// case (an already-resting or slowly-descending mover, where
// `|velocity.y|*dt` alone is too small a band to reliably catch floating-
// point/frame-timing slop) -- caught by a regression test built for
// exactly that case failing. Kept the original, proven formula; added a
// dedicated high-dt/high-speed regression test (see public-api.test.js)
// confirming it already does NOT tunnel at a lag-spike-sized dt, rather
// than rewriting working math into a differently-shaped version of itself.
function resolveVerticalBoxCollision(position, velocity, radius, halfHeight, box, dt = 1 / 60) {
  const withinX = position.x + radius > box.min.x && position.x - radius < box.max.x;
  const withinZ = position.z + radius > box.min.z && position.z - radius < box.max.z;

  const correctedPosition = position.clone();
  const correctedVelocity = velocity.clone();
  let collided = false;
  let grounded = false;

  if (withinX && withinZ) {
    const feetY = position.y - halfHeight;
    const headY = position.y + halfHeight;
    // Falling onto the top face: only snaps up when the feet are already
    // within a small, fall-speed-scaled tolerance band just above the top,
    // so a mover walking past a TALL box at head height doesn't get yanked
    // up onto its roof. The band scales with this frame's actual travel
    // distance (see the function comment above for why that's equivalent
    // to a swept "started above the top face" check), with a 0.4-unit
    // floor for the low-speed/already-resting case.
    const landTolerance = Math.max(0.4, Math.abs(velocity.y) * dt + 0.1);
    if (velocity.y <= 0 && feetY <= box.max.y && feetY >= box.max.y - landTolerance) {
      correctedPosition.y = box.max.y + halfHeight;
      if (correctedVelocity.y < 0) correctedVelocity.y = 0;
      collided = true;
      grounded = true;
    } else if (velocity.y > 0 && feetY < box.min.y && headY >= box.min.y && headY <= box.min.y + 0.3) {
      // Rising into the underside -- stop the ascent, don't push back down.
      correctedPosition.y = box.min.y - halfHeight;
      correctedVelocity.y = 0;
      collided = true;
    }
  }

  return { collided, grounded, correctedPosition, correctedVelocity };
}

// Wave 6 (Priority B/Section 14-15): the walkable-surface half of a Ramp --
// resolveVerticalBoxCollision's landing-on-top logic generalized from a flat
// top face to a sloped one. `ramp` is `{ center, half, quat }`, the exact
// same oriented-box shape resolveOrientedBoxCollision/TriggerVolume box
// already use -- a ramp is authored as a solid whose LOCAL +X axis is its
// rise direction: at local x=-half.x the walkable surface sits at local
// y=-half.y (the ramp's low/open end), rising LINEARLY to local y=+half.y
// at local x=+half.x (the ramp's high end, matching Opus.Mesh.wedge()'s own
// geometry so the collision surface and the rendered slope are the same
// plane). Deliberately walkable-surface-only, the same bounded scope as the
// box's own landing check -- it does not wall off the ramp's sides or its
// vertical back face (in every dogfooded case a ramp is built leading up to
// a platform, whose OWN solid box already blocks that back face; adding a
// redundant side-blocking box here would also incorrectly block the ramp's
// low, meant-to-be-walkable-onto end, so it's deliberately left out rather
// than half-solved -- see the Wave 6 changelog entry for this priority).
function resolveRampCollision(position, velocity, radius, halfHeight, ramp, dt = 1 / 60) {
  const quat = ramp.quat;
  const rel = position.sub(ramp.center);
  const local = quat ? quat.conjugate().rotateVec3(rel) : rel;
  const half = ramp.half;

  const correctedPosition = position.clone();
  const correctedVelocity = velocity.clone();
  let collided = false;
  let grounded = false;

  const withinX = local.x + radius > -half.x && local.x - radius < half.x;
  const withinZ = local.z + radius > -half.z && local.z - radius < half.z;
  if (withinX && withinZ && half.x > 0) {
    const clampedX = Math.max(-half.x, Math.min(half.x, local.x));
    const surfaceLocalY = -half.y + ((clampedX + half.x) / (2 * half.x)) * (2 * half.y);
    const feetLocalY = local.y - halfHeight;
    const landTolerance = Math.max(0.4, Math.abs(velocity.y) * dt + 0.1);
    if (velocity.y <= 0 && feetLocalY <= surfaceLocalY && feetLocalY >= surfaceLocalY - landTolerance) {
      const newLocal = new Vec3(local.x, surfaceLocalY + halfHeight, local.z);
      const worldPos = (quat ? quat.rotateVec3(newLocal) : newLocal).add(ramp.center);
      correctedPosition.x = worldPos.x;
      correctedPosition.y = worldPos.y;
      correctedPosition.z = worldPos.z;
      if (correctedVelocity.y < 0) correctedVelocity.y = 0;
      collided = true;
      grounded = true;
    }
  }

  return { collided, grounded, correctedPosition, correctedVelocity };
}

function sampleWaveHeight(waves, x, z, time) {
  let h = 0;
  for (const w of waves) {
    const len = Math.hypot(w.dir[0], w.dir[1]);
    const dx = w.dir[0] / len;
    const dz = w.dir[1] / len;
    const phase = (dx * x + dz * z) * w.freq + time * w.speed;
    h += w.amp * Math.sin(phase);
  }
  return h;
}

function applyBuoyancy(entity, water, time, opts = {}) {
  const { bobOffset = 0.15 } = opts;
  const localX = entity.position.x - water.position.x;
  const localZ = entity.position.z - water.position.z;
  const surfaceY = water.position.y + sampleWaveHeight(water.waves, localX, localZ, time);
  entity.position.y = surfaceY + bobOffset;
}
