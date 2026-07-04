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
  cometTarget as hmdComet,
  targetBracket as hmdBracket,
  statusChip as hmdStatusChip,
} from './hmdMinimal.js';

/* ── SC-reference HUD primitives (V17b, per user screenshot 2) ─────────────
   Replaces hmdMinimal's headingTape/boresight for THIS view only: a dense
   degree tape with numbered majors + centre caret & readout, and a dashed
   cross reticle with a bracket-dot secondary marker. Pure. */
export function drawSCHeadingTape(ctx,w,h,heading){
  const y0=h*.10, pxPerDeg=w*.008, halfSpan=30;
  const fs=Math.max(7,Math.min(10,w*.018));
  ctx.save();
  ctx.strokeStyle='rgba(148,228,255,.62)';ctx.lineWidth=1;
  ctx.font=`${fs}px 'JetBrains Mono',monospace`;
  ctx.textAlign='center';ctx.textBaseline='bottom';
  const from=Math.ceil((heading-halfSpan)/2)*2;
  for(let deg=from;deg<=heading+halfSpan;deg+=2){
    const x=w*.5+(deg-heading)*pxPerDeg;
    if(x<w*.26||x>w*.67) continue;   // right cut clears the OBJECTIVE panel
    const norm=((deg%360)+360)%360;
    const major=norm%20===0, mid=norm%10===0;
    const len=major?8:mid?5.5:3;
    ctx.globalAlpha=major?1:mid?.75:.45;
    ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y0+len);ctx.stroke();
    if(major){
      ctx.fillStyle='rgba(180,232,255,.85)';
      ctx.fillText(String(norm),x,y0-2);
    }
  }
  ctx.globalAlpha=1;
  // centre caret pointing up + current heading below it (ref: ▲ over "269")
  const cy=y0+13;
  ctx.fillStyle='rgba(226,246,255,.92)';
  ctx.beginPath();ctx.moveTo(w*.5,cy-4);ctx.lineTo(w*.5-4.5,cy+2);ctx.lineTo(w*.5+4.5,cy+2);ctx.closePath();ctx.fill();
  ctx.textBaseline='top';
  ctx.font=`${fs*1.15}px 'JetBrains Mono',monospace`;
  ctx.fillText(String(((heading%360)+360)%360),w*.5,cy+4);
  ctx.restore();
}
export function drawSCReticle(ctx,cx,cy){
  ctx.save();
  ctx.strokeStyle='rgba(226,246,255,.88)';ctx.lineWidth=1.2;
  // four converging dashes with a gap at centre
  const inR=5,outR=12;
  for(const[dx,dy] of[[1,0],[-1,0],[0,1],[0,-1]]){
    ctx.beginPath();
    ctx.moveTo(cx+dx*inR,cy+dy*inR);ctx.lineTo(cx+dx*outR,cy+dy*outR);
    ctx.stroke();
  }
  ctx.fillStyle='rgba(226,246,255,.95)';
  ctx.beginPath();ctx.arc(cx,cy,1.3,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

/* First-person cockpit frame for the pilot feed — SC-cockpit-style console
   dashboard (button columns, one centred power-management MFD, centre radar
   dome) in the language of the Star Citizen reference shot. The old A-frame canopy
   struts (the triangular "porthole") were removed on user request (V17,
   2026-07-05): the centre glass now stays completely clear for the HMD.

   `boot` (0..1) drives the one-shot power-on sequence: dash rim → button
   columns → MFD screens → radar dome → dash readouts → "TARGET LINK" sync
   lines → ESTABLISHED flash. Pass 1 (default) for a fully-lit console.
   Fully pure: no combat-state reads. */
export function drawCockpitFrame(ctx,w,h,now,landing=false,boot=1){
  const ac=landing?[93,255,157]:[120,210,255];
  const [cr,cg,cb]=ac;
  const rgba=(a)=>`rgba(${cr},${cg},${cb},${a})`;
  const AMBER='rgba(255,214,102,';
  const mono=(px)=>`${px}px 'JetBrains Mono',monospace`;
  // staged reveal: element group k ∈ [0,1) turns on across its own window,
  // with a bright strike right as it pops.
  const st=(k0,k1)=>clamp((boot-k0)/Math.max(.0001,k1-k0),0,1);
  const pop=(p)=>p<=0?0:p>=1?1:(p<.25?p*2.8:(.7+.3*p));      // overshoot-ish
  const flick=(p,seed)=>p>0&&p<1?(Math.sin(now/26+seed*9)>-.2?1:.35):1;
  ctx.save();
  // glass tint vignette at the rim (kept — subtle, not a structural frame)
  const vig=ctx.createRadialGradient(w*.5,h*.42,Math.min(w,h)*.28,w*.5,h*.5,Math.max(w,h)*.72);
  vig.addColorStop(0,'rgba(0,0,0,0)');
  vig.addColorStop(1,rgba(.05));
  ctx.fillStyle=vig;ctx.fillRect(0,0,w,h);

  // --- dashboard silhouette (V17b: flat top edge, no rim stroke — the curved
  //     bezier rim read as a stray "wavy line" and was removed per user) ---
  const dy=h*.70;
  const dg=ctx.createLinearGradient(0,dy,0,h);
  dg.addColorStop(0,'rgba(8,12,18,0)');
  dg.addColorStop(.18,'rgba(8,12,18,.92)');
  dg.addColorStop(1,'rgba(2,4,8,1)');
  ctx.fillStyle=dg;
  ctx.fillRect(0,dy,w,h-dy);

  const fsBtn=Math.max(5.5,Math.min(8,w*.014));
  const fsTiny=Math.max(5,Math.min(7,w*.012));

  // --- side button columns (left: PWR/WPN/THR/SHLD/COOL · right: RADR/PROX/HIT/MISL) ---
  const button=(bx,by,bw,bh,label,active,p,seed)=>{
    if(p<=0) return;
    const a=pop(p)*flick(p,seed);
    ctx.globalAlpha=a;
    ctx.fillStyle=active?`${AMBER}.16)`:'rgba(6,12,18,.9)';
    ctx.strokeStyle=active?`${AMBER}.9)`:rgba(.42);
    ctx.lineWidth=active?1.3:1;
    ctx.beginPath();ctx.rect(bx,by,bw,bh);ctx.fill();ctx.stroke();
    ctx.fillStyle=active?`${AMBER}.95)`:rgba(.78);
    ctx.font=mono(fsBtn);ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label,bx+bw/2,by+bh/2+.5);
    ctx.globalAlpha=1;
  };
  const bw=Math.max(26,w*.058), bh=Math.max(11,h*.042), bgap=bh*.42;
  const colY=h*.755;
  ['PWR','WPN','THR','SHLD','COOL'].forEach((lb,i)=>
    button(w*.015,colY+i*(bh+bgap),bw,bh,lb,lb==='WPN',st(.10+i*.045,.22+i*.045),i));
  ['RADR','PROX','HIT','MISL'].forEach((lb,i)=>
    button(w*.985-bw,colY+i*(bh+bgap),bw,bh,lb,false,st(.20+i*.045,.32+i*.045),i+5));

  // --- twin MFD screens (power management, mirrored) ---
  const mfd=(px,py,pw,ph,seed,p)=>{
    if(p<=0) return;
    const a=pop(p)*flick(p,seed);
    ctx.save();ctx.globalAlpha=a;
    ctx.fillStyle='rgba(5,10,16,.94)';
    ctx.strokeStyle=rgba(.5);ctx.lineWidth=1;
    ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.fill();ctx.stroke();
    const fs=fsTiny;
    ctx.font=mono(fs);ctx.textBaseline='top';
    // header: OUTPUT 5/16
    ctx.fillStyle=rgba(.55);ctx.textAlign='left';
    ctx.fillText('OUTPUT',px+4,py+3);
    ctx.fillStyle=rgba(.92);ctx.font=mono(fs*1.5);
    ctx.fillText('5/16',px+4,py+3+fs*1.2);
    // three columns of segmented power cells (some lit, like the reference)
    const cols=3, segs=4, cw=pw*.16, cgap=pw*.06, ch=(ph*.52)/segs-2;
    const gx0=px+pw*.42;
    for(let c=0;c<cols;c++){
      const litFrom=[3,2,1][c];   // column fill pattern echoing the screenshot
      for(let s=0;s<segs;s++){
        const x=gx0+c*(cw+cgap), y=py+4+s*(ch+2);
        const lit=s>=litFrom;
        ctx.fillStyle=lit?'rgba(120,170,255,.78)':'rgba(120,170,255,.10)';
        ctx.strokeStyle=rgba(.22);
        ctx.fillRect(x,y,cw,ch);ctx.strokeRect(x,y,cw,ch);
      }
    }
    // OFFLINE / BATTERY row
    ctx.font=mono(fs);ctx.fillStyle=rgba(.4);ctx.textAlign='left';
    ctx.fillText('0/0 OFFLINE',px+4,py+ph*.58);
    ctx.fillText('▤ BATTERY',px+4,py+ph*.58+fs*1.3);
    // boot scanline sweeping down the screen while it warms up
    if(p<1){
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=rgba(.30);
      ctx.fillRect(px,py+ph*p-1,pw,2);
    }
    ctx.restore();
  };
  const mw=w*.235, mh=h*.155, my=h*.775;
  mfd(w*.5-mw/2,my,mw,mh,2,st(.30,.52));

  // --- centre radar dome ---
  const domeP=st(.50,.72);
  if(domeP>0){
    const cx=w*.5, cyd=h*.905, R=Math.min(w*.075,h*.10);
    const a=pop(domeP)*flick(domeP,3);
    ctx.save();ctx.globalAlpha=a;
    ctx.fillStyle='rgba(4,9,15,.94)';
    ctx.beginPath();ctx.arc(cx,cyd,R+4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=rgba(.5);ctx.lineWidth=1;
    for(const rr of[R,R*.62,R*.28]){ctx.beginPath();ctx.arc(cx,cyd,rr,0,Math.PI*2);ctx.stroke();}
    // rotating sweep (spins up with boot)
    const sweep=now/900*(.25+.75*domeP);
    const grd=ctx.createConicGradient?ctx.createConicGradient(sweep,cx,cyd):null;
    if(grd){grd.addColorStop(0,rgba(.34));grd.addColorStop(.12,rgba(0));grd.addColorStop(1,rgba(0));
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(cx,cyd,R,0,Math.PI*2);ctx.fill();}
    else{ctx.strokeStyle=rgba(.5);ctx.beginPath();ctx.moveTo(cx,cyd);
      ctx.lineTo(cx+Math.cos(sweep)*R,cyd+Math.sin(sweep)*R);ctx.stroke();}
    // two blips
    ctx.fillStyle=`${AMBER}${(.5+.4*Math.sin(now/300)).toFixed(2)})`;
    ctx.fillRect(cx+R*.38,cyd-R*.30,2,2);
    ctx.fillRect(cx-R*.22,cyd+R*.18,2,2);
    // heading · range readout under the dome (matches the HMD tape / the
    // site's "BEARING 128°" lore, not two conflicting headings)
    const hdg=Math.round(128+Math.sin(now/3600)*4);
    ctx.font=mono(fsTiny);ctx.fillStyle=rgba(.72);ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText(`${String(hdg).padStart(3,'0')}°  ·  2.8 KM`,cx,cyd+R+6);
    ctx.restore();
  }

  // --- dash-top readout strips (fuel/thermal pairs) + QTM chip ---
  const roP=st(.60,.78);
  if(roP>0&&w>=300){
    ctx.save();ctx.globalAlpha=pop(roP);
    ctx.font=mono(fsTiny);ctx.textBaseline='top';
    ctx.fillStyle=rgba(.55);
    ctx.textAlign='left';
    ctx.fillText('≋ 2.8K 294.1   ⚡ 8.9K 0.0   ◇ 5.9K 0.0',w*.115,dy+h*.012);
    ctx.textAlign='right';
    ctx.fillText('≋ 2.8K 294.1   ⚡ 8.9K 0.0   QTM',w*.885,dy+h*.012);
    ctx.restore();
  }

  // --- boot terminal + TARGET LINK flash (only while booting) ---
  if(boot<1){
    const lines=[
      ['PWR BUS',.10],['AVIONICS',.30],['WPN SAFETIES',.50],['SENSOR ARRAY',.66],['TARGET LINK',.82],
    ];
    ctx.save();
    ctx.font=mono(fsTiny);ctx.textAlign='left';ctx.textBaseline='top';
    let row=0;
    for(const [name,at] of lines){
      const lp=st(at,at+.14);
      if(lp<=0) continue;
      const y=h*.53+row*fsTiny*1.55;
      ctx.globalAlpha=lp;
      ctx.fillStyle=rgba(.62);
      ctx.fillText(name,w*.40,y);
      ctx.fillStyle=lp>=1?'rgba(120,255,178,.85)':`${AMBER}.85)`;
      ctx.fillText(lp>=1?'▸ OK':'▸ SYNC…',w*.40+fsTiny*9,y);
      row++;
    }
    // ESTABLISHED flash: rises fast at .90, gone by 1
    const fT=st(.90,1);
    if(fT>0){
      const bell=Math.sin(fT*Math.PI);
      ctx.globalAlpha=bell;
      ctx.globalCompositeOperation='lighter';
      ctx.font=`${Math.max(9,w*.028)}px 'Orbitron',sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor=rgba(.9);ctx.shadowBlur=18*bell;
      ctx.fillStyle='rgba(226,246,255,.96)';
      ctx.fillText('TARGET LINK ESTABLISHED',w*.5,h*.44);
      ctx.shadowBlur=0;
    }
    ctx.restore();
  }

  // central console glow
  ctx.save();ctx.globalCompositeOperation='lighter';
  const cc=ctx.createRadialGradient(w*.5,h*.96,2,w*.5,h*.96,w*.18);
  cc.addColorStop(0,rgba(.14*st(0,.2)));
  cc.addColorStop(1,rgba(0));
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
 * @param {(w:number,h:number,mode?:string) => object} deps.pilotTrackedPoint
 * @param {() => number} [deps.getKillCount] - real kill count (mission panel)
 * @param {() => number} [deps.getGiantKillCount] - real giant-class kill count
 */
export function createCombatHmdV3({ getHalley, getWarpIntensity, getShipRecoil, pilotTrackedPoint, getKillCount, getGiantKillCount }){

  /** Flight-path marker, SC style (V17b): a small bracket-dot secondary marker
   *  ( ⌐ · ¬ ) drifting slightly off boresight — no ghost line, no circle. */
  function drawVelocityVector(ctx,w,h,now){
    const bx=w*.5, by=h*.46;
    const vvX=bx+Math.sin(now/2800)*w*.022+Math.sin(now/5100)*w*.008;
    const vvY=by+Math.cos(now/3200)*h*.018+Math.cos(now/4700)*h*.008+h*.05;
    ctx.save();
    ctx.strokeStyle='rgba(148,228,255,.72)';ctx.lineWidth=1.1;
    const g=7, arm=3.5;   // bracket half-gap + arm length
    ctx.beginPath();
    ctx.moveTo(vvX-g,vvY-arm);ctx.lineTo(vvX-g,vvY+arm);   // left bracket
    ctx.moveTo(vvX+g,vvY-arm);ctx.lineTo(vvX+g,vvY+arm);   // right bracket
    ctx.stroke();
    ctx.fillStyle='rgba(148,228,255,.85)';
    ctx.beginPath();ctx.arc(vvX,vvY,1.1,0,Math.PI*2);ctx.fill();
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
   *  PORT/STBD), stacked directly below the health/armor bars (V17c: was
   *  beside the bracket's own name/range labels, which collided at small
   *  sizes — see ROADMAP note). The game only tracks one scalar target HP,
   *  not real per-quadrant damage, so — same honesty level as
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
    // below the health/armor bars (which end ~cy+1.38·bracketS+15), not
    // beside the bracket's labels (which can extend to cx+1.5·bracketS+6+text)
    const gx=cx-bracketS*1.1, gy=cy+bracketS*1.38+30;
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

  /** SC-cockpit side chip stacks (V17, from the Star Citizen reference shot):
   *  left — fire-mode rows (SCM/GUN) + CPLD/ESP/LOCK avionics stack + speed/G;
   *  right — countermeasure counts (DECOY/NOISE) + VTOL/GEAR/GSAF chips.
   *  LOCK lights green when the HMD actually has a lock (real state); the rest
   *  is cockpit dressing in line with this view's cosmetic speed/heading. */
  function drawSCChipStacks(ctx,w,h,now,lockVisible,lockActive,speed){
    if(w<340||h<250) return;   // too small — skip rather than turn to mush
    const fs=Math.max(6,Math.min(8,w*.014));
    const cyan='rgba(148,228,255,';
    const row=(x,y,label,on,onColor)=>{
      ctx.fillStyle=on?onColor:`${cyan}.34)`;
      ctx.fillText(label,x,y);
    };
    ctx.save();
    ctx.font=`${fs}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.textBaseline='top';
    // ── left stack (below the power pips, ends above the console dash) ──
    const lx=w*.035, ly=h*.40, lh=fs*1.45;
    row(lx,ly,      'SCM',false);
    row(lx,ly+lh,   'GUN',true,`${cyan}.88)`);
    row(lx,ly+lh*2.3,'CPLD',true,`${cyan}.70)`);
    row(lx,ly+lh*3.3,'ESP', true,`${cyan}.70)`);
    row(lx,ly+lh*4.3,'LOCK',lockVisible,lockActive?'rgba(120,255,178,.92)':'rgba(255,205,128,.85)');
    ctx.fillStyle=`${cyan}.52)`;
    ctx.fillText(`${speed} M/S`,lx,ly+lh*5.6);
    ctx.fillText('63  63',lx,ly+lh*6.6);
    // ── right stack (below the mission panel) ──
    const rx=w*.965, ry=h*.30;
    ctx.textAlign='right';
    ctx.fillStyle=`${cyan}.66)`;
    ctx.fillText('DECOY 24',rx,ry);
    ctx.fillText('NOISE  2',rx,ry+lh);
    row(rx,ry+lh*2.3,'VTOL',false);
    row(rx,ry+lh*3.3,'GEAR',false);
    row(rx,ry+lh*4.3,'GSAF',true,'rgba(120,255,178,.72)');
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

    // ── Frame + nav (V17b: SC degree tape with numbered majors + caret) ────
    hmdCornerFrame(ctx,w,h);
    drawSCHeadingTape(ctx,w,h,heading);

    // ── SC-cockpit side chip stacks (SCM/GUN · CPLD/ESP/LOCK · DECOY/GEAR) ──
    drawSCChipStacks(ctx,w,h,now,lock.visible,!!lock.locked,speed);

    // ── Flight-path marker (velocity vector) ────────────────────────────────
    drawVelocityVector(ctx,w,h,now);

    // ── Boresight (V17b: SC dashed-cross reticle) ────────────────────────────
    drawSCReticle(ctx,w*.5,h*.46);

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

    // ── Telemetry — text only above the console dash (V17b: the full-width
    //    underline read as a stray "line across the middle"; removed) ────────
    ctx.save();
    ctx.font=`${Math.max(7,Math.min(10,w*.020))}px 'JetBrains Mono',monospace`;
    ctx.textBaseline='alphabetic';
    ctx.fillStyle=HMD.cyan;ctx.textAlign='left';
    ctx.fillText(`VEL ${speed} · G ${(1.2+warpIntensity*.9).toFixed(1)}`,w*.06,h*.66);
    ctx.fillStyle=HMD.cyanSoft;ctx.textAlign='right';
    ctx.fillText(lock.visible?`TGT 1P/HALLEY · ${lock.locked?'LOCK':'TRACK'}`:'SCANNING',w*.94,h*.66);
    ctx.restore();
    ctx.restore();
  }

  return { drawCleanCombatHmd };
}
