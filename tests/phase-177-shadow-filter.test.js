'use strict';
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(require.resolve('../engine/src/07-shader.js'),'utf8');
const bodies=[...src.matchAll(/float shadowFactor\(\) \{([\s\S]*?)\n\}/g)].map(m=>m[1]);
assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1],'Entity and terrain must use identical filtering');
const body=bodies[0];assert(body.includes('proj.xy * mapSize - 0.5'));assert(body.includes('base + vec2(float(x), float(y)) + 0.5'));
assert(body.includes('texture(u_shadowMap, uv).r'));assert(body.includes('proj.z - u_shadowBias > pcfDepth'));
assert(body.includes('return shadow / 9.0;'));assert(body.includes('x <= 2')&&body.includes('y <= 2'));
function weight(axis){const expression=body.match(new RegExp('float weight'+axis+' = ([^;]+);'))[1].replaceAll('fraction.'+axis.toLowerCase(),'f');return Function(axis.toLowerCase(),'f','return '+expression);}
const wx=weight('X'),wy=weight('Y');
const sample=(x,y)=>((x*13+y*7)%5+5)%5>1?1:0;
function actual(u,v,read=sample){const bx=Math.floor(u),by=Math.floor(v),fx=u-bx,fy=v-by;let sum=0;for(let x=-1;x<=2;x++)for(let y=-1;y<=2;y++)sum+=wx(x,fx)*wy(y,fy)*read(bx+x,by+y);return sum/9;}
function reference(u,v){const bilinear=(x,y)=>{const bx=Math.floor(x),by=Math.floor(y),fx=x-bx,fy=y-by;return (1-fx)*(1-fy)*sample(bx,by)+fx*(1-fy)*sample(bx+1,by)+(1-fx)*fy*sample(bx,by+1)+fx*fy*sample(bx+1,by+1);};let sum=0;for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)sum+=bilinear(u+x,v+y);return sum/9;}
for(const u of [-3.1,-.001,0,.001,.2,.8,.999,1,1.001,3.6])for(const v of [-1.2,0,.3,.999,1.001]){assert(Math.abs(actual(u,v)-reference(u,v))<1e-12);assert(Math.abs(actual(u,v,()=>1)-1)<1e-12);assert.equal(actual(u,v,()=>0),0);}
for(const boundary of [-2,-1,0,1,2])assert(Math.abs(actual(boundary-1e-7,.3)-actual(boundary+1e-7,.3))<1e-6,'Comparisons must not jump at texel boundaries');
console.log('PASS actual shared shader weights equal bilinear 3x3 comparisons, normalize and remain continuous across texels (16 taps)');
