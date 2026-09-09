'use strict';
const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir=process.argv[2],out=process.argv[3];if(!dir||!out)throw Error('Usage: node make-pdf-contact-sheet.js <page-dir> <output>');
const files=fs.readdirSync(dir).filter(f=>/\.png$/i.test(f)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
(async()=>{const w=396,h=306,cols=4,rows=Math.ceil(files.length/cols),layers=[];for(let i=0;i<files.length;i++){layers.push({input:await sharp(path.join(dir,files[i])).resize(w,h,{fit:'contain',background:'#111827'}).png().toBuffer(),left:(i%cols)*w,top:Math.floor(i/cols)*h});}await sharp({create:{width:w*cols,height:h*rows,channels:3,background:'#111827'}}).composite(layers).png().toFile(out);console.log(out,files.length);})();
