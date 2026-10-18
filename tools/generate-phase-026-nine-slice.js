'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'fixtures');
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc>>>1) ^ ((crc&1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name=Buffer.from(type); const body=Buffer.concat([name,data]); const out=Buffer.alloc(data.length+12); out.writeUInt32BE(data.length,0); name.copy(out,4); data.copy(out,8); out.writeUInt32BE(crc32(body),8+data.length); return out; }
function png(width,height,pixel) { const rows=[]; for(let y=0;y<height;y++){ const row=Buffer.alloc(1+width*4); for(let x=0;x<width;x++){ const c=pixel(x,y); const i=1+x*4; row[i]=c[0];row[i+1]=c[1];row[i+2]=c[2];row[i+3]=c[3]??255; } rows.push(row); } const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6; return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]); }
function panel(x,y) { const left=x<8,right=x>=48,top=y<6,bottom=y>=52; if(left&&top)return[255,75,75,255]; if(right&&top)return[75,210,255,255]; if(left&&bottom)return[255,190,55,255]; if(right&&bottom)return[160,85,255,255]; if(top)return[(x*7)%255,235,105,255]; if(bottom)return[245,(x*5)%255,120,255]; if(left)return[255,105,(y*6)%255,255]; if(right)return[55,(y*4)%255,255,255]; return[((x+y)%2)*30+35,105,125,255]; }
fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(path.join(OUT,'phase-026-nine-slice-panel.png'),png(64,64,panel));
fs.writeFileSync(path.join(OUT,'phase-026-nine-slice-atlas.png'),png(128,96,(x,y)=>{ if(x>=32&&x<96&&y>=16&&y<80)return panel(x-32,y-16); if(x<32)return[255,0,180,255]; if(x>=96)return[0,255,70,255]; return y<16?[255,255,0,255]:[0,30,255,255]; }));
console.log('Generated Phase 026 asymmetric panel and hostile-neighbor atlas fixtures.');
