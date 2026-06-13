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

// Stern thruster nacelles (shared by the baked bells + the live exhaust glow).
// y = vertical centre in hull-space, r = bell radius. Bells sit at the stern
// face (left); plumes fire further left as the ship sails right -> left.
const ENGINES=[ {y:208,r:16}, {y:250,r:24}, {y:300,r:24}, {y:344,r:16} ];
const STERN_X=150;            // nacelle bell centre x
const PROW_X=1650, PROW_Y=268; // main-gun muzzle (charge glow anchors here)

export function createCapitalFlyby(){
  const HW=1680, HH=420;     // hull layer canvas size
  let hull=null, lights=null;

  // Chunky industrial-warship profile (fig2 language): a thick slab body, a
  // stern engine deck, and a forward main-gun barrel. Prow at the RIGHT.
  function hullPath(c){
    c.beginPath();
    c.moveTo(1648,256);          // gun muzzle, top
    c.lineTo(1492,250);          // gun base, top
    c.lineTo(1300,214);          // forward dorsal shoulder
    c.lineTo(720,200);           // long flat dorsal deck
    c.lineTo(300,202);
    c.lineTo(176,214);           // stern shoulder
    c.lineTo(176,238);
    c.lineTo(116,238);           // engine deck overhang (top)
    c.lineTo(116,336);           // engine deck (back face)
    c.lineTo(176,336);
    c.lineTo(176,356);           // stern keel
    c.lineTo(320,364);
    c.lineTo(840,360);           // long flat ventral
    c.lineTo(1280,338);
    c.lineTo(1480,304);          // forward ventral rise
    c.lineTo(1648,280);          // gun muzzle, bottom
    c.closePath();
  }

  function buildLayers(){
    const rnd=mulberry(20260611);
    hull=document.createElement('canvas');hull.width=HW;hull.height=HH;
    const c=hull.getContext('2d');

    // --- stern nacelle bells (drawn first, behind the hull body) ---
    for(const e of ENGINES){
      // cylindrical pod
      const pg=c.createLinearGradient(0,e.y-e.r,0,e.y+e.r);
      pg.addColorStop(0,'#454f5c');pg.addColorStop(.5,'#2a3340');pg.addColorStop(1,'#10161e');
      c.fillStyle=pg;
      c.beginPath();c.moveTo(STERN_X-2,e.y-e.r);c.lineTo(STERN_X+58,e.y-e.r*.82);
      c.lineTo(STERN_X+58,e.y+e.r*.82);c.lineTo(STERN_X-2,e.y+e.r);c.closePath();c.fill();
      // bell mouth (dark ring + inner)
      c.fillStyle='#070b11';c.beginPath();c.ellipse(STERN_X-6,e.y,e.r*.5,e.r,0,0,TAU);c.fill();
      c.strokeStyle='rgba(120,160,190,.5)';c.lineWidth=2;
      c.beginPath();c.ellipse(STERN_X-6,e.y,e.r*.5,e.r,0,0,TAU);c.stroke();
      c.strokeStyle='rgba(150,170,190,.28)';c.lineWidth=1;
      c.beginPath();c.ellipse(STERN_X+24,e.y,e.r*.32,e.r*.74,0,0,TAU);c.stroke();
    }

    // base hull
    const g=c.createLinearGradient(0,180,0,366);
    g.addColorStop(0,'#5e6c7c');g.addColorStop(.30,'#3f4b59');
    g.addColorStop(.60,'#232d39');g.addColorStop(1,'#0b1118');
    c.fillStyle=g;hullPath(c);c.fill();
    c.save();hullPath(c);c.clip();

    // broad horizontal armour bands
    c.strokeStyle='rgba(8,12,18,.55)';c.lineWidth=1;
    [224,256,288,316,340].forEach(y=>{c.beginPath();c.moveTo(110,y);c.lineTo(1500,y-((y-240)*.12));c.stroke();});
    // vertical panel seams with jitter
    for(let x=190;x<1480;x+=20+rnd()*30){
      c.strokeStyle=`rgba(10,16,24,${.16+rnd()*.3})`;
      c.beginPath();c.moveTo(x,196);c.lineTo(x-6,366);c.stroke();
    }
    // greebles: surface machinery boxes (denser, industrial)
    for(let i=0;i<420;i++){
      const x=180+rnd()*1280, y=204+rnd()*150;
      const ww=3+rnd()*22, hh=2+rnd()*7, v=rnd();
      c.fillStyle=v<.5?`rgba(12,18,26,${.4+v})`:`rgba(135,152,170,${.12+v*.2})`;
      c.fillRect(x,y,ww,hh);
    }
    // bright machined detail strips
    for(let i=0;i<60;i++){
      const x=220+rnd()*1180, y=210+rnd()*140;
      c.fillStyle=`rgba(170,196,220,${.12+rnd()*.16})`;c.fillRect(x,y,6+rnd()*22,1);
    }
    // two lateral trenches (deck split)
    c.fillStyle='rgba(4,8,13,.85)';c.fillRect(200,272,1230,8);c.fillRect(220,304,1120,6);
    c.fillStyle='rgba(120,200,235,.10)';c.fillRect(200,274,1230,2);
    c.restore();

    // terraced superstructure + bridge tower (mid-aft)
    const deck=(x,y,w2,h2,tone)=>{
      const dg=c.createLinearGradient(0,y,0,y+h2);
      dg.addColorStop(0,`rgba(${tone+34},${tone+44},${tone+56},1)`);
      dg.addColorStop(1,`rgba(${tone},${tone+8},${tone+18},1)`);
      c.fillStyle=dg;
      c.beginPath();c.moveTo(x+10,y);c.lineTo(x+w2-14,y);c.lineTo(x+w2,y+h2);c.lineTo(x,y+h2);c.closePath();c.fill();
      c.strokeStyle='rgba(150,170,190,.22)';c.strokeRect(x+4,y+2,w2-10,1);
    };
    deck(330,168,520,30,38);
    deck(370,142,400,28,46);
    deck(410,116,250,28,54);
    deck(450,86,128,32,62);          // bridge tower
    c.fillStyle='#16202c';c.fillRect(460,74,108,14);   // bridge deck
    c.fillStyle='#0a141e';c.beginPath();c.arc(478,72,9,0,TAU);c.fill();c.beginPath();c.arc(550,72,9,0,TAU);c.fill();
    c.strokeStyle='rgba(140,220,255,.4)';c.beginPath();c.arc(478,72,9,0,TAU);c.stroke();c.beginPath();c.arc(550,72,9,0,TAU);c.stroke();
    // sensor mast
    c.strokeStyle='rgba(160,180,200,.6)';c.lineWidth=2;
    c.beginPath();c.moveTo(514,74);c.lineTo(514,32);c.stroke();
    c.fillStyle='rgba(255,90,98,.9)';c.beginPath();c.arc(514,30,2.6,0,TAU);c.fill();
    // dorsal turrets
    for(const tx of [720,820,920,1030,1140]){
      c.fillStyle='#28323e';c.fillRect(tx,196,26,8);
      c.fillStyle='#36424f';c.beginPath();c.arc(tx+13,196,7,Math.PI,0);c.fill();
      c.strokeStyle='rgba(20,26,34,.8)';c.beginPath();c.moveTo(tx+13,190);c.lineTo(tx+34,184);c.stroke();
    }

    // ---- forward MAIN GUN: heavy barrel + muzzle aperture ----
    const bg=c.createLinearGradient(0,250,0,282);
    bg.addColorStop(0,'#6a7886');bg.addColorStop(.5,'#3a4654');bg.addColorStop(1,'#141c26');
    c.fillStyle=bg;
    c.beginPath();c.moveTo(1300,246);c.lineTo(1632,256);c.lineTo(1632,280);c.lineTo(1300,290);c.closePath();c.fill();
    // barrel rib rings
    c.strokeStyle='rgba(16,22,30,.7)';c.lineWidth=2;
    for(const bx of [1360,1420,1480,1540,1596]){c.beginPath();c.moveTo(bx,247+((bx-1300)*.03));c.lineTo(bx,289-((bx-1300)*.03));c.stroke();}
    // muzzle housing + dark bore
    c.fillStyle='#1b2530';c.beginPath();c.ellipse(1632,268,9,15,0,0,TAU);c.fill();
    c.fillStyle='#05080d';c.beginPath();c.ellipse(1634,268,5,10,0,0,TAU);c.fill();
    c.strokeStyle='rgba(255,120,110,.5)';c.lineWidth=1.4;c.beginPath();c.ellipse(1632,268,9,15,0,0,TAU);c.stroke();

    // dorsal rim light (key light from above)
    c.strokeStyle='rgba(170,218,247,.5)';c.lineWidth=1.6;
    c.beginPath();c.moveTo(1632,256);c.lineTo(1300,214);c.lineTo(720,200);c.lineTo(300,202);c.lineTo(176,214);c.stroke();

    // ---- window lights layer ----
    lights=document.createElement('canvas');lights.width=HW;lights.height=HH;
    const lc=lights.getContext('2d');
    for(let i=0;i<260;i++){
      const x=220+rnd()*1180;
      const band=rnd();
      const y=band<.55?244+rnd()*40:(band<.8?308+rnd()*22:208+rnd()*18);
      const warm=rnd()<.78;
      lc.fillStyle=warm?`rgba(255,224,168,${.4+rnd()*.6})`:`rgba(140,230,255,${.4+rnd()*.6})`;
      lc.fillRect(x,y,rnd()<.2?2.5:1.4,1.4);
    }
    for(let i=0;i<10;i++)lc.fillRect(466+i*9,92,4,2);   // bridge windows
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
    const flick=.82+.18*Math.sin(now/47)+.06*Math.sin(now/13);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const e of ENGINES){
      const gx=x+(STERN_X-6)*s, gy=y+e.y*s, rr=e.r*s;
      // white-hot bell core
      const core=ctx.createRadialGradient(gx,gy,0,gx,gy,rr*1.1);
      core.addColorStop(0,'rgba(255,255,255,.92)');
      core.addColorStop(.4,'rgba(170,244,255,.55)');
      core.addColorStop(1,'rgba(120,210,255,0)');
      ctx.fillStyle=core;ctx.beginPath();ctx.ellipse(gx,gy,rr*.62,rr*1.05,0,0,TAU);ctx.fill();
      // long exhaust plume trailing LEFT (behind the hull)
      const plume=ctx.createLinearGradient(gx,gy,gx-rr*7*flick,gy);
      plume.addColorStop(0,'rgba(195,248,255,.52)');
      plume.addColorStop(.35,'rgba(90,190,255,.2)');
      plume.addColorStop(1,'rgba(60,170,255,0)');
      ctx.fillStyle=plume;
      ctx.beginPath();ctx.moveTo(gx,gy-rr*.85);
      ctx.quadraticCurveTo(gx-rr*4*flick,gy-rr*.22,gx-rr*7*flick,gy);
      ctx.quadraticCurveTo(gx-rr*4*flick,gy+rr*.22,gx,gy+rr*.85);ctx.closePath();ctx.fill();
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

    // hero hull pass — sails LEFT -> RIGHT so the camera reveals the stern
    // thrusters first, then pans across the hull to the forward main gun.
    const s=(h/HH)*.92;
    const shipW=HW*s;
    const x=lerp(-shipW-40,w+shipW*.06,easeInOut(t));
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
