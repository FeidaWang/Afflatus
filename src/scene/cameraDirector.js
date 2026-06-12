/**
 * External cinematic cameras for the pilot feed:
 *  - drawExternalLaunch : deck catapult -> climb-away chase shot
 *  - drawExternalLanding: glide-slope approach -> touchdown
 * Both consume the baked multi-angle sprites, so the craft's visual
 * angle changes continuously through the sequence (side view on the
 * deck, rear three-quarter as it climbs, front quarter on approach).
 * Pure 2D: one drawImage per craft frame, mobile-safe.
 */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const easeOut=t=>1-Math.pow(1-t,3);
const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

export function createCameraDirector(sprite){

  function deckSlab(ctx,w,h,t,landing){
    // receding flight deck, lower part of frame
    const yTop=landing?h*(.62+.16*t):h*(.66+.22*easeOut(t));
    ctx.save();
    const g=ctx.createLinearGradient(0,yTop,0,h);
    g.addColorStop(0,'rgba(38,52,66,.92)');
    g.addColorStop(.4,'rgba(20,30,42,.96)');
    g.addColorStop(1,'rgba(6,10,16,.98)');
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.moveTo(-w*.05,yTop+h*.05);ctx.lineTo(w*.62,yTop);
    ctx.lineTo(w*1.05,h*1.02);ctx.lineTo(-w*.05,h*1.02);
    ctx.closePath();ctx.fill();
    // runway center lights, rushing past during launch
    ctx.globalCompositeOperation='lighter';
    const n=9, scroll=landing?t*2.2:t*5;
    for(let i=0;i<n;i++){
      const k=((i+scroll)%n)/n;
      const lx=lerp(w*.16,w*.86,k), ly=lerp(yTop+4,h*.99,k*k);
      const r=lerp(.8,3.4,k);
      ctx.fillStyle=`rgba(255,214,140,${.18+.5*k})`;
      ctx.beginPath();ctx.arc(lx,ly,r,0,TAU);ctx.fill();
    }
    // deck edge strobe
    ctx.fillStyle=`rgba(120,235,255,${.35+.35*Math.sin(t*40)})`;
    ctx.fillRect(w*.6,yTop-1.5,w*.4,2);
    ctx.restore();
    return yTop;
  }

  function engineFlare(ctx,x,y,rot,len,intensity){
    ctx.save();
    ctx.translate(x,y);ctx.rotate(rot);
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(0,len*.46,0,0,len*.62,len*.5);
    g.addColorStop(0,`rgba(255,255,255,${.85*intensity})`);
    g.addColorStop(.3,`rgba(140,240,255,${.6*intensity})`);
    g.addColorStop(1,'rgba(40,160,255,0)');
    ctx.fillStyle=g;
    ctx.beginPath();ctx.ellipse(0,len*.58,len*.1,len*.34*intensity,0,0,TAU);ctx.fill();
    ctx.restore();
  }

  function speedLines(ctx,w,h,t,dir=-1){
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle='rgba(154,229,255,.16)';
    for(let i=0;i<10;i++){
      const seed=i*97.3, x=(seed*7%w), y=(seed*13%h);
      const len=(8+i*6)*t*2.2;
      ctx.lineWidth=i%3?1:1.6;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-len*.4,y-dir*len);ctx.stroke();
    }
    ctx.restore();
  }

  function banner(ctx,w,h,now,label){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.55)';
    ctx.fillRect(0,0,w,18);ctx.fillRect(0,h-16,w,16);
    ctx.fillStyle='rgba(154,229,255,.85)';
    ctx.font=`${Math.max(7,Math.min(w,h)*.045)}px 'JetBrains Mono',monospace`;
    ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText(label,w*.5,4);
    ctx.fillStyle=`rgba(255,77,91,${.5+.4*Math.sin(now/180)})`;
    ctx.beginPath();ctx.arc(12,9,3,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(220,232,245,.6)';
    ctx.font=`${Math.max(6,Math.min(w,h)*.032)}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.fillText('REC',20,5);
    ctx.restore();
  }

  function drawExternalLaunch(ctx,w,h,now,elapsed,lang,type='f47'){
    const t=clamp(elapsed,0,1), u=Math.min(w,h);
    const yDeck=deckSlab(ctx,w,h,t,false);
    // craft path: deck run -> rotate -> climb away from camera
    const run=clamp(t/.42,0,1), climb=clamp((t-.42)/.58,0,1);
    const x=lerp(w*.18,w*.52,easeOut(run))+lerp(0,w*.16,easeInOut(climb));
    const y=lerp(yDeck-u*.06,yDeck-u*.08,run)-easeInOut(climb)*h*.46;
    const size=u*lerp(.62,.20,easeInOut(climb));
    // visual angle: pure side on deck -> rear three-quarter climbing out
    const el=lerp(10,46,climb);
    const az=lerp(96,168,easeInOut(climb));
    const rot=lerp(Math.PI/2, .9, easeOut(run))-climb*1.15; // nose right -> pitching up
    engineFlare(ctx,x,y,rot,size,run>.2?(.7+.3*Math.sin(now/40)):.2);
    sprite.draw(ctx,type,x,y,{rot,az,el,size});
    if(climb>0) speedLines(ctx,w,h,climb,1);
    // catapult shock ring at rotate moment
    if(run>.9&&climb<.3){
      ctx.save();ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle=`rgba(120,235,255,${.5*(1-climb/.3)})`;
      ctx.lineWidth=1.4;
      ctx.beginPath();ctx.arc(x,y,size*.6*(1+climb*3),0,TAU);ctx.stroke();
      ctx.restore();
    }
    banner(ctx,w,h,now,lang==='zh'?'外部跟拍 · 甲板弹射':'EXTERNAL CAM · DECK CATAPULT');
  }

  function drawExternalLanding(ctx,w,h,now,elapsed,lang,type='f47'){
    const t=clamp(elapsed,0,1), u=Math.min(w,h);
    const yDeck=deckSlab(ctx,w,h,t,true);
    // approach: small & high front-quarter -> flare -> touchdown side view
    const app=clamp(t/.72,0,1), flare=clamp((t-.72)/.28,0,1);
    const x=lerp(w*.78,w*.34,easeInOut(app))-flare*w*.06;
    const y=lerp(h*.16,yDeck-u*.10,easeInOut(app))+flare*u*.045;
    const size=u*lerp(.16,.5,easeOut(app));
    const el=lerp(34,10,app);
    const az=lerp(22,86,easeInOut(app));        // front quarter -> side
    const rot=lerp(-2.2,-Math.PI/2,easeInOut(app))+flare*.12; // nose-left, flaring
    // glide slope guides
    ctx.save();ctx.strokeStyle='rgba(93,255,157,.30)';ctx.setLineDash([5,7]);
    ctx.beginPath();ctx.moveTo(w*.86,h*.10);ctx.lineTo(w*.30,yDeck-u*.06);ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
    engineFlare(ctx,x,y,rot,size,.35+.2*Math.sin(now/60));
    sprite.draw(ctx,type,x,y,{rot,az,el,size});
    // touchdown skid sparks
    if(flare>.55){
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(let i=0;i<6;i++){
        ctx.fillStyle=`rgba(255,${190+Math.random()*60|0},120,${.5*Math.random()})`;
        ctx.fillRect(x-size*.2+Math.random()*size*.4,y+size*.16,2,2);
      }
      ctx.restore();
    }
    banner(ctx,w,h,now,lang==='zh'?'外部跟拍 · 捕获着舰':'EXTERNAL CAM · ARRESTED LANDING');
  }

  return {
    available:()=>sprite.available(),
    drawExternalLaunch,
    drawExternalLanding,
  };
}
