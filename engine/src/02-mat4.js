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

  static compose(position, rotationYRad, scale) {
    const t = Mat4.translation(position);
    const r = Mat4.rotationY(rotationYRad);
    const s = Mat4.scaling(scale);
    return Mat4.multiply(t, Mat4.multiply(r, s));
  }

  static normalMatrixFromModel(model) {
    return model;
  }
}
