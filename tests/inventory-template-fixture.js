'use strict';
const fs=require('fs'),vm=require('vm');
// Real production library/copy/view dependencies; empty historical library is
// ordinary authored absence, not a replacement copy or renderer algorithm.
module.exports=function(context){
  const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
  vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-inventory-templates.js'),'utf8'),context);
  for(const name of ['copyInventoryTemplateLibrary','inspectInventoryTemplate','captureInventoryTemplate','applyInventoryTemplate','renderInventoryTemplateLibrary']){
    const at=source.indexOf('function '+name+'(');if(at<0)throw Error(name);
    const line=source.slice(at,source.indexOf('\n',at));
    vm.runInContext(/\}\s*$/.test(line)?line:source.slice(at,source.indexOf('\n}',at)+2),context);
  }
  vm.runInContext('this.inventoryTemplates=[];',context);
  if(!context.document)context.document={getElementById:()=>null};
};
