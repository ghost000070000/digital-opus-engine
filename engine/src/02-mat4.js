class Mat4 {
  constructor() {
    this.m = Mat4.identityArray();
  }

  static identityArray() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static identity() {
    return new Mat4();
  }

  static perspective(fovYRad, aspect, near, far) {
    positive(fovYRad, 'fovYRad', 'Mat4.perspective'); positive(aspect, 'aspect', 'Mat4.perspective'); positive(near, 'near', 'Mat4.perspective'); positive(far, 'far', 'Mat4.perspective');
    if (near >= far) fail('Mat4.perspective', 'near', 'less than far', near);
    const out = new Mat4();
    const f = 1 / Math.tan(fovYRad / 2);
    const nf = 1 / (near - far);
    const m = out.m;
    m[0] = f / aspect; m[1] = 0; m[2] = 0; m[3] = 0;
    m[4] = 0; m[5] = f; m[6] = 0; m[7] = 0;
    m[8] = 0; m[9] = 0; m[10] = (far + near) * nf; m[11] = -1;
    m[12] = 0; m[13] = 0; m[14] = 2 * far * near * nf; m[15] = 0;
    return out;
  }

  static lookAt(eye, target, up) {
    vector(eye, 'eye', 'Mat4.lookAt'); vector(target, 'target', 'Mat4.lookAt'); vector(up, 'up', 'Mat4.lookAt');
    const zAxis = eye.sub(target).normalize();
    const xAxis = up.cross(zAxis).normalize();
    const yAxis = zAxis.cross(xAxis);

    const out = new Mat4();
    const m = out.m;
    m[0] = xAxis.x; m[1] = yAxis.x; m[2] = zAxis.x; m[3] = 0;
    m[4] = xAxis.y; m[5] = yAxis.y; m[6] = zAxis.y; m[7] = 0;
    m[8] = xAxis.z; m[9] = yAxis.z; m[10] = zAxis.z; m[11] = 0;
    m[12] = -xAxis.dot(eye); m[13] = -yAxis.dot(eye); m[14] = -zAxis.dot(eye); m[15] = 1;
    return out;
  }

  static multiply(a, b) {
    const out = new Mat4();
    const am = a.m, bm = b.m, om = out.m;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += am[k * 4 + row] * bm[col * 4 + k];
        }
        om[col * 4 + row] = sum;
      }
    }
    return out;
  }

  static rotationY(rad) {
    finite(rad, 'rad', 'Mat4.rotationY');
    const out = new Mat4();
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = out.m;
    m[0] = c; m[2] = -s;
    m[8] = s; m[10] = c;
    return out;
  }

  static rotationX(rad) {
    finite(rad, 'rad', 'Mat4.rotationX');
    const out = new Mat4();
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = out.m;
    m[5] = c; m[6] = s;
    m[9] = -s; m[10] = c;
    return out;
  }

  static rotationZ(rad) {
    finite(rad, 'rad', 'Mat4.rotationZ');
    const out = new Mat4();
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = out.m;
    m[0] = c; m[1] = s;
    m[4] = -s; m[5] = c;
    return out;
  }

  // The general case Mat4.rotationX/Y/Z above are each a special case of --
  // a full XYZ orientation (Wave 5) needs one matrix that can represent any
  // combined pitch/yaw/roll, not three separate axis matrices stacked in a
  // fixed (and therefore gimbal-lock-prone, order-dependent) sequence.
  static fromQuaternion(q) {
    finite(q.x, 'q.x', 'Mat4.fromQuaternion'); finite(q.y, 'q.y', 'Mat4.fromQuaternion'); finite(q.z, 'q.z', 'Mat4.fromQuaternion'); finite(q.w, 'q.w', 'Mat4.fromQuaternion');
    const { x, y, z, w } = q;
    const out = new Mat4();
    const m = out.m;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    m[0] = 1 - (yy + zz); m[1] = xy + wz; m[2] = xz - wy; m[3] = 0;
    m[4] = xy - wz; m[5] = 1 - (xx + zz); m[6] = yz + wx; m[7] = 0;
    m[8] = xz + wy; m[9] = yz - wx; m[10] = 1 - (xx + yy); m[11] = 0;
    m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1;
    return out;
  }

  // Bounded Directional Shadows (Wave 5, Priority H): a fixed-box orthographic
  // projection for the one sun shadow map -- no perspective divide, matching
  // Mat4.perspective's same standard-GL clip-space convention (z in [-1,1])
  // so both projections compose with Mat4.lookAt identically.
  static orthographic(left, right, bottom, top, near, far) {
    finite(left, 'left', 'Mat4.orthographic'); finite(right, 'right', 'Mat4.orthographic');
    finite(bottom, 'bottom', 'Mat4.orthographic'); finite(top, 'top', 'Mat4.orthographic');
    positive(near, 'near', 'Mat4.orthographic'); positive(far, 'far', 'Mat4.orthographic');
    if (near >= far) fail('Mat4.orthographic', 'near', 'less than far', near);
    const out = new Mat4();
    const m = out.m;
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    m[0] = -2 * lr; m[1] = 0; m[2] = 0; m[3] = 0;
    m[4] = 0; m[5] = -2 * bt; m[6] = 0; m[7] = 0;
    m[8] = 0; m[9] = 0; m[10] = 2 * nf; m[11] = 0;
    m[12] = (left + right) * lr; m[13] = (top + bottom) * bt; m[14] = (far + near) * nf; m[15] = 1;
    return out;
  }

  static translation(v) {
    vector(v, 'translation', 'Mat4.translation');
    const out = new Mat4();
    out.m[12] = v.x;
    out.m[13] = v.y;
    out.m[14] = v.z;
    return out;
  }

  static scaling(v) {
    vector(v, 'scale', 'Mat4.scaling');
    const out = new Mat4();
    out.m[0] = v.x;
    out.m[5] = v.y;
    out.m[10] = v.z;
    return out;
  }

  // `rotation` accepts either an Opus.Quat (full XYZ orientation, Wave 5)
  // or a plain number (legacy Y-axis radians, exactly the pre-Wave-5
  // signature) -- every project/API caller that only ever dealt with
  // rotationY keeps working unmodified against this same function.
  static compose(position, rotation, scale) {
    const t = Mat4.translation(position);
    const r = (rotation instanceof Quat) ? Mat4.fromQuaternion(rotation) : Mat4.rotationY(rotation);
    const s = Mat4.scaling(scale);
    return Mat4.multiply(t, Mat4.multiply(r, s));
  }

  static normalMatrixFromModel(model) {
    return model;
  }
}
