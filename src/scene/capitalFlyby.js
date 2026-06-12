/**
 * Star-destroyer-class layered side-view flyby ("opening shot").
 * The hull, greebles and window lights are drawn ONCE into offscreen
 * canvases, then the cinematic is just a few drawImage calls per frame
 * plus live engine glow / light sweep — near-zero GPU cost on mobile.
 * Used as the charging phase of the Enforcer main gun camera.
 */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const mulberry=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let z=Math.imul(seed^seed>>>15,1|seed);z=z+Math.imul(z^z>>>7,61|z)^z;return ((z^z>>>14)>>>0)/4294967296;};

export function createCapitalFlyby(){
  const HW=1680, HH=420;     // hull layer canvas size
  let hull=null, lights=null;

  // dagger profile, prow at the RIGHT (sails right-to-left across frame)
  function hullPath(c){
    c.beginPath();
    c.moveTo(1650,268);                 // prow tip
    c.lineTo(960,196);c.lineTo(560,176);c.lineTo(250,184);   // dorsal deck line
    c.lineTo(150,196);c.lineTo(120,232);                     // stern top
    c.lineTo(120,318);c.lineTo(170,338);                     // stern face
    c.lineTo(540,352);c.lineTo(1150,322);                    // ventral line
    c.closePath();
  }

  function buildLayers(){
    const rnd=mulberry(20260611);
    hull=document.createElement('canvas');hull.width=HW;hull.height=HH;
    const c=hull.getContext('2d');

    // base hull
    const g=c.createLinearGradient(0,150,0,360);
    g.addColorStop(0,'#5a6878');g.addColorStop(.32,'#3c4856');
    g.addColorStop(.62,'#222c38');g.addColorStop(1,'#0c1219');
    c.fillStyle=g;hullPath(c);c.fill();
    c.save();hullPath(c);c.clip();

    // hull plating bands
    c.strokeStyle='rgba(8,12,18,.55)';c.lineWidth=1;
    [222,252,284,312,336].forEach(y=>{c.beginPath();c.moveTo(60,y);c.lineTo(1660,y-((y-230)*.18));c.stroke();});
    // vertical panel seams with jitter
    for(let x=140;x<1640;x+=18+rnd()*26){
      c.strokeStyle=`rgba(10,16,24,${.18+rnd()*.3})`;
      c.beginPath();c.moveTo(x,170);c.lineTo(x-8,360);c.stroke();
    }
    // greebles: surface machinery boxes
    for(let i=0;i<330;i++){
      const x=130+rnd()*1480, y=195+rnd()*150;
      const ww=2+rnd()*16, hh=1.5+rnd()*6, v=rnd();
      c.fillStyle=v<.5?`rgba(12,18,26,${.4+v})`:`rgba(130,148,166,${.12+v*.18})`;
      c.fillRect(x,y,ww,hh);
    }
    // lateral trench
    c.fillStyle='rgba(4,8,13,.85)';c.fillRect(170,282,1330,9);
    c.fillStyle='rgba(120,200,235,.10)';c.fillRect(170,284,1330,2);
    c.restore();

    // terraced superstructure + bridge tower
    const deck=(x,y,w2,h2,tone)=>{
      const dg=c.createLinearGradient(0,y,0,y+h2);
      dg.addColorStop(0,`rgba(${tone+34},${tone+44},${tone+56},1)`);
      dg.addColorStop(1,`rgba(${tone},${tone+8},${tone+18},1)`);
      c.fillStyle=dg;
      c.beginPath();c.moveTo(x+10,y);c.lineTo(x+w2-14,y);c.lineTo(x+w2,y+h2);c.lineTo(x,y+h2);c.closePath();c.fill();
      c.strokeStyle='rgba(150,170,190,.22)';c.strokeRect(x+4,y+2,w2-10,1);
    };
    deck(300,160,560,28,38);
    deck(340,136,420,26,46);
    deck(380,112,260,26,54);
    deck(420,84,130,30,62);          // bridge tower
    c.fillStyle='#16202c';c.fillRect(430,72,110,14);   // bridge deck
    // command bridge "eyes"
    c.fillStyle='#0a141e';c.beginPath();c.arc(448,70,9,0,TAU);c.fill();c.beginPath();c.arc(522,70,9,0,TAU);c.fill();
    c.strokeStyle='rgba(140,220,255,.4)';c.beginPath();c.arc(448,70,9,0,TAU);c.stroke();c.beginPath();c.arc(522,70,9,0,TAU);c.stroke();
    // sensor mast
    c.strokeStyle='rgba(160,180,200,.6)';c.lineWidth=2;
    c.beginPath();c.moveTo(485,72);c.lineTo(485,30);c.stroke();
    c.fillStyle='rgba(255,90,98,.9)';c.beginPath();c.arc(485,28,2.6,0,TAU);c.fill();
    // dorsal turrets
    for(const tx of [700,800,900,1010,1120]){
      c.fillStyle='#28323e';c.fillRect(tx,182,26,8);
      c.fillStyle='#36424f';c.beginPath();c.arc(tx+13,182,7,Math.PI,0);c.fill();
      c.strokeStyle='rgba(20,26,34,.8)';c.beginPath();c.moveTo(tx+13,176);c.lineTo(tx+34,170);c.stroke();
    }
    // engine block shells
    for(const [ey,er] of [[248,26],[296,30],[336,18]]){
      c.fillStyle='#0d141c';c.beginPath();c.arc(132,ey,er,Math.PI*.5,Math.PI*1.5);c.fill();
      c.strokeStyle='rgba(120,160,190,.35)';c.beginPath();c.arc(132,ey,er,Math.PI*.5,Math.PI*1.5);c.stroke();
    }
    // dorsal rim light (key light from above)
    c.strokeStyle='rgba(168,216,245,.5)';c.lineWidth=1.6;
    c.beginPath();c.moveTo(1648,267);c.lineTo(960,197);c.lineTo(560,177);c.lineTo(252,185);c.stroke();

    // ---- window lights layer
    lights=document.createElement('canvas');lights.width=HW;lights.height=HH;
    const lc=lights.getContext('2d');
    for(let i=0;i<240;i++){
      const x=200+rnd()*1380;
      const band=rnd();
      const y=band<.55?236+rnd()*38:(band<.8?300+rnd()*22:200+rnd()*18);
      const warm=rnd()<.78;
      lc.fillStyle=warm?`rgba(255,224,168,${.4+rnd()*.6})`:`rgba(140,230,255,${.4+rnd()*.6})`;
      lc.fillRect(x,y,rnd()<.2?2.5:1.4,1.4);
    }
    // bridge windows
    for(let i=0;i<10;i++)lc.fillRect(436+i*9,90,4,2);
  }

  function starStreaks(ctx,w,h,now,speed){
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<26;i++){
      const seed=i*131.7;
      const y=(seed*7.3)%h;
      const x=w-((seed*11.9+now*speed*(.4+(i%5)*.22))%(w+140))+70;
      const len=10+(i%5)*16;
      const a=.06+(i%5)*.05;
      const grad=ctx.createLinearGradient(x,y,x+len,y);
      grad.addColorStop(0,'rgba(154,229,255,0)');grad.addColorStop(1,`rgba(220,242,255,${a})`);
      ctx.strokeStyle=grad;ctx.lineWidth=i%7===0?1.6:1;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+len,y);ctx.stroke();
    }
    ctx.restore();
  }

  function drawEngineGlow(ctx,x,y,s,now){
    const flick=.8+.2*Math.sin(now/47)+.06*Math.sin(now/13);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const [ey,er] of [[248,26],[296,30],[336,18]]){
      const gx=x+126*s, gy=y+ey*s, rr=er*s;
      const core=ctx.createRadialGradient(gx,gy,0,gx,gy,rr*1.05);
      core.addColorStop(0,'rgba(255,255,255,.85)');
      core.addColorStop(.4,'rgba(170,244,255,.5)');
      core.addColorStop(1,'rgba(120,210,255,0)');
      ctx.fillStyle=core;ctx.beginPath();ctx.arc(gx,gy,rr*1.05,0,TAU);ctx.fill();
      const g=ctx.createRadialGradient(gx,gy,0,gx,gy,rr*4.2*flick);
      g.addColorStop(0,'rgba(150,240,255,.40)');
      g.addColorStop(.4,'rgba(70,180,255,.14)');
      g.addColorStop(1,'rgba(60,170,255,0)');
      ctx.fillStyle=g;
      ctx.beginPath();ctx.ellipse(gx-rr*1.5,gy,rr*3.0*flick,rr*.62,0,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  function drawHullLights(ctx,x,y,s,shipW,now,sweepMs){
    ctx.save();
    ctx.globalAlpha=.78+.22*Math.sin(now/900);
    ctx.drawImage(lights,x,y,shipW,HH*s);
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<5;i++){
      const lx=x+(200+((now*.13+i*317)%1380))*s, ly=y+(230+(i*53%108))*s;
      ctx.fillStyle=`rgba(255,236,190,${.3+.3*Math.sin(now/120+i*2)})`;
      ctx.fillRect(lx,ly,2,2);
    }
    const sweepX=x+shipW*((now/sweepMs)%1);
    const sw=ctx.createLinearGradient(sweepX-90,0,sweepX+90,0);
    sw.addColorStop(0,'rgba(154,229,255,0)');sw.addColorStop(.5,'rgba(154,229,255,.07)');sw.addColorStop(1,'rgba(154,229,255,0)');
    ctx.fillStyle=sw;ctx.fillRect(x,y,shipW,HH*s);
    ctx.restore();
  }

  /** t01: 0..1 charge progress. Ship crosses right -> left. */
  function draw(ctx,w,h,now,t01,lang){
    if(!hull)buildLayers();
    const t=clamp(t01,0,1);
    // space backdrop
    ctx.fillStyle='rgba(2,4,8,.96)';ctx.fillRect(0,0,w,h);
    starStreaks(ctx,w,h,now,.9);

    // far escort silhouette, slow parallax (kept high & dim, clear of the hero hull)
    const sFar=(h/HH)*.11;
    const farX=w*.16-easeInOut(t)*w*.34;
    ctx.save();ctx.globalAlpha=.20;
    ctx.drawImage(hull,farX,h*.035,HW*sFar,HH*sFar);
    ctx.fillStyle='rgba(3,6,12,.6)';ctx.fillRect(farX,h*.035,HW*sFar,HH*sFar);
    ctx.restore();
    starStreaks(ctx,w,h,now*1.7+400,1.6);

    // hero hull pass
    const s=(h/HH)*.92;
    const shipW=HW*s;
    const x=lerp(w+shipW*.06,-shipW-40,easeInOut(t));
    const y=h*.10+Math.sin(t*Math.PI)*h*.02;
    ctx.drawImage(hull,x,y,shipW,HH*s);

    drawEngineGlow(ctx,x,y,s,now);
    drawHullLights(ctx,x,y,s,shipW,now,2600);

    // particle spine charging at the prow
    const prowX=x+1650*s, prowY=y+268*s;
    if(prowX>-40&&prowX<w+40){
      ctx.save();ctx.globalCompositeOperation='lighter';
      const cg=ctx.createRadialGradient(prowX,prowY,0,prowX,prowY,18+34*t);
      cg.addColorStop(0,`rgba(255,255,255,${.25+.65*t})`);
      cg.addColorStop(.4,`rgba(255,90,100,${.2+.5*t})`);
      cg.addColorStop(1,'rgba(255,60,80,0)');
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(prowX,prowY,18+34*t,0,TAU);ctx.fill();
      ctx.strokeStyle=`rgba(255,120,130,${.3+.5*t})`;ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(prowX,prowY,(10+26*t)*(1+.12*Math.sin(now/70)),0,TAU);ctx.stroke();
      ctx.restore();
    }

    // letterbox + charge HUD
    const bar=Math.max(10,h*.075);
    ctx.fillStyle='rgba(0,0,0,.82)';ctx.fillRect(0,0,w,bar);ctx.fillRect(0,h-bar,w,bar);
    const label=lang==='zh'?'执法者号 · 粒子脊柱充能':'ENFORCER · PARTICLE SPINE CHARGING';
    ctx.fillStyle='rgba(255,235,235,.88)';
    ctx.font=`${Math.max(7,Math.min(w,h)*.046)}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText(label,10,bar*.5);
    ctx.textAlign='right';
    ctx.fillStyle=`rgba(255,90,100,${.6+.4*Math.sin(now/140)})`;
    ctx.fillText(`${Math.round(t*100)}%`,w-10,bar*.5);
    ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(10,h-bar*.5,w-20,2);
    const pg=ctx.createLinearGradient(10,0,w-10,0);
    pg.addColorStop(0,'rgba(154,229,255,.9)');pg.addColorStop(1,'rgba(255,90,100,.95)');
    ctx.fillStyle=pg;ctx.fillRect(10,h-bar*.5,(w-20)*t,2);
  }

  /**
   * Ambient station-keeping exterior feed (looping, no progress/letterbox).
   * Camera slowly tracks along the hull; used by the Commander Terminal
   * "SHIP VIEW" page in place of the old star map.
   */
  function drawAmbient(ctx,w,h,now,lang){
    if(!hull)buildLayers();
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='rgba(2,4,8,.92)';ctx.fillRect(0,0,w,h);
    starStreaks(ctx,w,h,now,.16);

    // far escort: slow crossing every ~46s, kept below the status strip
    const period=46000, ft=(now%period)/period;
    const sFar=(h/HH)*.10;
    const fx=w*1.08-ft*(w*1.2+HW*sFar);
    ctx.save();ctx.globalAlpha=.18;
    ctx.drawImage(hull,fx,h*.16,HW*sFar,HH*sFar);
    ctx.fillStyle='rgba(3,6,12,.6)';ctx.fillRect(fx,h*.16,HW*sFar,HH*sFar);
    ctx.restore();
    starStreaks(ctx,w,h,now*1.5+300,.42);

    // hero hull: oversized so the hull body fills the frame; slow pan biased
    // toward the stern/bridge two-thirds (the prow tip is mostly empty space)
    const s=h/360, shipW=HW*s;
    const span=Math.max(0,shipW-w);
    const x=-span*(.06+.5*(.5+.5*Math.sin(now/26000)));
    const y=h*.10-58*s+Math.sin(now/9000)*h*.015;
    ctx.drawImage(hull,x,y,shipW,HH*s);
    drawEngineGlow(ctx,x,y,s,now);
    drawHullLights(ctx,x,y,s,shipW,now,5200);

    // top status strip (bottom-left is occupied by the HTML nav readout)
    const bar=Math.max(11,h*.10);
    const grad=ctx.createLinearGradient(0,0,0,bar);
    grad.addColorStop(0,'rgba(0,0,0,.72)');grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,bar);
    ctx.font=`${Math.max(6,Math.min(w,h)*.052)}px 'JetBrains Mono',monospace`;
    ctx.textBaseline='top';
    ctx.fillStyle='rgba(214,246,255,.85)';
    ctx.textAlign='left';
    ctx.fillText(lang==='zh'?'执法者号 · 舰体外景':'ENFORCER · EXTERNAL FEED',8,3);
    ctx.textAlign='right';
    const liveA=.45+.55*(Math.sin(now/420)>0?1:0);
    ctx.fillStyle=`rgba(255,90,98,${liveA})`;
    ctx.fillText('LIVE',w-8,3);
    const fpx=Math.max(6,Math.min(w,h)*.052);
    ctx.beginPath();ctx.arc(w-8-ctx.measureText('LIVE').width-fpx*.55,3+fpx*.42,fpx*.22,0,TAU);ctx.fill();
  }

  return {draw,drawAmbient,ready:()=>true};
}
