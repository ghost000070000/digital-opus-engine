class Scene {
  constructor() {
    this.entities = [];
    // The editor disables automatic visual spin while authoring. Animation
    // sampling and standalone runtime motion retain their normal time step.
    this.spinEnabled = true;
  }

  add(entity) {
    if (!(entity instanceof Entity)) fail('Scene.add', 'entity', 'an Opus.Entity', entity);
    if (entity.destroyed) fail('Scene.add', 'entity', 'a live Opus.Entity', entity);
    if (this._onAdd) this._onAdd(entity);
    this.entities.push(entity);
    return entity;
  }

  remove(entity) {
    if (!(entity instanceof Entity)) fail('Scene.remove', 'entity', 'an Opus.Entity', entity);
    const index = this.entities.indexOf(entity);
    if (index >= 0) { this.entities.splice(index, 1); entity.destroy(); }
    return index >= 0;
  }

  clear() {
    for (const entity of this.entities) entity.destroy();
    this.entities.length = 0;
  }

  update(dt) {
    for (const entity of this.entities) entity.update(dt, this.spinEnabled);
  }
}
