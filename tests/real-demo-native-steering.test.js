'use strict';
const assert=require('assert');
const {hovercraftCornerKeys,selectEligibleCorner}=require('../tools/real-demo-native-steering');
const state=yaw=>({player:{position:{x:0,z:0},yaw}});
assert.deepStrictEqual(hovercraftCornerKeys(state(0),{x:0,z:3}),['w']);
assert.deepStrictEqual(hovercraftCornerKeys(state(0),{x:-3,z:0}),['d']);
assert.deepStrictEqual(hovercraftCornerKeys(state(0),{x:3,z:0}),['a']);
assert.deepStrictEqual(hovercraftCornerKeys(state(Math.PI*2),{x:0,z:3}),['w']);
assert.deepStrictEqual(hovercraftCornerKeys(state(.3),{x:0,z:3}),['w','d']);
// Captured failed cycle221: W+D drove east despite a westward target.
assert.deepStrictEqual(hovercraftCornerKeys({player:{position:{x:-1.526359826926894,z:-1.600157},yaw:.654796053114953}}, {x:-2.1034755,z:-1.050057}),['d']);
assert.deepStrictEqual(selectEligibleCorner([{x:1,z:0,verticalOverlap:-.016},{x:3,z:0,verticalOverlap:.5}],{x:0,z:0}),{x:3,z:0,verticalOverlap:.5});
assert.strictEqual(selectEligibleCorner([{x:1,z:0,verticalOverlap:0}],{x:0,z:0}),null);
assert.strictEqual(selectEligibleCorner([{x:3,z:0,verticalOverlap:.5},{x:1,z:0,verticalOverlap:.4}],{x:0,z:0}).x,1);
console.log('Native steering and vertical corner selection: 9 PASS');
