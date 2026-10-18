'use strict';

// Phase 015: bounded, renderer-independent math for Sprite viewport authoring.
// The editor consumes these helpers and the focused suite exercises the same
// functions directly. No handle/session state is serialized into a project.
(function initSpriteAuthoring(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OpusSpriteAuthoring = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSpriteAuthoring() {
  const MIN_SIZE = 0.01;
  const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
  const positive = (value, fallback = 1) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

  function bounds(component) {
    const width = positive(component && component.width);
    const height = positive(component && component.height);
    const pivotX = clamp01(component && component.pivotX);
    const pivotY = clamp01(component && component.pivotY);
    return {
      width, height, pivotX, pivotY,
      left: -pivotX * width,
      right: (1 - pivotX) * width,
      bottom: -pivotY * height,
      top: (1 - pivotY) * height,
    };
  }

  function resize(start, handle, deltaX, deltaY, lockAspect, snapIncrement) {
    const base = bounds(start);
    const east = handle.includes('e');
    const west = handle.includes('w');
    const north = handle.includes('n');
    const south = handle.includes('s');
    const xFactor = east ? 1 - base.pivotX : west ? base.pivotX : 1;
    const yFactor = north ? 1 - base.pivotY : south ? base.pivotY : 1;
    // An edge coincident with the Transform origin is geometrically pinned:
    // Width/Height-only editing cannot move it without silently changing
    // Transform position. Ignore that axis and leave the opposite handle as
    // the unambiguous way to resize from an edge pivot.
    let width = base.width + (east && xFactor > 0.0001 ? deltaX / xFactor : west && xFactor > 0.0001 ? -deltaX / xFactor : 0);
    let height = base.height + (north && yFactor > 0.0001 ? deltaY / yFactor : south && yFactor > 0.0001 ? -deltaY / yFactor : 0);
    width = Math.max(MIN_SIZE, width);
    height = Math.max(MIN_SIZE, height);

    if (lockAspect) {
      const aspect = base.width / base.height;
      if ((east || west) && !(north || south)) height = width / aspect;
      else if ((north || south) && !(east || west)) width = height * aspect;
      else {
        const widthChange = Math.abs(width / base.width - 1);
        const heightChange = Math.abs(height / base.height - 1);
        if (widthChange >= heightChange) height = width / aspect;
        else width = height * aspect;
      }
    }

    const increment = Number(snapIncrement);
    if (Number.isFinite(increment) && increment > 0) {
      width = Math.max(MIN_SIZE, Math.round(width / increment) * increment);
      height = Math.max(MIN_SIZE, Math.round(height / increment) * increment);
      if (lockAspect) {
        const aspect = base.width / base.height;
        if (east || west) height = width / aspect;
        else width = height * aspect;
      }
    }
    return { width, height };
  }

  function pivotFromLocalPoint(start, localX, localY) {
    const base = bounds(start);
    return {
      pivotX: clamp01((localX - base.left) / base.width),
      pivotY: clamp01((localY - base.bottom) / base.height),
    };
  }

  const PIVOT_PRESETS = Object.freeze({
    center: Object.freeze([0.5, 0.5]),
    'bottom-center': Object.freeze([0.5, 0]),
    'top-center': Object.freeze([0.5, 1]),
    'left-center': Object.freeze([0, 0.5]),
    'right-center': Object.freeze([1, 0.5]),
    'bottom-left': Object.freeze([0, 0]),
    'bottom-right': Object.freeze([1, 0]),
    'top-left': Object.freeze([0, 1]),
    'top-right': Object.freeze([1, 1]),
  });

  function pivotPreset(name) {
    const preset = PIVOT_PRESETS[name] || PIVOT_PRESETS.center;
    return { pivotX: preset[0], pivotY: preset[1] };
  }

  function naturalSize(asset, texture) {
    const width = Number(asset && asset.sourceRect ? asset.sourceRect.width : asset && (asset.sourceWidth || (texture && (texture.width || (texture.image && texture.image.width)))));
    const height = Number(asset && asset.sourceRect ? asset.sourceRect.height : asset && (asset.sourceHeight || (texture && (texture.height || (texture.image && texture.image.height)))));
    const pixelsPerUnit = Number(asset && asset.pixelsPerUnit);
    if (!(width > 0) || !(height > 0) || !(pixelsPerUnit > 0)) return null;
    return { width: width / pixelsPerUnit, height: height / pixelsPerUnit };
  }

  return Object.freeze({ MIN_SIZE, PIVOT_PRESETS, bounds, resize, pivotFromLocalPoint, pivotPreset, naturalSize });
});
