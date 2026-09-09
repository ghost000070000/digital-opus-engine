class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    finite(x, 'x', 'Opus.Vec3');
    finite(y, 'y', 'Opus.Vec3');
    finite(z, 'z', 'Opus.Vec3');
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static from(x, y, z) {
    return new Vec3(x, y, z);
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }

  set(x, y, z) {
    finite(x, 'x', 'Vec3.set');
    finite(y, 'y', 'Vec3.set');
    finite(z, 'z', 'Vec3.set');
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  add(v) {
    vector(v, 'operand', 'Vec3.add');
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v) {
    vector(v, 'operand', 'Vec3.sub');
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s) {
    finite(s, 'scalar', 'Vec3.scale');
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  dot(v) {
    vector(v, 'operand', 'Vec3.dot');
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    vector(v, 'operand', 'Vec3.cross');
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  length() {
    return Math.sqrt(this.dot(this));
  }

  normalize() {
    const len = this.length();
    if (len === 0) return new Vec3();
    return this.scale(1 / len);
  }

  static lerp(a, b, t) {
    vector(a, 'a', 'Vec3.lerp'); vector(b, 'b', 'Vec3.lerp'); finite(t, 't', 'Vec3.lerp');
    return new Vec3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t
    );
  }
}

// Full XYZ orientation (Wave 5) -- a unit quaternion, not three independent
// Euler angles, so composing rotations (parent x child, an accumulated
// gizmo drag, animation keyframes) never hits gimbal lock or accumulates
// order-dependent drift the way stacking three separate axis rotations
// eventually would. Every consumer that only ever needs "the yaw" (chase
// cameras, the legacy `rotationY` field) reads it back out via `toEuler()`,
// so nothing downstream needs to know quaternions exist unless it wants
// genuine pitch/roll.
//
// Euler convention (fromEuler/toEuler, both in RADIANS): intrinsic
// Yaw(Y) -> Pitch(X) -> Roll(Z), i.e. `q = qYaw * qPitch * qRoll` -- the
// standard "aircraft/vehicle" order (turn, then nose up/down, then bank),
// and the one order under which `fromEuler(0, yaw, 0)` reproduces the
// engine's original Y-only rotation exactly, which is what backward
// compatibility with every pre-Wave-5 project depends on.
class Quat {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    finite(x, 'x', 'Opus.Quat'); finite(y, 'y', 'Opus.Quat'); finite(z, 'z', 'Opus.Quat'); finite(w, 'w', 'Opus.Quat');
    this.x = x; this.y = y; this.z = z; this.w = w;
  }

  static identity() { return new Quat(0, 0, 0, 1); }

  clone() { return new Quat(this.x, this.y, this.z, this.w); }

  static fromAxisAngle(axis, angleRad) {
    vector(axis, 'axis', 'Quat.fromAxisAngle'); finite(angleRad, 'angleRad', 'Quat.fromAxisAngle');
    const a = axis.normalize();
    const half = angleRad / 2;
    const s = Math.sin(half);
    return new Quat(a.x * s, a.y * s, a.z * s, Math.cos(half));
  }

  // pitchX/yawY/rollZ in radians -- see the class comment for the exact
  // composition order this must match on both ends (fromEuler/toEuler).
  static fromEuler(pitchX, yawY, rollZ) {
    finite(pitchX, 'pitchX', 'Quat.fromEuler'); finite(yawY, 'yawY', 'Quat.fromEuler'); finite(rollZ, 'rollZ', 'Quat.fromEuler');
    const qYaw = Quat.fromAxisAngle(new Vec3(0, 1, 0), yawY);
    const qPitch = Quat.fromAxisAngle(new Vec3(1, 0, 0), pitchX);
    const qRoll = Quat.fromAxisAngle(new Vec3(0, 0, 1), rollZ);
    return qYaw.multiply(qPitch).multiply(qRoll);
  }

  // this * other (this applied AFTER other -- standard quaternion
  // composition order, so parent.multiply(childLocal) rotates by the
  // child's local orientation first, then the parent's, matching how
  // worldMatrix = parentWorld * localMatrix already reads for position).
  multiply(o) {
    return new Quat(
      this.w * o.x + this.x * o.w + this.y * o.z - this.z * o.y,
      this.w * o.y - this.x * o.z + this.y * o.w + this.z * o.x,
      this.w * o.z + this.x * o.y - this.y * o.x + this.z * o.w,
      this.w * o.w - this.x * o.x - this.y * o.y - this.z * o.z,
    );
  }

  length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w); }

  normalize() {
    const len = this.length();
    if (len === 0) return Quat.identity();
    return new Quat(this.x / len, this.y / len, this.z / len, this.w / len);
  }

  conjugate() { return new Quat(-this.x, -this.y, -this.z, this.w); }

  // Rotates a plain Vec3 by this quaternion (v' = q * v * q^-1, the
  // standard optimized form) -- used to derive forward/right/up from an
  // orientation without ever building a full matrix just to read one axis.
  rotateVec3(v) {
    vector(v, 'v', 'Quat.rotateVec3');
    const qv = new Vec3(this.x, this.y, this.z);
    const uv = qv.cross(v);
    const uuv = qv.cross(uv);
    return v.add(uv.scale(2 * this.w)).add(uuv.scale(2));
  }

  // Inverse of fromEuler, same Yaw->Pitch->Roll convention -- accurate for
  // every orientation this engine's own gizmo/inspector/animation authoring
  // can produce; only degenerates at the pitch=±90° gimbal-lock singularity
  // every Euler representation shares, which is an authoring-display
  // concern (the inspector's numbers briefly become ambiguous at the pole),
  // never a runtime correctness one (the quaternion itself stays exact).
  toEuler() {
    const { x, y, z, w } = this;
    const sinPitch = 2 * (w * x - y * z);
    const pitchX = Math.abs(sinPitch) >= 1 ? Math.sign(sinPitch) * (Math.PI / 2) : Math.asin(sinPitch);
    const yawY = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
    const rollZ = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z));
    return { x: pitchX, y: yawY, z: rollZ };
  }

  static slerp(a, b, t) {
    finite(t, 't', 'Quat.slerp');
    let bx = b.x, by = b.y, bz = b.z, bw = b.w;
    let cosom = a.x * bx + a.y * by + a.z * bz + a.w * bw;
    if (cosom < 0) { cosom = -cosom; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let s0, s1;
    if (1 - cosom > 1e-6) {
      const omega = Math.acos(cosom);
      const sinom = Math.sin(omega);
      s0 = Math.sin((1 - t) * omega) / sinom;
      s1 = Math.sin(t * omega) / sinom;
    } else {
      s0 = 1 - t;
      s1 = t;
    }
    return new Quat(a.x * s0 + bx * s1, a.y * s0 + by * s1, a.z * s0 + bz * s1, a.w * s0 + bw * s1).normalize();
  }
}
