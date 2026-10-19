'use strict';
// Move gizmo XZ plane handle and hold-Ctrl snapping: wiring in the real gizmo module.
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const gizmo = fs.readFileSync(path.join(root, 'editor/src/modules/09-selection-and-gizmo.js'), 'utf8');
assert(gizmo.includes("gizmoMode === 'move' ? ['x', 'y', 'z', 'xz'].includes(id)"), 'the plane handle survives Move-mode syncs');
assert(gizmo.includes("if (gizmoSpace === 'local') { if (plane)"), 'world space only');
assert(gizmo.includes("Math.abs(hit.x - planeHandle.position.x) <= half && Math.abs(hit.z - planeHandle.position.z) <= half) return 'xz';"), 'picked where the ray crosses the square');
assert(gizmo.includes("if (gizmoAxis === 'xz') {") && gizmo.includes('grabStartX: grab.x, grabStartZ: grab.z, planeY, moved: false'), 'drags start on the handle plane');
assert(gizmo.includes('Number.isFinite(dragState.planeY) ? screenToPlanePoint('), 'moves on the plane at the object height, not Y = 0');
assert(gizmo.includes('function setGizmoSnapCtrlHeld(held)') && gizmo.includes("window.addEventListener('blur', () => setGizmoSnapCtrlHeld(false));"), 'Ctrl flips snapping and is always released');
assert(gizmo.includes('gizmoSnap.enabled = !gizmoSnap.enabled;') && !/setGizmoSnapCtrlHeld[\s\S]{0,400}changeGizmoSnapSetting\('enabled', ?!/.test(gizmo), 'the held flip is never saved as the preference');
console.log('Gizmo plane handle and Ctrl snapping: wiring PASS');
