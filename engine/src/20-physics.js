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

class TriggerVolume {
  constructor({ center, radius, onEnter, onExit }) {
    vector(center, 'options.center', 'Physics.TriggerVolume');
    positive(radius, 'options.radius', 'Physics.TriggerVolume');
    callback(onEnter, 'options.onEnter', 'Physics.TriggerVolume', true);
    callback(onExit, 'options.onExit', 'Physics.TriggerVolume', true);
    this.center = center;
    this.radius = radius;
    this.onEnter = onEnter;
    this.onExit = onExit;
    this.inside = false;
  }

  update(point, previousPoint = point) {
    vector(point, 'point', 'TriggerVolume.update');
    vector(previousPoint, 'previousPoint', 'TriggerVolume.update');
    const nowInside = point.sub(this.center).length() <= this.radius;
    const delta = point.sub(previousPoint);
    const distance = delta.length();
    const hit = distance > 0 ? raySphere(previousPoint, delta.scale(1 / distance), this.center, this.radius) : null;
    if ((nowInside || hit !== null && hit <= distance) && !this.inside) {
      this.inside = true;
      if (this.onEnter) this.onEnter();
    }
    if (!nowInside && this.inside) {
      this.inside = false;
      if (this.onExit) this.onExit();
    }
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
  const x = position.x;
  const z = position.z;
  const halfSize = (terrainOpts.size ?? 22) * 0.5;
  const inBounds = Math.abs(x) <= halfSize && Math.abs(z) <= halfSize;
  const terrainHeight = inBounds ? islandHeight(x, z, terrainOpts) : (terrainOpts.oceanFloor ?? -2.4);
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
