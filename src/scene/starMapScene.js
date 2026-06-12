/**
 * Alphard galactic star map — enhanced 2D scene.
 * Brings back the rotating WebGL-era map look, plus: drifting nebulae,
 * the Earth → Alphard voyage route with a moving pulse, a faint radar
 * sweep, glowing star labels, twinkle and occasional shooting stars.
 * Pure draw module (no DOM lookups) so it can be rendered offscreen.
 */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const mulberry=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let z=Math.imul(seed^seed>>>15,1|seed);z=z+Math.imul(z^z>>>7,61|z)^z;return ((z^z>>>14)>>>0)/4294967296;};

export function createStarMapScene(){
  const rnd=mulberry(20260612);
  // star field in unit space (-1..1), rotated at draw time
  const stars=[];
  for(let i=0;i<230;i++){
    const a=rnd()*TAU;
    const r=Math.pow(rnd(),.62)*.95;
    stars.push({
      x:Math.cos(a)*r, y:Math.sin(a)*r,
      s:.5+rnd()*1.9,
      hot:rnd()<.085,             // warm-tinted giants
      tw:rnd()*TAU,               // twinkle phase
      cluster:rnd()<.16,
    });
  }
  // named beacons (unit space, rotate with the field)
  const beacons=[
    {name:'ALPHARD', x:0,    y:0,    gold:true},
    {name:'REGULUS', x:.46,  y:-.40},
    {name:'PROCYON', x:-.52, y:-.34},
    {name:'SPICA',   x:.55,  y:.42},
    {name:'SIRIUS',  x:-.58, y:.44},
  ];
  const EARTH={x:-.86,y:.62};
  let shoot=null; // active shooting star

  function draw(ctx,w,h,now,lang='en'){
    const cx=w/2, cy=h/2, R=Math.min(w,h)*.46;
    const rot=now*.000045;       // slow field rotation (matches old WebGL feel)
    const cosR=Math.cos(rot), sinR=Math.sin(rot);
    const P=(x,y)=>{ // unit -> screen with rotation
      const rx=x*cosR-y*sinR, ry=x*sinR+y*cosR;
      return [cx+rx*R, cy+ry*R*.92];
    };

    ctx.clearRect(0,0,w,h);
    // deep backdrop + drifting nebulae
    ctx.fillStyle='rgba(1,3,8,.88)';ctx.fillRect(0,0,w,h);
    const nebulae=[
      [cx+Math.sin(now/17000)*w*.12, cy-h*.22+Math.cos(now/21000)*h*.06, R*.9,'rgba(64,120,200,.10)'],
      [cx-w*.24+Math.cos(now/23000)*w*.05, cy+h*.18, R*.7,'rgba(150,80,200,.07)'],
      [cx+w*.26, cy+h*.10+Math.sin(now/19000)*h*.05, R*.6,'rgba(232,150,90,.06)'],
    ];
    for(const [nx,ny,nr,c] of nebulae){
      const g=ctx.createRadialGradient(nx,ny,0,nx,ny,nr);
      g.addColorStop(0,c);g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(nx,ny,nr,0,TAU);ctx.fill();
    }

    // faint range rings + crosshair
    ctx.strokeStyle='rgba(140,232,255,.10)';ctx.lineWidth=1;
    for(const rr of [.38,.72]){ctx.beginPath();ctx.arc(cx,cy,R*rr,0,TAU);ctx.stroke();}
    ctx.strokeStyle='rgba(140,232,255,.06)';
    ctx.beginPath();ctx.moveTo(cx-R,cy);ctx.lineTo(cx+R,cy);ctx.moveTo(cx,cy-R*.92);ctx.lineTo(cx,cy+R*.92);ctx.stroke();

    // radar sweep
    const sweepA=now/2600;
    const sw=ctx.createConicGradient?ctx.createConicGradient(sweepA,cx,cy):null;
    if(sw){
      sw.addColorStop(0,'rgba(140,232,255,.13)');
      sw.addColorStop(.10,'rgba(140,232,255,0)');
      sw.addColorStop(1,'rgba(140,232,255,0)');
      ctx.fillStyle=sw;ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.fill();
    }

    // stars
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const st of stars){
      const [x,y]=P(st.x,st.y);
      const tw=.55+.45*Math.sin(now/640+st.tw);
      const a=(st.cluster?.66:.46)*tw;
      ctx.fillStyle=st.hot?`rgba(255,215,142,${a})`:`rgba(155,231,255,${a})`;
      ctx.beginPath();ctx.arc(x,y,st.s*(st.cluster?1.15:1)*tw,0,TAU);ctx.fill();
    }
    ctx.restore();

    // voyage route Earth -> Alphard
    const [ex,ey]=P(EARTH.x,EARTH.y);
    const [ax,ay]=P(0,0);
    const prog=.74; // journey progress (2738 days narrative)
    ctx.save();
    ctx.strokeStyle='rgba(140,232,255,.34)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(ex,ey);
    ctx.lineTo(lerp(ex,ax,prog),lerp(ey,ay,prog));ctx.stroke();
    ctx.setLineDash([3,6]);ctx.strokeStyle='rgba(140,232,255,.18)';
    ctx.beginPath();ctx.moveTo(lerp(ex,ax,prog),lerp(ey,ay,prog));ctx.lineTo(ax,ay);ctx.stroke();
    ctx.setLineDash([]);
    // moving pulse along the traveled leg
    const pt=(now/3200)%1;
    const px=lerp(ex,ax,prog*pt), py=lerp(ey,ay,prog*pt);
    ctx.globalCompositeOperation='lighter';
    const pg=ctx.createRadialGradient(px,py,0,px,py,7);
    pg.addColorStop(0,'rgba(190,240,255,.9)');pg.addColorStop(1,'rgba(140,232,255,0)');
    ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,7,0,TAU);ctx.fill();
    // fleet marker at current position
    const fx=lerp(ex,ax,prog), fy=lerp(ey,ay,prog);
    ctx.strokeStyle='rgba(120,255,178,.9)';ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.moveTo(fx,fy-5);ctx.lineTo(fx+4,fy+4);ctx.lineTo(fx-4,fy+4);ctx.closePath();ctx.stroke();
    ctx.restore();
    // Earth marker
    ctx.fillStyle='rgba(120,200,255,.85)';
    ctx.beginPath();ctx.arc(ex,ey,2.2,0,TAU);ctx.fill();
    ctx.strokeStyle='rgba(120,200,255,.35)';ctx.beginPath();ctx.arc(ex,ey,5,0,TAU);ctx.stroke();

    // Alphard: golden pulse + diffraction spikes
    ctx.save();ctx.globalCompositeOperation='lighter';
    const pulse=1+.10*Math.sin(now/620);
    const ag=ctx.createRadialGradient(ax,ay,0,ax,ay,26*pulse);
    ag.addColorStop(0,'rgba(255,232,180,.95)');
    ag.addColorStop(.3,'rgba(255,196,105,.5)');
    ag.addColorStop(1,'rgba(255,170,80,0)');
    ctx.fillStyle=ag;ctx.beginPath();ctx.arc(ax,ay,26*pulse,0,TAU);ctx.fill();
    ctx.strokeStyle='rgba(255,220,150,.55)';ctx.lineWidth=1;
    const sp=13*pulse;
    ctx.beginPath();
    ctx.moveTo(ax-sp,ay);ctx.lineTo(ax+sp,ay);
    ctx.moveTo(ax,ay-sp);ctx.lineTo(ax,ay+sp);
    ctx.stroke();
    ctx.fillStyle='rgba(255,250,235,.98)';
    ctx.beginPath();ctx.arc(ax,ay,3.4,0,TAU);ctx.fill();
    ctx.restore();

    // beacon labels (glowing, rotate with field)
    ctx.save();
    for(const b of beacons){
      const [bx,by]=P(b.x,b.y);
      if(!b.gold){
        ctx.fillStyle='rgba(155,231,255,.78)';
        ctx.beginPath();ctx.arc(bx,by,1.8,0,TAU);ctx.fill();
      }
      ctx.font=`${b.gold?Math.max(7,w*.026):Math.max(5.5,w*.018)}px 'JetBrains Mono',monospace`;
      ctx.textAlign='center';ctx.textBaseline='top';
      ctx.shadowColor=b.gold?'rgba(255,196,105,.8)':'rgba(140,232,255,.6)';
      ctx.shadowBlur=8;
      ctx.fillStyle=b.gold?'rgba(255,215,146,.95)':'rgba(155,231,255,.62)';
      ctx.fillText(b.name,bx,by+(b.gold?14:5));
      ctx.shadowBlur=0;
    }
    ctx.restore();

    // occasional shooting star
    if(!shoot && Math.random()<.004){
      const a=rnd()*TAU;
      shoot={x:cx+Math.cos(a)*R*.9,y:cy+Math.sin(a)*R*.7,vx:-2.4+rnd()*4.8,vy:1.2+rnd()*1.6,life:1};
    }
    if(shoot){
      shoot.x+=shoot.vx*3;shoot.y+=shoot.vy*3;shoot.life-=.03;
      if(shoot.life<=0)shoot=null;
      else{
        ctx.save();ctx.globalCompositeOperation='lighter';
        const grad=ctx.createLinearGradient(shoot.x,shoot.y,shoot.x-shoot.vx*14,shoot.y-shoot.vy*14);
        grad.addColorStop(0,`rgba(220,244,255,${.85*shoot.life})`);
        grad.addColorStop(1,'rgba(220,244,255,0)');
        ctx.strokeStyle=grad;ctx.lineWidth=1.3;
        ctx.beginPath();ctx.moveTo(shoot.x,shoot.y);
        ctx.lineTo(shoot.x-shoot.vx*14,shoot.y-shoot.vy*14);ctx.stroke();
        ctx.restore();
      }
    }

    // header strip
    ctx.fillStyle='rgba(214,246,255,.80)';
    ctx.font=`${Math.max(6,Math.min(9,w*.026))}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText(lang==='zh'?'阿尔法德星域 · 远征航线':'ALPHARD SECTOR · VOYAGE PLOT',8,6);
    ctx.textAlign='right';
    ctx.fillStyle='rgba(140,232,255,.55)';
    ctx.fillText(`T-${2738-Math.floor((now/86400000))%30} D`,w-8,6);
  }

  return {draw};
}
