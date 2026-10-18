'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../engine/src/11-entity.js'),'utf8')+'\n'+fs.readFileSync(require.resolve('../engine/src/12-scene.js'),'utf8')+'\nthis.EntityClass=Entity;this.SceneClass=Scene;',c);
const entity={rotationY:.3,spin:2,destroyed:false};
c.EntityClass.prototype.update.call(entity,.25,false);assert.equal(entity.rotationY,.3,'Authoring must not advance automatic visual spin');
c.EntityClass.prototype.update.call(entity,.25,true);assert.equal(entity.rotationY,.8);c.EntityClass.prototype.update.call(entity,.25);assert.equal(entity.rotationY,1.3,'Standalone default spin unchanged');
const scene=new c.SceneClass(), seen=[];scene.entities.push({update:(dt,spin)=>seen.push([dt,spin])});scene.update(.1);scene.spinEnabled=false;scene.update(.2);assert.deepStrictEqual(seen,[[.1,true],[.2,false]]);
const editor=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');assert(editor.includes('app.scene.spinEnabled = false;'));assert(editor.includes('app.scene.spinEnabled = true;'));
console.log('Phase231 automatic spin: editor gate, runtime opt-in, standalone compatibility and scene forwarding PASS');
