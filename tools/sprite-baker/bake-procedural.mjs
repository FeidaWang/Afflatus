#!/usr/bin/env node
/**
 * Project Afflatus · procedural sprite baker
 *
 * Pure-Node software rasterizer (no Blender, no GPU, no npm deps).
 * Builds low-poly fighter models procedurally, renders them from
 * AZ_STEPS azimuths x ELEVATIONS pitches with baked directional
 * lighting, and writes:
 *   public/assets/sprites/<type>.atlas.png
 *   src/data/spriteAtlasMeta.js   (runtime metadata module)
 *   tools/sprite-baker/preview-<type>.png (large single-frame check)
 *
 * Usage:  node tools/sprite-baker/bake-procedural.mjs
 *
 * Conventions (mirrored by src/scene/spriteCraft.js):
 *   - Model space: nose +X, right wing +Y, up +Z. Length ~100 units.
 *   - az: camera azimuth. 0 = head-on (front), 90 = right side,
 *     180 = tail view. el: 0 = horizon, 90 = top-down.
 *   - Every frame is rendered with the nose projected screen-up,
 *     so the runtime only applies (heading + PI/2) rotation.
 *   - Uniform scale across all frames (no size popping).
 */
import {deflateSync} from 'node:zlib';
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ============================ config ============================ */
const CELL = 128;            // atlas cell px
const SS = 2;                // supersample factor
const AZ_STEPS = 24;         // 15° per step
const ELEVATIONS = [12, 40, 90];

/* ============================ vec math ============================ */
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=a=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
const lerp=(a,b,t)=>a+(b-a)*t;

/* ============================ PNG encoder ============================ */
const CRC_TABLE=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c;}return t;})();
function crc32(buf){let c=-1;for(let i=0;i<buf.length;i++)c=CRC_TABLE[(c^buf[i])&255]^(c>>>8);return (c^-1)>>>0;}
function chunk(type,data){
  const out=Buffer.alloc(8+data.length+4);
  out.writeUInt32BE(data.length,0);out.write(type,4,'ascii');data.copy(out,8);
  out.writeUInt32BE(crc32(out.subarray(4,8+data.length)),8+data.length);
  return out;
}
function encodePNG(width,height,rgba){
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  const raw=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++){
    raw[y*(1+width*4)]=0;
    rgba.copy(raw,y*(1+width*4)+1,y*width*4,(y+1)*width*4);
  }
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

/* ============================ geometry helpers ============================ */
/** tri: {v:[p,p,p], c:[r,g,b] 0-255, e:emissive 0..1} */
function quad(tris,a,b,c,d,col,e=0){tris.push({v:[a,b,c],c:col,e},{v:[a,c,d],c:col,e});}

/** Loft ring cross-sections along an axis. sections: [{o:[x,y,z] origin, pts:[[u,v],..]}]
 *  pts live in the (uDir,vDir) plane. Caps optional. */
function loft(tris,sections,col,{capStart=true,capEnd=true,e=0,uDir=[0,1,0],vDir=[0,0,1]}={}){
  const world=s=>s.pts.map(([u,v])=>[
    s.o[0]+uDir[0]*u+vDir[0]*v,
    s.o[1]+uDir[1]*u+vDir[1]*v,
    s.o[2]+uDir[2]*u+vDir[2]*v]);
  const rings=sections.map(world);
  for(let i=0;i<rings.length-1;i++){
    const A=rings[i],B=rings[i+1],n=A.length;
    for(let j=0;j<n;j++)quad(tris,A[j],A[(j+1)%n],B[(j+1)%n],B[j],col,e);
  }
  const fan=(ring,rev)=>{
    const cx=ring.reduce((s,p)=>[s[0]+p[0],s[1]+p[1],s[2]+p[2]],[0,0,0]).map(v=>v/ring.length);
    for(let j=0;j<ring.length;j++){
      const a=ring[j],b=ring[(j+1)%ring.length];
      tris.push({v:rev?[cx,b,a]:[cx,a,b],c:col,e});
    }
  };
  if(capStart)fan(rings[0],false);
  if(capEnd)fan(rings[rings.length-1],true);
}

/** Thin slab from a planform polygon in the XY plane.
 *  pts: [[x,y]], zT(x,y)/zB(x,y) thickness functions. Fan-triangulated (near-convex). */
function slab(tris,pts,zT,zB,col,e=0){
  const top=pts.map(([x,y])=>[x,y,zT(x,y)]);
  const bot=pts.map(([x,y])=>[x,y,zB(x,y)]);
  const cx=pts.reduce((s,p)=>[s[0]+p[0],s[1]+p[1]],[0,0]).map(v=>v/pts.length);
  const ct=[cx[0],cx[1],zT(cx[0],cx[1])],cb=[cx[0],cx[1],zB(cx[0],cx[1])];
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    tris.push({v:[ct,top[i],top[j]],c:col,e});
    tris.push({v:[cb,bot[j],bot[i]],c:col,e});
    quad(tris,top[i],bot[i],bot[j],top[j],col,e);
  }
}
const mirrorY=pts=>pts.map(([x,y])=>[x,-y]);

/* ============================ models ============================ */
const GUNMETAL=[112,124,140], WING=[96,108,126], DARK=[70,80,94];
const GLASS=[24,38,56], NOZZLE=[36,42,52], CYAN=[64,214,255];

function buildF47(){
  const T=[];
  // --- fuselage: faceted stealth hexagonal loft, nose +X
  const cs=(w,t,b)=>[[0,t],[w*.55,t*.42],[w,0],[w*.6,-b*.62],[w*.22,-b],[-w*.22,-b],[-w*.6,-b*.62],[-w,0],[-w*.55,t*.42]];
  loft(T,[
    {o:[50,0,.4], pts:cs(.6,.4,.3)},
    {o:[36,0,.6], pts:cs(3.6,2.4,1.9)},
    {o:[18,0,.6], pts:cs(7.2,4.4,3.2)},
    {o:[-6,0,.4], pts:cs(8.8,4.9,3.5)},
    {o:[-28,0,.2],pts:cs(7.6,3.9,3.0)},
    {o:[-46,0,0], pts:cs(5.4,2.5,2.3)},
  ],GUNMETAL);
  // --- canopy bubble
  const cv=(w,h)=>[[w,0],[w*.62,h*.8],[0,h],[-w*.62,h*.8],[-w,0]];
  loft(T,[
    {o:[37,0,4.0],pts:cv(.4,.2)},
    {o:[31,0,4.5],pts:cv(2.4,2.9)},
    {o:[24,0,4.8],pts:cv(2.9,3.3)},
    {o:[18,0,4.7],pts:cv(1.6,1.2)},
  ],GLASS,{e:.18});
  // --- cranked delta wings (per-vertex thickness via y interp)
  const wingR=[[20,7.5],[2,26],[-14,44],[-23,44],[-27,39],[-31,8.6]];
  const wzT=(x,y)=>lerp(1.1,.25,Math.min(1,Math.abs(y)/44));
  const wzB=(x,y)=>-lerp(.8,.2,Math.min(1,Math.abs(y)/44));
  slab(T,wingR,wzT,wzB,WING);
  slab(T,mirrorY(wingR).reverse(),wzT,wzB,WING);
  // --- canards
  const canR=[[41,4.2],[31,14],[27,14],[29,4.6]];
  slab(T,canR,()=>.5,()=>-.3,DARK);
  slab(T,mirrorY(canR).reverse(),()=>.5,()=>-.3,DARK);
  // --- canted rear fins
  const fin=(s)=>{
    const a=[-34,6*s,3.4],b=[-45,6*s,2.8],c=[-47,10.5*s,8.6],d=[-37,10.5*s,9.4];
    quad(T,a,b,c,d,DARK);quad(T,d,c,b,a,DARK);
  };
  fin(1);fin(-1);
  // --- engine nozzles (emissive rear faces)
  for(const s of [1,-1]){
    loft(T,[
      {o:[-44,3.4*s,.4],pts:[[1.5,0],[1.05,1.05],[0,1.5],[-1.05,1.05],[-1.5,0],[-1.05,-1.05],[0,-1.5],[1.05,-1.05]]},
      {o:[-50,3.4*s,.4],pts:[[1.3,0],[.9,.9],[0,1.3],[-.9,.9],[-1.3,0],[-.9,-.9],[0,-1.3],[.9,-.9]]},
    ],NOZZLE,{capStart:false,capEnd:false});
    T.push({v:[[-50,3.4*s+1.2,.4],[-50,3.4*s-1.2,.4],[-50.2,3.4*s,1.4]],c:CYAN,e:.95});
    T.push({v:[[-50,3.4*s-1.2,.4],[-50,3.4*s+1.2,.4],[-50.2,3.4*s,-.7]],c:CYAN,e:.95});
  }
  // --- chine accent lights
  T.push({v:[[20,7.2,.9],[14,9.8,.9],[15,9.2,1.3]],c:CYAN,e:.6});
  T.push({v:[[20,-7.2,.9],[15,-9.2,1.3],[14,-9.8,.9]],c:CYAN,e:.6});
  return {tris:T,len:100,name:'f47'};
}

function buildB2(){
  const T=[];
  // spanwise diamond-airfoil loft -> flying wing with sawtooth trailing edge
  const secs=[
    {y:-52,le:-14,te:-22,th:1.0},
    {y:-40,le:-2, te:-20,th:2.2},
    {y:-30,le:8,  te:-8, th:3.4},
    {y:-20,le:18, te:-20,th:4.6},
    {y:-12,le:26, te:-6, th:5.4},
    {y:-4, le:34, te:-16,th:6.4},
    {y:0,  le:38, te:-10,th:7.0},
    {y:4,  le:34, te:-16,th:6.4},
    {y:12, le:26, te:-6, th:5.4},
    {y:20, le:18, te:-20,th:4.6},
    {y:30, le:8,  te:-8, th:3.4},
    {y:40, le:-2, te:-20,th:2.2},
    {y:52, le:-14,te:-22,th:1.0},
  ];
  loft(T,secs.map(s=>{
    const xm=(s.le+s.te)/2;
    return {o:[0,s.y,0],pts:[[s.le,0],[xm,s.th*.42],[s.te,0],[xm,-s.th*.32]]};
  }),DARK,{uDir:[1,0,0],vDir:[0,0,1]});
  // cockpit hump
  loft(T,[
    {o:[30,0,2.6],pts:[[.5,0],[0,.3],[-.5,0]]},
    {o:[22,0,3.0],pts:[[3.2,0],[0,2.6],[-3.2,0]]},
    {o:[12,0,3.0],pts:[[3.6,0],[0,2.4],[-3.6,0]]},
    {o:[4,0,2.6], pts:[[1.4,0],[0,.6],[-1.4,0]]},
  ],[48,56,68],{uDir:[0,1,0],vDir:[0,0,1]});
  // intake ridges + emissive exhaust slits on top rear
  for(const s of [1,-1]){
    quad(T,[2,9*s,2.6],[-6,9*s,2.5],[-6,13*s,2.2],[2,13*s,2.3],[40,46,56]);
    quad(T,[-8,8.4*s,2.45],[-12,8.4*s,2.4],[-12,12.6*s,2.1],[-8,12.6*s,2.15],CYAN,.7);
  }
  return {tris:T,len:92,name:'b2'};
}

/* ============================ renderer ============================ */
const L_KEY=norm([-.35,.45,.82]);            // warm key light, upper front-left
const L_FILL=norm([.45,-.5,-.25]);           // cyan fill from below-right
function shade(base,n,eye,e){
  const kd=Math.max(0,dot(n,L_KEY));
  const kf=Math.max(0,dot(n,L_FILL));
  const rim=Math.pow(1-Math.max(0,dot(n,eye)),3)*.30;
  const amb=.20;
  const r=base[0]*(amb+.92*kd)+18*kf+40*rim+e*base[0]*1.2;
  const g=base[1]*(amb+.92*kd)+34*kf+90*rim+e*base[1]*1.2;
  const b=base[2]*(amb+.88*kd)+44*kf+120*rim+e*base[2]*1.2;
  return [Math.min(255,r),Math.min(255,g),Math.min(255,b)];
}

/** Render one frame into rgbaOut at (ox,oy) inside an atlas buffer. */
function renderFrame(model,azDeg,elDeg,cell,atlas,atlasW,ox,oy,scaleWorld){
  const az=azDeg*Math.PI/180, el=elDeg*Math.PI/180;
  const eye=[Math.cos(el)*Math.cos(az),Math.cos(el)*Math.sin(az),Math.sin(el)];
  const f=[-eye[0],-eye[1],-eye[2]];
  let r0=cross(f,[0,0,1]);
  if(Math.hypot(...r0)<1e-6)r0=[0,1,0];
  r0=norm(r0);
  let u0=norm(cross(r0,f));
  // roll camera so the nose (+X) projects screen-up
  const nr=dot([1,0,0],r0),nu=dot([1,0,0],u0);
  let phi=(Math.abs(nr)+Math.abs(nu)<1e-4)?0:Math.atan2(nr,nu);
  const cph=Math.cos(phi),sph=Math.sin(phi);
  const R=[r0[0]*cph-u0[0]*sph,r0[1]*cph-u0[1]*sph,r0[2]*cph-u0[2]*sph];
  const U=[r0[0]*sph+u0[0]*cph,r0[1]*sph+u0[1]*cph,r0[2]*sph+u0[2]*cph];

  const W=cell*SS,H=cell*SS,half=W/2;
  const px=new Float32Array(W*H*3);
  const cov=new Uint8Array(W*H);
  const zb=new Float32Array(W*H).fill(-1e9);
  const s=scaleWorld*SS;

  for(const t of model.tris){
    const P=t.v.map(p=>[half+dot(p,R)*s,half-dot(p,U)*s,dot(p,eye)]);
    let n=norm(cross(sub(t.v[1],t.v[0]),sub(t.v[2],t.v[0])));
    if(dot(n,eye)<0)n=[-n[0],-n[1],-n[2]];
    const col=shade(t.c,n,eye,t.e||0);
    const minX=Math.max(0,Math.floor(Math.min(P[0][0],P[1][0],P[2][0])));
    const maxX=Math.min(W-1,Math.ceil(Math.max(P[0][0],P[1][0],P[2][0])));
    const minY=Math.max(0,Math.floor(Math.min(P[0][1],P[1][1],P[2][1])));
    const maxY=Math.min(H-1,Math.ceil(Math.max(P[0][1],P[1][1],P[2][1])));
    const [a,b,c]=P;
    const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(Math.abs(area)<1e-9)continue;
    const inv=1/area;
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const qx=x+.5,qy=y+.5;
      const w0=((b[0]-a[0])*(qy-a[1])-(b[1]-a[1])*(qx-a[0]))*inv;
      const w1=((c[0]-b[0])*(qy-b[1])-(c[1]-b[1])*(qx-b[0]))*inv;
      if(w0<0||w1<0||w0+w1>1)continue;
      const z=a[2]*w1+b[2]*(1-w0-w1)+c[2]*w0; // barycentric depth (E_ab->c, E_bc->a)
      const idx=y*W+x;
      if(z<=zb[idx])continue;
      zb[idx]=z;
      px[idx*3]=col[0];px[idx*3+1]=col[1];px[idx*3+2]=col[2];
      cov[idx]=1;
    }
  }
  // downsample SS x SS -> cell, write into atlas rgba
  for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){
    let r=0,g=0,b=0,a=0;
    for(let sy=0;sy<SS;sy++)for(let sx=0;sx<SS;sx++){
      const i=(y*SS+sy)*W+(x*SS+sx);
      if(cov[i]){r+=px[i*3];g+=px[i*3+1];b+=px[i*3+2];a++;}
    }
    if(!a)continue;
    const o=((oy+y)*atlasW+(ox+x))*4;
    atlas[o]=r/a;atlas[o+1]=g/a;atlas[o+2]=b/a;atlas[o+3]=255*a/(SS*SS);
  }
}

/* ============================ bake ============================ */
function bake(model){
  // bounding radius for uniform scale
  let R=0;
  for(const t of model.tris)for(const p of t.v)R=Math.max(R,Math.hypot(...p));
  const scaleWorld=(CELL*.94)/(2*R);
  const atlasW=CELL*AZ_STEPS,atlasH=CELL*ELEVATIONS.length;
  const atlas=Buffer.alloc(atlasW*atlasH*4);
  for(let row=0;row<ELEVATIONS.length;row++){
    for(let i=0;i<AZ_STEPS;i++){
      renderFrame(model,i*(360/AZ_STEPS),ELEVATIONS[row],CELL,atlas,atlasW,i*CELL,row*CELL,scaleWorld);
    }
    process.stdout.write(`  ${model.name} el=${ELEVATIONS[row]} done\n`);
  }
  const outDir=join(ROOT,'public','assets','sprites');
  mkdirSync(outDir,{recursive:true});
  writeFileSync(join(outDir,`${model.name}.atlas.png`),encodePNG(atlasW,atlasH,atlas));
  // big preview frame for quality check
  const PV=256,pvBuf=Buffer.alloc(PV*PV*4);
  renderFrame(model,205,18,PV,pvBuf,PV,0,0,scaleWorld*(PV/CELL));
  writeFileSync(join(ROOT,'tools','sprite-baker',`preview-${model.name}.png`),encodePNG(PV,PV,pvBuf));
  return {cell:CELL,cols:AZ_STEPS,elevations:ELEVATIONS,
          pxPerUnit:+(scaleWorld).toFixed(5),lenUnits:model.len,
          src:`/assets/sprites/${model.name}.atlas.png`};
}

const meta={};
for(const m of [buildF47(),buildB2()]){
  console.log(`baking ${m.name} (${m.tris.length} tris)…`);
  meta[m.name]=bake(m);
}
const metaJs=`// AUTO-GENERATED by tools/sprite-baker/bake-procedural.mjs — do not edit by hand.
// Regenerate: node tools/sprite-baker/bake-procedural.mjs
export const SPRITE_ATLAS_META=${JSON.stringify(meta,null,2)};
`;
writeFileSync(join(ROOT,'src','data','spriteAtlasMeta.js'),metaJs);
console.log('wrote src/data/spriteAtlasMeta.js');
console.log('done.');
