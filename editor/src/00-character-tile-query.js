// Phase 045: sparse, direct Tilemap collision candidates for Character movement.
// No cell is materialized as a scene object or Body component.
(function (root, factory) {
  'use strict';
  const plumbing = typeof module !== 'undefined' && module.exports ? require('./00-authoring-plumbing.js') : root.OpusAuthoringPlumbing;
  const collider = typeof module !== 'undefined' && module.exports ? require('./00-collider-2d.js') : root.OpusCollider2D;
  const oneWay = typeof module !== 'undefined' && module.exports ? require('./00-one-way-2d.js') : root.OpusOneWay2D;
  const slope = typeof module !== 'undefined' && module.exports ? require('./00-character-slope-2d.js') : root.OpusCharacterSlope2D;
  const filters = typeof module !== 'undefined' && module.exports ? require('./00-collision-filter-2d.js') : root.OpusCollisionFilter2D;
  const api = factory(plumbing, collider, oneWay, slope, filters);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusCharacterTileQuery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Plumbing, Collider2D, OneWay2D, Slope2D, Filters) {
  'use strict';
  function query(objects, tilesets, mover, bounds, metrics, collisionLayers) {
    if (!bounds || ![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)) return [];
    const result = [];
    const resolvedShapes = Collider2D.enumerateCollider2DWorldShapes(mover);
    // Preserve the historical geometry-only diagnostic API. The editor always
    // supplies its registry and thus never takes this legacy query fallback.
    const moverShapes = resolvedShapes.length ? resolvedShapes : collisionLayers === undefined ? [{ filter: Filters.defaultFilter() }] : [];
    const ids = Filters.validLayerIds(collisionLayers);
    const byId = new Map((tilesets || []).map((tileset) => [tileset.id, tileset]));
    for (const tilemap of objects || []) {
      if (tilemap.kind !== 'tilemap' || !tilemap.entity || tilemap.id === mover.id) continue;
      const tileset = byId.get(tilemap.tilesetRef); if (!tileset) continue;
      const entity = tilemap.entity;
      const transform = { position: entity.position, right: entity.right, up: entity.up, scale: entity.scale };
      // A rotated cell's world AABB may overlap the query AABB even when the
      // cell quad does not. Inflate before inversion by one transformed cell
      // footprint so this broad phase is conservative for both cases.
      const size = Plumbing.safeTilesetCellSize(tileset);
      const padX = Math.abs(entity.right.x * entity.scale.x * size.width) + Math.abs(entity.up.x * entity.scale.y * size.height) + 1e-6;
      const padY = Math.abs(entity.right.y * entity.scale.x * size.width) + Math.abs(entity.up.y * entity.scale.y * size.height) + 1e-6;
      const corners = [[bounds.minX - padX, bounds.minY - padY], [bounds.minX - padX, bounds.maxY + padY],
        [bounds.maxX + padX, bounds.minY - padY], [bounds.maxX + padX, bounds.maxY + padY]]
        .map(([x, y]) => Plumbing.tilemapWorldToCell(tilemap, tileset, { x, y, z: entity.position.z }, transform));
      if (corners.some((cell) => !cell)) continue;
      const minX = Math.min(...corners.map((cell) => cell.x)) - 1, maxX = Math.max(...corners.map((cell) => cell.x)) + 1;
      const minY = Math.min(...corners.map((cell) => cell.y)) - 1, maxY = Math.max(...corners.map((cell) => cell.y)) + 1;
      const quadTransform = { position: [entity.position.x, entity.position.y, entity.position.z],
        rotationZ: Math.atan2(entity.right.y, entity.right.x), scale: [entity.scale.x, entity.scale.y, entity.scale.z] };
      for (const layer of tilemap.layers || []) {
        if (layer.collisionEnabled === false) continue;
        const filter = Filters.normalizeFilter(layer, !tilemap.version || tilemap.version < 6);
        const acceptsShape = (shape) => Filters.allows(shape, { filter }, ids);
        if (!moverShapes.some(acceptsShape)) { if (metrics) metrics.filterRejectedLayers = (metrics.filterRejectedLayers || 0) + 1; continue; }
        const index = Plumbing.ensureTilemapCellIndex(tilemap, layer.id).byKey;
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          if (metrics) metrics.candidateCells = (metrics.candidateCells || 0) + 1;
          const cell = index.get(Plumbing.tilemapCellKey(x, y)); if (!cell) continue;
          const tile = Plumbing.getTileById(tileset, cell.tileId); if (!tile) continue;
          const quad = Plumbing.tileCollisionWorldQuad(tile, tileset, x, y, quadTransform); if (!quad) continue;
          const collision = Plumbing.resolveTileCollision(tile);
          const corners = quad.map((point) => ({ x: point.x, y: point.y }));
          const points = collision.mode === 'slope'
            ? collision.slope === 'up-right' ? [corners[0], corners[1], corners[2]] : [corners[0], corners[1], corners[3]]
            : corners;
          const aabb = { minX: Math.min(...points.map((point) => point.x)), minY: Math.min(...points.map((point) => point.y)),
            maxX: Math.max(...points.map((point) => point.x)), maxY: Math.max(...points.map((point) => point.y)) };
          if (!Collider2D.aabbOverlaps(bounds, aabb)) continue;
          if (metrics) metrics.collisionCells = (metrics.collisionCells || 0) + 1;
          const shape = { kind: collision.mode === 'slope' ? 'polygon' : 'box', filter, points, aabb };
          const id = `tile:${tilemap.id}:${layer.id}:${x}:${y}`;
          const top = collision.oneWay && shape.kind === 'box' ? OneWay2D.horizontalTop(shape) : null;
          const surface = Slope2D.surfaceFromShape(shape, id, collision.oneWay, acceptsShape);
          result.push({ object: { id }, shapes: [shape], collisionMode: collision.mode, oneWay: !!top, slopeOneWay: !!collision.oneWay && !top, top, surface, acceptsShape });
        }
      }
    }
    return result;
  }
  return Object.freeze({ query });
});
