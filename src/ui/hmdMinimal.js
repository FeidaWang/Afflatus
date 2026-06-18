/**
 * Minimal HMD primitives — Star Citizen / SpaceX-telecast design language.
 * Rules: thin 1px strokes, sparse marks, one accent color per state,
 * real objects instead of placeholder glyphs, generous negative space.
 * All functions draw with the current ctx transform; no global state.
 */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

export const HMD={
  cyan:'rgba(140,232,255,.92)',
  cyanSoft:'rgba(140,232,255,.40)',
  cyanFaint:'rgba(140,232,255,.16)',
  green:'rgba(120,255,178,.92)',
  red:'rgba(255,92,98,.92)',
  amber:'rgba(255,205,128,.9)',
  ink:'rgba(226,240,248,.92)',
  font:(px)=>`${px}px 'JetBrains Mono',monospace`,
};

/** Four thin corner ticks instead of a full frame. */
export function cornerFrame(ctx,w,h,color=HMD.cyanFaint,m=9,len=14){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(m,m+len);ctx.lineTo(m,m);ctx.lineTo(m+len,m);
  ctx.moveTo(w-m-len,m);ctx.lineTo(w-m,m);ctx.lineTo(w-m,m+len);
  ctx.moveTo(w-m,h-m-len);ctx.lineTo(w-m,h-m);ctx.lineTo(w-m-len,h-m);
  ctx.moveTo(m+len,h-m);ctx.lineTo(m,h-m);ctx.lineTo(m,h-m-len);
  ctx.stroke();ctx.restore();
}

/** Slim top heading tape: value + 5 ticks, nothing else. */
export function headingTape(ctx,w,h,heading,color=HMD.cyan){
  const y=h*.115, half=w*.13;
  ctx.save();ctx.lineWidth=1;ctx.strokeStyle=HMD.cyanSoft;
  ctx.beginPath();ctx.moveTo(w*.5-half,y);ctx.lineTo(w*.5+half,y);ctx.stroke();
  for(let i=-2;i<=2;i++){
    const x=w*.5+i*half/2.2;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+(i===0?6:3.5));ctx.stroke();
  }
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.font=HMD.font(Math.max(10,Math.min(15,w*.030)));
  ctx.fillText(String(Math.round(heading)).padStart(3,'0'),w*.5,y-4);
  ctx.restore();
}

/** Thin lateral arc gauge (SC style). side: -1 left, +1 right. v: 0..1 */
export function arcGauge(ctx,w,h,side,v,label,valueText,color=HMD.cyan){
  const cx=w*.5+side*w*.31, cy=h*.46, r=Math.min(w,h)*.27;
  const a0=Math.PI*.5+side*Math.PI*.18, a1=-Math.PI*.5-side*Math.PI*.18;
  ctx.save();ctx.lineWidth=1;ctx.strokeStyle=HMD.cyanFaint;
  ctx.beginPath();ctx.arc(cx,cy,r,Math.min(a0,a1),Math.max(a0,a1));ctx.stroke();
  // 5 ticks
  ctx.strokeStyle=HMD.cyanSoft;
  for(let i=0;i<=4;i++){
    const a=lerp(a0,a1,i/4);
    const x1=cx+Math.cos(a)*r, y1=cy+Math.sin(a)*r;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(cx+Math.cos(a)*(r-5),cy+Math.sin(a)*(r-5));ctx.stroke();
  }
  // value marker
  const av=lerp(a0,a1,clamp(v,0,1));
  ctx.strokeStyle=color;ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(cx+Math.cos(av)*(r+4),cy+Math.sin(av)*(r+4));
  ctx.lineTo(cx+Math.cos(av)*(r-7),cy+Math.sin(av)*(r-7));ctx.stroke();
  ctx.fillStyle=color;ctx.font=HMD.font(Math.max(7,Math.min(10,w*.021)));
  ctx.textAlign=side<0?'left':'right';ctx.textBaseline='middle';
  const tx=cx+side*-(r*.34);
  ctx.fillStyle=HMD.cyanSoft;ctx.fillText(label,tx,cy-9);
  ctx.fillStyle=color;ctx.fillText(valueText,tx,cy+5);
  ctx.restore();
}

/** Small fixed boresight + flight-path marker. */
export function boresight(ctx,w,h,color=HMD.cyanSoft){
  const cx=w*.5, cy=h*.46;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(cx-9,cy);ctx.lineTo(cx-3,cy);
  ctx.moveTo(cx+3,cy);ctx.lineTo(cx+9,cy);
  ctx.moveTo(cx,cy-7);ctx.lineTo(cx,cy-3);
  ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,1.2,0,TAU);ctx.stroke();
  ctx.restore();
}

/** The target itself: a glowing comet head + ion tail (a real object, not a glyph). */
export function cometTarget(ctx,x,y,r,now,vx=-1,vy=.3){
  ctx.save();ctx.globalCompositeOperation='lighter';
  const tl=Math.hypot(vx,vy)||1, ux=-vx/tl, uy=-vy/tl;
  // tail
  const tailLen=r*7;
  const tg=ctx.createLinearGradient(x,y,x+ux*tailLen,y+uy*tailLen);
  tg.addColorStop(0,'rgba(190,228,255,.34)');
  tg.addColorStop(.4,'rgba(120,180,255,.12)');
  tg.addColorStop(1,'rgba(120,180,255,0)');
  ctx.fillStyle=tg;
  ctx.beginPath();
  ctx.moveTo(x+uy*r*.8,y-ux*r*.8);
  ctx.lineTo(x+ux*tailLen+uy*r*2.2,y+uy*tailLen-ux*r*2.2);
  ctx.lineTo(x+ux*tailLen-uy*r*2.2,y+uy*tailLen+ux*r*2.2);
  ctx.lineTo(x-uy*r*.8,y+ux*r*.8);
  ctx.closePath();ctx.fill();
  // coma
  const g=ctx.createRadialGradient(x,y,0,x,y,r*3);
  g.addColorStop(0,'rgba(255,248,230,.95)');
  g.addColorStop(.25,'rgba(255,214,160,.55)');
  g.addColorStop(.6,'rgba(232,150,90,.18)');
  g.addColorStop(1,'rgba(232,150,90,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*3,0,TAU);ctx.fill();
  // nucleus
  ctx.fillStyle='rgba(255,252,244,.96)';
  ctx.beginPath();ctx.arc(x,y,Math.max(1.4,r*.55),0,TAU);ctx.fill();
  // sparkle dust
  for(let i=0;i<5;i++){
    const a=now/300+i*2.2, rr=r*(1.4+(i%3)*.8);
    ctx.fillStyle=`rgba(255,226,180,${.18+.12*Math.sin(now/140+i)})`;
    ctx.fillRect(x+Math.cos(a)*rr+ux*r*i*.8,y+Math.sin(a)*rr+uy*r*i*.8,1.2,1.2);
  }
  ctx.restore();
}

/** SC-style target bracket: 4 thin corners that tighten with lock progress. */
export function targetBracket(ctx,x,y,size,lock,locked,now,rangeText='',name='',colorOverride=null){
  const color=colorOverride||(locked?HMD.green:HMD.cyan);
  const s=size*lerp(1.5,1.0,clamp(lock,0,1));
  const g=s*.34;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.moveTo(x-s,y-s+g);ctx.lineTo(x-s,y-s);ctx.lineTo(x-s+g,y-s);
  ctx.moveTo(x+s-g,y-s);ctx.lineTo(x+s,y-s);ctx.lineTo(x+s,y-s+g);
  ctx.moveTo(x+s,y+s-g);ctx.lineTo(x+s,y+s);ctx.lineTo(x+s-g,y+s);
  ctx.moveTo(x-s+g,y+s);ctx.lineTo(x-s,y+s);ctx.lineTo(x-s,y+s-g);
  ctx.stroke();
  if(!locked){ // sweep tick orbiting until locked
    const a=now/260;
    ctx.beginPath();ctx.arc(x,y,s*1.18,a,a+.5);ctx.stroke();
  }
  ctx.fillStyle=color;ctx.font=HMD.font(Math.max(7,s*.30));
  ctx.textAlign='left';ctx.textBaseline='top';
  if(name)ctx.fillText(name,x+s+6,y-s);
  ctx.fillStyle=HMD.ink;
  if(rangeText)ctx.fillText(rangeText,x+s+6,y-s+11);
  if(locked){ctx.fillStyle=HMD.green;ctx.fillText('LOCK',x+s+6,y-s+22);}
  ctx.restore();
}

/** Single bottom telemetry line — text only, faint underline, no box. */
export function telemetryLine(ctx,w,h,leftText,rightText,color=HMD.cyan){
  const y=h-12;
  ctx.save();
  ctx.strokeStyle=HMD.cyanFaint;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(w*.06,y-11);ctx.lineTo(w*.94,y-11);ctx.stroke();
  ctx.font=HMD.font(Math.max(7,Math.min(10,w*.020)));
  ctx.textBaseline='alphabetic';
  ctx.fillStyle=color;ctx.textAlign='left';ctx.fillText(leftText,w*.06,y);
  ctx.fillStyle=HMD.cyanSoft;ctx.textAlign='right';ctx.fillText(rightText,w*.94,y);
  ctx.restore();
}

/** Tiny status label, top-left; optional blinking dot. */
export function statusChip(ctx,w,h,text,color=HMD.cyanSoft,blink=false,now=0){
  ctx.save();
  ctx.font=HMD.font(Math.max(7,Math.min(9,w*.019)));
  ctx.textAlign='left';ctx.textBaseline='top';
  let x=12;
  if(blink){
    ctx.fillStyle=`rgba(255,92,98,${.4+.6*(Math.sin(now/300)>0?1:0)})`;
    ctx.beginPath();ctx.arc(x+2.5,16,2.5,0,TAU);ctx.fill();
    x+=10;
  }
  ctx.fillStyle=color;ctx.fillText(text,x,12);
  ctx.restore();
}

/** CIWS tracer stream: fine bright dashes converging from a corner to target. */
export function tracerStream(ctx,fromX,fromY,toX,toY,now,seed=0,count=9){
  ctx.save();ctx.globalCompositeOperation='lighter';
  const dx=toX-fromX,dy=toY-fromY,len=Math.hypot(dx,dy)||1;
  const px=-dy/len,py=dx/len;
  for(let i=0;i<count;i++){
    const phase=((i/count)+now/150+seed)%1;
    const spread=Math.sin(i*73.1+seed*7)*3.2;
    const x0=fromX+px*spread, y0=fromY+py*spread;
    const x1=toX+px*spread*.4, y1=toY+py*spread*.4;
    ctx.strokeStyle=i%4===0?'rgba(255,232,170,.9)':'rgba(140,232,255,.65)';
    ctx.lineWidth=i%4===0?1.4:1;
    for(const ph of [phase,(phase+.37)%1,(phase+.71)%1]){
      ctx.beginPath();
      ctx.moveTo(lerp(x0,x1,ph),lerp(y0,y1,ph));
      ctx.lineTo(lerp(x0,x1,Math.min(1,ph+.04)),lerp(y0,y1,Math.min(1,ph+.04)));
      ctx.stroke();
    }
  }
  // muzzle glow
  const mg=ctx.createRadialGradient(fromX,fromY,0,fromX,fromY,16);
  mg.addColorStop(0,`rgba(255,240,200,${.5+.3*Math.sin(now/30+seed)})`);
  mg.addColorStop(1,'rgba(255,200,120,0)');
  ctx.fillStyle=mg;ctx.beginPath();ctx.arc(fromX,fromY,16,0,TAU);ctx.fill();
  ctx.restore();
}

/** Impact sparks at the target point. */
export function impactSparks(ctx,x,y,now,intensity=1){
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<6;i++){
    const a=(now/90+i*1.05)%TAU, r=3+((now/40+i*37)%14);
    ctx.fillStyle=`rgba(255,${200+(i%3)*20},150,${(.55-r*.03)*intensity})`;
    ctx.fillRect(x+Math.cos(a)*r,y+Math.sin(a)*r,1.4,1.4);
  }
  ctx.restore();
}
