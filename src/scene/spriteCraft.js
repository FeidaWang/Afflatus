/**
 * Runtime renderer for baked multi-angle craft sprites.
 * Atlases are produced by tools/sprite-baker/bake-procedural.mjs (procedural)
 * or tools/sprite-baker/index.html (real glTF models).
 *
 * Conventions: every frame has the nose pointing screen-up.
 *  az  (deg): 0 = head-on, 90 = right side, 180 = tail view.
 *  el  (deg): 0 = horizon side view, 90 = top-down.
 * Elevation is blended between the two nearest baked rows (crossfade),
 * so takeoff/landing camera transitions look continuous.
 */
import {SPRITE_ATLAS_META} from '../data/spriteAtlasMeta.js';

export function createSpriteCraft(){
  const entries={};
  for(const [k,m] of Object.entries(SPRITE_ATLAS_META)){
    const img=new Image();
    // BASE_URL-safe: works at domain root and under /repo/ subpaths (GitHub Pages)
    const base=(import.meta.env&&import.meta.env.BASE_URL)||'/';
    img.src=base.replace(/\/$/,'/')+m.src.replace(/^\//,'');
    entries[k]={img,meta:m};
  }
  const readyFor=t=>{const e=entries[t];return !!(e&&e.img.complete&&e.img.naturalWidth);};

  /** Draw centered at current origin, nose up. size = craft length in px. */
  function drawOriented(ctx,type,{az=180,el=90,size=64,alpha=1}={}){
    const e=entries[type];
    if(!e||!e.img.complete||!e.img.naturalWidth) return false;
    const m=e.meta, els=m.elevations, azStep=360/m.cols;
    const a=((az%360)+360)%360;
    const fi=Math.round(a/azStep)%m.cols;
    let r0=0,r1=0,t=0;
    const elc=Math.max(els[0],Math.min(els[els.length-1],el));
    for(let i=0;i<els.length-1;i++){
      if(elc>=els[i]&&elc<=els[i+1]){r0=i;r1=i+1;t=(elc-els[i])/(els[i+1]-els[i]);break;}
    }
    if(elc<=els[0]){r0=r1=0;t=0;}
    if(elc>=els[els.length-1]){r0=r1=els.length-1;t=0;}
    const cell=m.cell;
    const drawPx=size/(m.lenUnits*m.pxPerUnit)*cell; // craft length == size px
    const half=drawPx/2;
    const base=ctx.globalAlpha;
    ctx.save();
    if(r0===r1){
      ctx.globalAlpha=base*alpha;
      ctx.drawImage(e.img,fi*cell,r0*cell,cell,cell,-half,-half,drawPx,drawPx);
    }else{
      if(t<.999){
        ctx.globalAlpha=base*alpha*(1-t);
        ctx.drawImage(e.img,fi*cell,r0*cell,cell,cell,-half,-half,drawPx,drawPx);
      }
      if(t>.001){
        ctx.globalAlpha=base*alpha*t;
        ctx.drawImage(e.img,fi*cell,r1*cell,cell,cell,-half,-half,drawPx,drawPx);
      }
    }
    ctx.restore();
    return true;
  }

  /** Draw at (x,y); rot = screen rotation in radians where 0 = nose up. */
  function draw(ctx,type,x,y,opts={}){
    if(!readyFor(type)) return false;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(opts.rot||0);
    const ok=drawOriented(ctx,type,opts);
    ctx.restore();
    return ok;
  }

  return {draw,drawOriented,readyFor,available:()=>Object.keys(entries).every(readyFor)};
}
