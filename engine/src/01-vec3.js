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
