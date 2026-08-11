class Entity {
  constructor({ mesh, color = [1, 1, 1], position = new Vec3(), rotationY = 0, scale = new Vec3(1, 1, 1) } = {}) {
    if (!MESH_DATA.has(mesh)) fail('Opus.Entity', 'options.mesh', 'a mesh returned by Opus.Mesh', mesh);
    vector(position, 'options.position', 'Opus.Entity');
    vector(scale, 'options.scale', 'Opus.Entity');
    finite(rotationY, 'options.rotationY', 'Opus.Entity');
    if (!Array.isArray(color) || color.length !== 3 || color.some((n) => typeof n !== 'number' || !Number.isFinite(n))) fail('Opus.Entity', 'options.color', 'a three-number RGB array', color);
    this.mesh = mesh;
    this.color = color;
    this.position = position;
    this.rotationY = rotationY;
    this.scale = scale;
    this.spin = 0;
    this.visible = true;
    this.destroyed = false;
  }

  get modelMatrix() {
    return Mat4.compose(this.position, this.rotationY, this.scale);
  }

  update(dt) {
    if (this.destroyed) return;
    if (this.spin) this.rotationY += this.spin * dt;
  }

  destroy() { this.destroyed = true; this.visible = false; }
}
