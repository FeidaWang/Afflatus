/**
 * Combat HMD v3 — the default space-combat heads-up display for the
 * combat/standby pilot feed (see ROADMAP §3.1 / §4b for the decision that
 * made this the default over the alternate combatHudSC.js panel style).
 *
 * Extracted from main.js as the first step of the main.js split (ROADMAP §2
 * Phase 4 / §0 P1-4): these were pure canvas-drawing functions tangled into
 * the 3700+-line monolith purely by physical proximity, not by real coupling.
 * `drawCockpitFrame` and `drawSCZoomScope` were already fully pure (no main.js
 * module-scope reads) and move verbatim. `drawCleanCombatHmd` and its five
 * helpers (drawVelocityVector/drawPowerPips/drawTargetHealthBars/
 * drawLeadIndicator/drawThreatEdgeArrow) read main.js's mutable combat state
 * (halley, warpIntensity, shipRecoil) and combatRuntime's weaponRemaining, so
 * they're wrapped in a factory that takes getters/functions instead of
 * closing over module-scope variables directly — the same
 * factory-with-injected-dependencies pattern already used by
 * createCombatRuntime / createRadarDeck / createRadarDeck elsewhere in this
 * codebase, so main.js stays the single owner of the actual battle state.
 */
import { clamp, lerp, rand } from '../utils/math.js';
import {
  HMD,
  cornerFrame as hmdCornerFrame,
  headingTape as hmdHeadingTape,
  arcGauge as hmdArcGauge,
  boresight as hmdBoresight,
  cometTarget as hmdComet,
  targetBracket as hmdBracket,
  telemetryLine as hmdTelemetry,
  statusChip as hmdStatusChip,
} from './hmdMinimal.js';

/* First-person cockpit frame for the pilot feed — canopy struts + a console
   dashboard with two glowing MFD panels, in the language of the Star Citizen
   reference shots. Drawn on top of the scene so the centre glass stays clear
   for the HMD/target; the dashboard also masks any stray bottom-edge HUD line.
   Fully pure: no combat-state reads. */
export function drawCockpitFrame(ctx,w,h,now,landing=false){
  const ac=landing?[93,255,157]:[120,210,255];
  const [cr,cg,cb]=ac;
  ctx.save();
  // glass tint vignette at the canopy rim
  const vig=ctx.createRadialGradient(w*.5,h*.42,Math.min(w,h)*.28,w*.5,h*.5,Math.max(w,h)*.72);
  vig.addColorStop(0,'rgba(0,0,0,0)');
  vig.addColorStop(1,`rgba(${cr},${cg},${cb},.05)`);
  ctx.fillStyle=vig;ctx.fillRect(0,0,w,h);
  // --- canopy struts (A-frame) ---
  ctx.lineCap='round';
  const strut=(x0,y0,x1,y1,wd)=>{
    const grad=ctx.createLinearGradient(x0,y0,x1,y1);
    grad.addColorStop(0,'rgba(20,26,34,.97)');
    grad.addColorStop(.5,'rgba(44,54,66,.94)');
    grad.addColorStop(1,'rgba(12,18,26,.97)');
    ctx.strokeStyle=grad;ctx.lineWidth=wd;
    ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    ctx.strokeStyle=`rgba(${cr},${cg},${cb},.16)`;ctx.lineWidth=Math.max(1,wd*.16);
    ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
  };
  const sw=Math.max(11,w*.05);
  strut(-w*.03,h*.70, w*.41,-h*.05, sw);   // left bar
  strut(w*1.03,h*.70, w*.59,-h*.05, sw);   // right bar
  strut(w*.5,-h*.06, w*.5,h*.085, Math.max(7,w*.028)); // top centre pillar
  // upper canopy bow
  ctx.strokeStyle='rgba(34,42,54,.92)';ctx.lineWidth=Math.max(8,w*.04);
  ctx.beginPath();ctx.moveTo(w*.41,-h*.05);ctx.quadraticCurveTo(w*.5,h*.02,w*.59,-h*.05);ctx.stroke();
  // --- dashboard / console ---
  const dy=h*.74;
  const dg=ctx.createLinearGradient(0,dy-h*.02,0,h);
  dg.addColorStop(0,'rgba(12,17,24,.45)');
  dg.addColorStop(.28,'rgba(8,12,18,.97)');
  dg.addColorStop(1,'rgba(2,4,8,1)');
  ctx.fillStyle=dg;
  ctx.beginPath();
  ctx.moveTo(0,h);ctx.lineTo(0,dy+h*.05);
  ctx.bezierCurveTo(w*.22,dy-h*.02, w*.36,dy+h*.06, w*.5,dy+h*.06);
  ctx.bezierCurveTo(w*.64,dy+h*.06, w*.78,dy-h*.02, w,dy+h*.05);
  ctx.lineTo(w,h);ctx.closePath();ctx.fill();
  // rim light along the dash edge
  ctx.strokeStyle=`rgba(${cr},${cg},${cb},.34)`;ctx.lineWidth=1.4;
  ctx.beginPath();
  ctx.moveTo(0,dy+h*.05);
  ctx.bezierCurveTo(w*.22,dy-h*.02, w*.36,dy+h*.06, w*.5,dy+h*.06);
  ctx.bezierCurveTo(w*.64,dy+h*.06, w*.78,dy-h*.02, w,dy+h*.05);
  ctx.stroke();
  // two MFD panels
  const mfd=(px,py,pw,ph,glow)=>{
    ctx.fillStyle='rgba(6,12,18,.92)';
    ctx.strokeStyle=`rgba(${cr},${cg},${cb},.5)`;ctx.lineWidth=1;
    ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.fill();ctx.stroke();
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<4;i++){
      const bw=pw*(.3+.6*((Math.sin(now/520+i*1.7+glow)+1)/2));
      ctx.fillStyle=`rgba(${cr},${cg},${cb},${.18+.12*((Math.sin(now/300+i)+1)/2)})`;
      ctx.fillRect(px+5,py+5+i*(ph-10)/4,bw,Math.max(2,(ph-12)/6));
    }
    ctx.restore();
  };
  const mw=w*.2, mh=h*.13, my=h*.82;
  mfd(w*.07,my,mw,mh,0);
  mfd(w*.73,my,mw,mh,2.4);
  // central console glow
  ctx.save();ctx.globalCompositeOperation='lighter';
  const cc=ctx.createRadialGradient(w*.5,h*.96,2,w*.5,h*.96,w*.18);
  cc.addColorStop(0,`rgba(${cr},${cg},${cb},.16)`);
  cc.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle=cc;ctx.beginPath();ctx.arc(w*.5,h*.96,w*.18,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.restore();
}

/* SC-style large targeting scope — reference: Star Citizen zoom camera (image 3).
   A large thin ring fills most of the frame; tick marks at 8 points; a tightening
   lock-progress arc in red; target name + range readout at ring perimeter.
   Called during main-gun charging phase (not while firing — the beam takes over).
   Fully pure: no combat-state reads. */
export function drawSCZoomScope(ctx,w,h,tx,ty,lockT,range,now){
  const R=Math.min(w,h)*(lerp(.44,.26,lockT));   // ring shrinks as lock tightens
  const cyan='rgba(148,228,255,.82)';
  const cyanDim='rgba(120,210,255,.30)';
  const red='rgba(255,60,88,.90)';
  const fs=Math.max(7,Math.min(9,w*.018));
  ctx.save();

  // Outer scope ring
  ctx.strokeStyle=cyan;ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(tx,ty,R,0,Math.PI*2);ctx.stroke();

  // Concentric inner ring (50 %)
  ctx.strokeStyle=cyanDim;ctx.lineWidth=.8;
  ctx.beginPath();ctx.arc(tx,ty,R*.5,0,Math.PI*2);ctx.stroke();

  // Radial tick marks: 4 major (cardinal) + 4 minor
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4, major=i%2===0, tl=major?14:7;
    ctx.strokeStyle=major?cyan:cyanDim;ctx.lineWidth=major?1:.7;
    ctx.beginPath();
    ctx.moveTo(tx+Math.cos(a)*(R-tl),ty+Math.sin(a)*(R-tl));
    ctx.lineTo(tx+Math.cos(a)*R,ty+Math.sin(a)*R);
    ctx.stroke();
    // cardinal labels (N/S/E/W) just outside the ring
    if(major){
      const labels=['N','E','S','W'];
      ctx.font=`${Math.max(6,fs*.88)}px 'JetBrains Mono',monospace`;
      ctx.fillStyle='rgba(148,228,255,.46)';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(labels[i/2],tx+Math.cos(a)*(R+13),ty+Math.sin(a)*(R+13));
    }
  }

  // Lock progress arc (top → clockwise, red)
  if(lockT>0){
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=`rgba(255,60,88,${.55+.45*lockT})`;ctx.lineWidth=lockT<.95?2:2.8;
    ctx.beginPath();ctx.arc(tx,ty,R+3,-Math.PI/2,-Math.PI/2+lockT*Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  // Outer ring glow (lighter blend)
  ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle=`rgba(90,200,255,${.12+.10*Math.sin(now/320)})`;ctx.lineWidth=8;
  ctx.beginPath();ctx.arc(tx,ty,R,0,Math.PI*2);ctx.stroke();
  ctx.restore();

  // Labels — top: weapon name; right: range + lock status
  ctx.font=`${fs}px 'JetBrains Mono',monospace`;ctx.textAlign='center';
  ctx.fillStyle='rgba(148,228,255,.72)';
  ctx.fillText('ENFORCER CANNON',tx,ty-R-12);
  ctx.textAlign='left';
  ctx.fillText(`RNG  ${range} M`,tx+R+8,ty-8);
  ctx.fillStyle=lockT>.95?'rgba(255,60,88,.92)':cyan;
  ctx.fillText(lockT>.95?'LOCK ACQUIRED':`LOCK  ${Math.round(lockT*100)}%`,tx+R+8,ty+7);
  // Bottom: zoom factor
  ctx.fillStyle='rgba(148,228,255,.50)';ctx.textAlign='center';
  ctx.fillText(`ZOOM  ${(8+lockT*70.54).toFixed(2)} ×`,tx,ty+R+14);

  // SC-style 4-corner target bracket (tighter = more lock)
  const bR=Math.min(w,h)*.035+lockT*(-Math.min(w,h)*.012);
  ctx.strokeStyle=lockT>.95?red:cyan;ctx.lineWidth=1.4;
  const armLen=bR*.55;
  for(let qx=-1;qx<=1;qx+=2) for(let qy=-1;qy<=1;qy+=2){
    const bx=tx+qx*bR, by=ty+qy*bR;
    ctx.beginPath();ctx.moveTo(bx-qx*armLen,by);ctx.lineTo(bx,by);ctx.lineTo(bx,by-qy*armLen);ctx.stroke();
  }

  // Fine crosshair at centre
  const ch=8+lockT*4;
  ctx.strokeStyle=`rgba(255,60,88,${.42+.58*lockT})`;ctx.lineWidth=.9;
  ctx.beginPath();ctx.moveTo(tx-ch,ty);ctx.lineTo(tx+ch,ty);ctx.moveTo(tx,ty-ch);ctx.lineTo(tx,ty+ch);ctx.stroke();

  ctx.restore();
}

/**
 * Factory for the parts that DO need live combat state. Call once at main.js
 * boot with getters/functions bound to its module-scope variables; main.js
 * remains the single source of truth for halley/warpIntensity/shipRecoil —
 * this module only ever reads snapshots via the injected getters, never
 * mutates them.
 *
 * @param {object} deps
 * @param {() => object|null} deps.getHalley - current comet state (or null)
 * @param {() => number} deps.getWarpIntensity
 * @param {() => number} deps.getShipRecoil
 * @param {(type:string) => number} deps.weaponRemaining - from combatRuntime
 * @param {(w:number,h:number,mode?:string) => object} deps.pilotTrackedPoint
 * @param {() => number} [deps.getKillCount] - real kill count (mission panel)
 * @param {() => number} [deps.getGiantKillCount] - real giant-class kill count
 */
export function createCombatHmdV3({ getHalley, getWarpIntensity, getShipRecoil, weaponRemaining, pilotTrackedPoint, getKillCount, getGiantKillCount }){

  /** Flight-path marker (velocity vector): a circle + three wing arms drifting
   *  slightly from the boresight, showing where the ship is actually heading. */
  function drawVelocityVector(ctx,w,h,now){
    const bx=w*.5, by=h*.46;
    const vvX=bx+Math.sin(now/2800)*w*.022+Math.sin(now/5100)*w*.008;
    const vvY=by+Math.cos(now/3200)*h*.018+Math.cos(now/4700)*h*.008;
    ctx.save();
    // ghost dash from boresight to flight-path marker
    ctx.strokeStyle='rgba(148,228,255,.18)';ctx.lineWidth=1;ctx.setLineDash([2,5]);
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(vvX,vvY);ctx.stroke();ctx.setLineDash([]);
    // FPM circle
    ctx.strokeStyle='rgba(148,228,255,.70)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(vvX,vvY,7,0,Math.PI*2);ctx.stroke();
    // three wing arms (top, lower-left, lower-right) — aircraft FPM symbol
    for(const a of[-Math.PI/2, Math.PI/2+Math.PI/3, Math.PI/2-Math.PI/3]){
      ctx.beginPath();
      ctx.moveTo(vvX+Math.cos(a)*7,vvY+Math.sin(a)*7);
      ctx.lineTo(vvX+Math.cos(a)*14,vvY+Math.sin(a)*14);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Three vertical power-distribution pips (ENG / WPN / SHD) in the upper-left
   *  margin — style: thin bars like SC's power management column. */
  function drawPowerPips(ctx,w,h,now){
    const halley=getHalley(), warpIntensity=getWarpIntensity();
    // ENG = throttle; WPN = weapon readiness; SHD = shield proxy (inverse risk)
    const eng=clamp(.68+warpIntensity*.28,0,1);
    const wpn=1-clamp(weaponRemaining('enforcer')/45000,0,1);
    const shd=clamp(1-(halley?.collisionRisk||0)*.9,.12,1);
    const vals=[eng,wpn,shd];
    const labels=['ENG','WPN','SHD'];
    const colors=['rgba(148,228,255,.72)','rgba(255,205,128,.72)','rgba(120,255,178,.72)'];
    // position: just inside the left corner frame, above the arc gauge
    const px=w*.075, py=h*.22, bw=5, bh=h*.14, gap=w*.028;
    ctx.save();
    ctx.font=`${Math.max(6,w*.014)}px 'JetBrains Mono',monospace`;
    ctx.textAlign='center';ctx.textBaseline='top';
    vals.forEach((v,i)=>{
      const x=px+i*gap;
      // track (empty)
      ctx.fillStyle='rgba(148,228,255,.10)';
      ctx.fillRect(x,py,bw,bh);
      // fill from bottom
      const filled=bh*clamp(v,0,1);
      ctx.fillStyle=colors[i];
      ctx.fillRect(x,py+bh-filled,bw,filled);
      // label below
      ctx.fillStyle='rgba(148,228,255,.38)';
      ctx.fillText(labels[i],x+bw/2,py+bh+3);
    });
    ctx.restore();
  }

  /** Target health bars (shield + armor) rendered below the SC bracket. */
  function drawTargetHealthBars(ctx,cx,cy,bracketS,now){
    const halley=getHalley();
    if(!halley||halley.destroyed) return;
    const maxHp=200, hp=clamp(halley.hp||100,0,maxHp);
    const shd=clamp(hp/maxHp,0,1);
    const arm=clamp(hp/maxHp*.82+.18,0,1);   // armor degrades slower than shield
    const bw=bracketS*2.2, bh=3.5;
    const bx=cx-bracketS*1.1, by=cy+bracketS*1.38;
    const fs=Math.max(6,Math.min(8,bw*.065));
    ctx.save();
    ctx.font=`${fs}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.textBaseline='middle';
    // Shield (blue)
    ctx.fillStyle='rgba(120,200,255,.18)';ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='rgba(120,200,255,.72)';ctx.fillRect(bx,by,bw*shd,bh);
    ctx.fillStyle='rgba(148,228,255,.44)';ctx.fillText(`SHD ${Math.round(shd*100)}%`,bx,by-5);
    // Armor (amber)
    ctx.fillStyle='rgba(255,205,128,.18)';ctx.fillRect(bx,by+bh+3,bw,bh);
    ctx.fillStyle='rgba(255,205,128,.64)';ctx.fillRect(bx,by+bh+3,bw*arm,bh);
    ctx.fillStyle='rgba(255,205,128,.40)';ctx.fillText(`ARM ${Math.round(arm*100)}%`,bx,by+bh+3+bh+5);
    ctx.restore();
  }

  /** Lead indicator: small amber diamond ahead of the target, accounting for
   *  projectile flight time. Visible only while the target is visible. */
  function drawLeadIndicator(ctx,cx,cy,w,h,now){
    const halley=getHalley();
    if(!halley||!halley.hover) return;
    const vx=halley.vx||0, vy=halley.vy||0;
    if(Math.hypot(vx,vy)<.04) return;  // near-stationary: skip
    const tof=0.22;   // normalised projectile flight time
    const lx=clamp(cx+vx*tof*w*.20, w*.04, w*.96);
    const ly=clamp(cy+vy*tof*h*.20, h*.04, h*.92);
    if(Math.hypot(lx-cx,ly-cy)<8) return;
    ctx.save();
    ctx.strokeStyle='rgba(255,205,128,.62)';ctx.lineWidth=1;
    const d=6;
    ctx.beginPath();
    ctx.moveTo(lx,ly-d);ctx.lineTo(lx+d,ly);ctx.lineTo(lx,ly+d);ctx.lineTo(lx-d,ly);ctx.closePath();ctx.stroke();
    ctx.strokeStyle='rgba(255,205,128,.22)';ctx.setLineDash([3,6]);
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(lx,ly);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,205,128,.42)';
    ctx.font=`${Math.max(6,w*.013)}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('LEAD',lx+9,ly-5);
    ctx.restore();
  }

  /** Shield quadrant grid — ported from the SC reference-image strength noted
   *  in ROADMAP §4b item 3 (previously only sketched for the demoted
   *  combatHudSC skin, never implemented there or here). Four cells (FORE/AFT/
   *  PORT/STBD) below the target bracket. The game only tracks one scalar
   *  target HP, not real per-quadrant damage, so — same honesty level as
   *  drawTargetHealthBars' derived armor% — each quadrant fans that single
   *  real value out with a small deterministic per-quadrant offset (seeded by
   *  quadrant index + slow time drift) rather than inventing 4 independent
   *  fake health pools. Skips silently once the target is destroyed. */
  function drawShieldQuadrantGrid(ctx,cx,cy,bracketS,now){
    const halley=getHalley();
    if(!halley||halley.destroyed) return;
    const maxHp=200, hp=clamp(halley.hp||100,0,maxHp), base=hp/maxHp;
    const labels=['FORE','AFT','PORT','STBD'];
    const cellW=bracketS*1.05, cellH=bracketS*.62, gap=4;
    const gx=cx+bracketS*1.35, gy=cy-cellH-gap*.5;
    const fs=Math.max(6,Math.min(8,bracketS*.13));
    ctx.save();
    ctx.font=`${fs}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.textBaseline='top';
    labels.forEach((label,i)=>{
      const col=i%2, row=Math.floor(i/2);
      const x=gx+col*(cellW+gap), y=gy+row*(cellH+gap);
      const drift=Math.sin(now/1600+i*1.7)*.05;
      const pct=clamp(base+drift-(i*.015),0,1);
      const hot=pct<.25;
      ctx.strokeStyle=hot?'rgba(255,92,98,.5)':'rgba(120,200,255,.34)';
      ctx.strokeRect(x,y,cellW,cellH);
      ctx.fillStyle=hot?'rgba(255,92,98,.16)':'rgba(120,200,255,.10)';
      ctx.fillRect(x,y,cellW,cellH); // subtle cell backdrop
      ctx.fillStyle='rgba(180,225,255,.5)';
      ctx.fillText(label,x+3,y+2);
      ctx.fillStyle=hot?'rgba(255,140,146,.92)':'rgba(200,235,255,.82)';
      ctx.textAlign='right';
      ctx.fillText(`${Math.round(pct*100)}`,x+cellW-3,y+cellH-fs-1);
      ctx.textAlign='left';
    });
    ctx.fillStyle='rgba(148,228,255,.38)';
    ctx.fillText('SHIELD QUAD',gx,gy-fs-2);
    ctx.restore();
  }

  /** Mission objective panel — top-right, the other SC reference-image
   *  strength from ROADMAP §4b item 3. Binds to real state only (killCount /
   *  giantKillCount from main.js, target-locked flag from pilotTrackedPoint's
   *  caller-supplied lock) — no invented mission/wave data, since the site
   *  has no actual wave system; it reads as a kill tally + current-target
   *  status rather than a fabricated "COMBAT GAUNTLET" scripted objective. */
  function drawMissionPanel(ctx,w,h,now,lockVisible,lockActive){
    const kills=getKillCount?getKillCount():0;
    const giants=getGiantKillCount?getGiantKillCount():0;
    const pw=Math.max(120,w*.19), ph=h*.09, px=w*.98-pw, py=h*.03;
    const fs=Math.max(7,Math.min(9,w*.016));
    ctx.save();
    ctx.strokeStyle='rgba(148,228,255,.32)';ctx.lineWidth=1;
    ctx.strokeRect(px,py,pw,ph);
    ctx.fillStyle='rgba(6,14,22,.38)';ctx.fillRect(px,py,pw,ph);
    ctx.font=`${fs}px 'JetBrains Mono',monospace`;ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillStyle='rgba(148,228,255,.60)';
    ctx.fillText('OBJECTIVE',px+6,py+4);
    ctx.fillStyle=lockVisible?(lockActive?'rgba(93,255,157,.85)':'rgba(255,205,128,.82)'):'rgba(180,225,255,.5)';
    ctx.fillText(lockVisible?(lockActive?'NEUTRALIZE · LOCKED':'NEUTRALIZE · TRACKING'):'SCANNING SECTOR',px+6,py+4+fs*1.3);
    ctx.fillStyle='rgba(148,228,255,.42)';
    ctx.fillText(`KILLS ${kills}${giants?` · GIANT ${giants}`:''}`,px+6,py+4+fs*2.6);
    ctx.restore();
  }

  /** Edge threat arrow: when the target is off-screen, draw a red chevron at the
   *  nearest panel edge pointing toward it. */
  function drawThreatEdgeArrow(ctx,w,h){
    const halley=getHalley();
    if(!halley||halley.destroyed) return;
    const tx=halley.curX??halley.x, ty=halley.curY??halley.y;
    if(tx>w*.06&&tx<w*.94&&ty>h*.06&&ty<h*.94) return;  // on-screen, skip
    const dx=tx-w*.5, dy=ty-h*.5;
    const angle=Math.atan2(dy,dx);
    const mx=Math.abs(dx/(w*.5-14)), my=Math.abs(dy/(h*.5-14));
    const sc=1/Math.max(mx,my,0.001);
    const ex=clamp(w*.5+dx*sc, 12, w-12), ey=clamp(h*.5+dy*sc, 12, h-12);
    ctx.save();ctx.translate(ex,ey);ctx.rotate(angle);
    ctx.strokeStyle='rgba(255,92,98,.76)';ctx.fillStyle='rgba(255,92,98,.52)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-5,-5);ctx.lineTo(-5,5);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.restore();
  }

  /* ===== Main combat HMD (v3 — full space-combat layout) ================== */
  function drawCleanCombatHmd(ctx,w,h,now,label,mode){
    const halley=getHalley(), warpIntensity=getWarpIntensity(), shipRecoil=getShipRecoil();
    const missileLike=mode==='missile'||mode==='nukeAuth'||mode==='nemp';
    const lock=pilotTrackedPoint(w,h,mode);
    const heading=Math.round(126+Math.sin(now/3600)*4);
    const speed=Math.round(760+warpIntensity*240+Math.sin(now/900)*16);
    const range=lock.visible?Math.max(88,Math.round(720-lock.approach*560+(halley?.collisionRisk||0)*80)):620;
    ctx.save();

    // Soft vignette — glass tint
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'rgba(8,26,42,.28)');g.addColorStop(.5,'rgba(0,5,12,.02)');g.addColorStop(1,'rgba(3,10,18,.40)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);

    // ── Frame + nav ────────────────────────────────────────────────────────
    hmdCornerFrame(ctx,w,h);
    hmdHeadingTape(ctx,w,h,heading);

    // ── Self-status arcs (centred at ±31% from mid so they fit inward) ─────
    hmdArcGauge(ctx,w,h,-1,clamp((.68+warpIntensity*.28),0,1),'THR',`${Math.round(68+warpIntensity*28)}%`);
    hmdArcGauge(ctx,w,h, 1,clamp(speed/1200,0,1),'VEL',`${speed} M/S`);

    // ── ENG / WPN / SHD power distribution pips (upper-left margin) ────────
    drawPowerPips(ctx,w,h,now);

    // ── Flight-path marker (velocity vector) ────────────────────────────────
    drawVelocityVector(ctx,w,h,now);

    // ── Boresight ────────────────────────────────────────────────────────────
    hmdBoresight(ctx,w,h);

    // ── Target: comet + bracket + health bars + lead indicator ─────────────
    const cx=lock.visible?lock.cx:w*.62;
    const cy=lock.visible?lock.cy:h*.40;
    if(lock.visible){
      const sizeScale={small:1,medium:1.2,large:1.4,giant:1.65}[halley?.sizeClass]||1.2;
      hmdComet(ctx,cx,cy,4.4*sizeScale,now,halley?.vx??-1,halley?.vy??.3);
      hmdBracket(ctx,cx,cy,Math.min(w,h)*.085*sizeScale,lock.lock||0,!!lock.locked,now,`${range}.0 M`,'1P/HALLEY');
      drawTargetHealthBars(ctx,cx,cy,Math.min(w,h)*.085*sizeScale,now);
      drawShieldQuadrantGrid(ctx,cx,cy,Math.min(w,h)*.085*sizeScale,now);
      drawLeadIndicator(ctx,cx,cy,w,h,now);
    } else {
      drawThreatEdgeArrow(ctx,w,h);
    }
    drawMissionPanel(ctx,w,h,now,lock.visible,!!lock.locked);

    // ── Mode-specific overlays ───────────────────────────────────────────────
    if(mode==='ciws'){
      hmdStatusChip(ctx,w,h,'CIWS · OPTICAL TRACK',HMD.amber,true,now);
    }else if(missileLike){
      ctx.save();ctx.globalCompositeOperation='lighter';
      const flame=ctx.createRadialGradient(w*.5,h*1.02,2,w*.5,h*1.02,w*.20);
      flame.addColorStop(0,'rgba(255,250,230,.62)');flame.addColorStop(.4,'rgba(232,179,128,.30)');flame.addColorStop(1,'rgba(232,179,128,0)');
      ctx.fillStyle=flame;ctx.beginPath();ctx.arc(w*.5,h*1.02,w*.20,0,Math.PI*2);ctx.fill();ctx.restore();
      if(lock.visible){
        ctx.save();ctx.strokeStyle='rgba(232,179,128,.4)';ctx.setLineDash([3,7]);
        ctx.beginPath();ctx.moveTo(w*.5,h*.96);ctx.lineTo(cx,cy);ctx.stroke();ctx.setLineDash([]);ctx.restore();
      }
      hmdStatusChip(ctx,w,h,mode==='nukeAuth'?'NEMP · TERMINAL GUIDANCE':'AIM-120 · DATA LINK',HMD.amber,true,now);
    }else if(mode==='mainGun'){
      const recoil=shipRecoil||0;
      ctx.save();ctx.translate(rand(-1.2,1.2)*recoil*.18,rand(-.8,.8)*recoil*.18);
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle='rgba(255,255,255,.76)';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(w*.50,h*1.05);ctx.lineTo(cx,cy);ctx.stroke();
      ctx.strokeStyle='rgba(255,20,70,.88)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(w*.50,h*1.05);ctx.lineTo(cx,cy);ctx.stroke();
      ctx.restore();
    }else{
      hmdStatusChip(ctx,w,h,label||'TARGET LINK',HMD.cyanSoft,false,now);
    }

    // ── Telemetry strip ──────────────────────────────────────────────────────
    hmdTelemetry(ctx,w,h,
      `VEL ${speed} · G ${(1.2+warpIntensity*.9).toFixed(1)}`,
      lock.visible?`TGT 1P/HALLEY · ${lock.locked?'LOCK':'TRACK'}`:'SCANNING');
    ctx.restore();
  }

  return { drawCleanCombatHmd };
}
