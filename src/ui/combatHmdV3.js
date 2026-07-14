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
  cometTarget as hmdComet,
  statusChip as hmdStatusChip,
} from './hmdMinimal.js';
// U8 (2026-07-11): hmdCornerFrame/hmdBracket (hmdMinimal's cornerFrame/
// targetBracket) are no longer used by this view — the "Combat HUD 减法
// 改造" pass replaces the corner-frame + 4-corner SC bracket with a plain
// square (see drawTargetFrame below) and drops the corner-tick frame
// entirely. Both are still imported and used as-is by main.js's other HUD
// path, so hmdMinimal.js itself is untouched — only this file's now-unused
// import aliases were removed.

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
   dashboard in the language of the Star Citizen reference shot. The old
   A-frame canopy struts (the triangular "porthole") were removed on user
   request (V17, 2026-07-05): the centre glass now stays completely clear
   for the HMD.

   U14b (2026-07-12): the OUTPUT/BATTERY power-management MFD, the centre
   radar dome (redundant with the real holographic radar dock merged into
   Combat View by U9/U13), the twin dash-top readout number strips, and
   the entire right-hand RADR/PROX/HIT/MISL button column were all static
   decoration on top of an already-busy console — deleted outright rather
   than kept "just in case" (see roadmap discipline: minimum code that
   solves the problem). Only the left button column survives, and it's no
   longer purely decorative: `dash` (U14c) drives WPN's colour from the
   currently active weapon and adds live energy readouts beside every
   button. U28 28f (2026-07-14) dropped COOL (PWR/WPN/THR/SHLD only) and
   replaced the old scrolling energy-pip strips with one real-state-bound
   vertical bar per button — see drawCockpitFrame below.

   `boot` (0..1) drives the one-shot power-on sequence: dash rim → button
   column → "TARGET LINK" sync lines → ESTABLISHED flash. Pass 1 (default)
   for a fully-lit console. Still fully pure otherwise: `dash` is a plain
   snapshot object passed in by the caller (main.js), never a live
   reference into its module state — same discipline as createCombatHmdV3's
   getter pattern, just a plain object since this one function is called
   directly rather than through a factory.
   @param {object} [dash]
   @param {string} [dash.weapon] - currently active weapon type (cannon/missile/nuke/enforcer)
   @param {number} [dash.cdRatio] - that weapon's cooldown ratio (0 just fired .. 1 ready)
   @param {number} [dash.warpIntensity] - real warp/throttle value (0..~1.3)
   @param {boolean} [dash.warpHover] - true while the user hovers the "入梦" warp button
   @param {number} [dash.pwr] - mothership remaining energy, 0..1 (U28 28f)
   @param {number} [dash.shield] - shield status, 0..1 (U28 28f)
*/
const WPN_COLOR_BASE={cannon:'rgba(154,229,255,',missile:'rgba(232,179,128,',nuke:'rgba(255,77,91,',enforcer:'rgba(255,94,205,'};
export function drawCockpitFrame(ctx,w,h,now,landing=false,boot=1,dash={}){
  const ac=landing?[93,255,157]:[120,210,255];
  const [cr,cg,cb]=ac;
  const rgba=(a)=>`rgba(${cr},${cg},${cb},${a})`;
  const AMBER='rgba(255,214,102,';
  const mono=(px)=>`${px}px 'JetBrains Mono',monospace`;
  const wpnColorBase=WPN_COLOR_BASE[dash.weapon]||AMBER;
  const warpIntensity=clamp(dash.warpIntensity||0,0,1.4);
  const cdRatio=clamp(dash.cdRatio??1,0,1);
  const hoverMul=dash.warpHover?3.2:1;
  // staged reveal: element group k ∈ [0,1) turns on across its own window,
  // with a bright strike right as it pops.
  const st=(k0,k1)=>clamp((boot-k0)/Math.max(.0001,k1-k0),0,1);
  const pop=(p)=>p<=0?0:p>=1?1:(p<.25?p*2.8:(.7+.3*p));      // overshoot-ish
  const flick=(p,seed)=>p>0&&p<1?(Math.sin(now/26+seed*9)>-.2?1:.35):1;
  // U28 28f: the old flowPips/fillPips scrolling-segment animation is gone
  // (station master: "取消 PWR/THR 现有的能量条滚动动画"). Replaced by one
  // vertical telemetry bar per button, all bound to real state: PWR reads
  // dash.pwr (mothership energy reserve), WPN keeps cdRatio, THR reads
  // warpIntensity (with a visible jump on warp-hover, same hoverMul this
  // file already tracked), SHLD reads dash.shield. A small live jitter is
  // layered on top of each real ratio so the bars visibly breathe
  // frame-to-frame like real telemetry instead of only moving when the
  // underlying value changes.
  const pwrRatio=clamp(dash.pwr??1,0,1);
  const shieldRatio=clamp(dash.shield??1,0,1);
  const thrRatio=clamp(clamp(warpIntensity/1.4,0,1)*hoverMul,0,1);
  const vBar=(bx,by,bw,bh,ratio,colorBase,seed)=>{
    const jitter=Math.sin(now/220+seed*7)*0.02;
    const t=clamp(ratio+jitter,0,1);
    ctx.fillStyle=`${colorBase}.12)`;
    ctx.fillRect(bx,by,bw,bh);
    const fillH=bh*t;
    ctx.fillStyle=`${colorBase}.85)`;
    ctx.fillRect(bx,by+bh-fillH,bw,fillH);
  };
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

  // --- side button column (PWR/WPN/THR/SHLD — U14b dropped the mirrored
  //     RADR/PROX/HIT/MISL column on the right entirely; U28 28f dropped
  //     COOL from this column too) ---
  const button=(bx,by,bw,bh,label,active,p,seed,colorBase)=>{
    if(p<=0) return;
    const base=colorBase||AMBER;
    const a=pop(p)*flick(p,seed);
    ctx.globalAlpha=a;
    ctx.fillStyle=active?`${base}.16)`:'rgba(6,12,18,.9)';
    ctx.strokeStyle=active?`${base}.9)`:rgba(.42);
    ctx.lineWidth=active?1.3:1;
    ctx.beginPath();ctx.rect(bx,by,bw,bh);ctx.fill();ctx.stroke();
    ctx.fillStyle=active?`${base}.95)`:rgba(.78);
    ctx.font=mono(fsBtn);ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label,bx+bw/2,by+bh/2+.5);
    ctx.globalAlpha=1;
  };
  const bw=Math.max(26,w*.058), bh=Math.max(11,h*.042), bgap=bh*.42;
  const colY=h*.755;
  const pipX=w*.015+bw+7, barW=Math.max(6,w*.012);
  // U28 28f: PWR/WPN/THR/SHLD only (COOL dropped) — four visually distinct
  // colours (low-saturation, within the dual color-temperature discipline):
  // PWR cyan-white (mothership energy), WPN the already-dynamic per-weapon
  // colour, THR blue-green (power/thrust gear), SHLD violet-cyan (shield).
  const BTN_COLOR={PWR:'rgba(210,245,255,',THR:'rgba(110,230,180,',SHLD:'rgba(190,140,255,'};
  const BTN_RATIO={PWR:pwrRatio,WPN:cdRatio,THR:thrRatio,SHLD:shieldRatio};
  ['PWR','WPN','THR','SHLD'].forEach((lb,i)=>{
    const by=colY+i*(bh+bgap);
    const p=st(.10+i*.045,.22+i*.045);
    const colorBase=lb==='WPN'?wpnColorBase:BTN_COLOR[lb];
    button(w*.015,by,bw,bh,lb,lb==='WPN',p,i,colorBase);
    if(p>=1) vBar(pipX,by,barW,bh,BTN_RATIO[lb],colorBase,i);
  });

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
  // U14e (2026-07-12): servo-lag state for the target frame — persists across
  // frames in this factory's own closure (createCombatHmdV3 is instantiated
  // once at boot, not per-frame), reset to null whenever the target isn't
  // visible so the next lock snaps in fresh instead of easing in from a
  // stale off-screen position.
  let trackCx=null, trackCy=null;

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

  /** U8 (2026-07-11): central target frame — replaces the old 4-corner SC
   *  bracket + separate shield/armor bars + shield-quadrant grid with a
   *  single plain thin-line square (screenshot reference), a short
   *  code/range label beside it, and a two-line designation + range[closing
   *  speed] readout below, plus one thin hull bar. Closing speed is read
   *  from the comet's own real vx/vy (scaled for display), not fabricated;
   *  hull % is the same single real hp value the old bars/quadrant-grid used
   *  — this just stops fanning one number out into four fake quadrants.
   *
   *  U14e (2026-07-12): the full stroked square read as too big/blunt next
   *  to the SC reference's slim tracking brackets — swapped for four short
   *  corner ticks (smaller footprint, thinner line) that read as "actively
   *  tracking" rather than "static box drawn around a point". The caller
   *  (drawCleanCombatHmd) now feeds this a servo-smoothed cx/cy instead of
   *  the raw locked-point coordinate, so the frame visibly eases toward a
   *  moving target frame-to-frame instead of snapping — same idea as a
   *  real targeting servo, implemented as a plain lerp, no new dependency. */
  function drawTargetFrame(ctx,cx,cy,size,rangeM,locked){
    const halley=getHalley();
    if(!halley||halley.destroyed) return;
    const vx=halley.vx||0, vy=halley.vy||0;
    const closingMs=Math.round(Math.hypot(vx,vy)*180);
    const rangeKm=(rangeM/1000).toFixed(1);
    ctx.save();
    ctx.strokeStyle=locked?'rgba(255,205,128,.92)':'rgba(226,246,255,.82)';
    ctx.lineWidth=0.9;
    const arm=size*.5;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([qx,qy])=>{
      const bx=cx+qx*size, by=cy+qy*size;
      ctx.beginPath();
      ctx.moveTo(bx-qx*arm,by);ctx.lineTo(bx,by);ctx.lineTo(bx,by-qy*arm);
      ctx.stroke();
    });
    const fs=Math.max(7,Math.min(9,size*.24));
    ctx.font=`${fs}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(226,246,255,.78)';
    ctx.fillText(`HALLEY · ${rangeKm}km`,cx+size+8,cy-size*.35);
    ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillStyle='rgba(226,246,255,.92)';
    ctx.fillText('1P/HALLEY',cx,cy+size+8);
    ctx.font=`${fs*.9}px 'JetBrains Mono',monospace`;
    ctx.fillStyle='rgba(180,225,255,.64)';
    ctx.fillText(`${rangeKm}km [${closingMs}m/s]`,cx,cy+size+8+fs*1.3);
    // single hull bar, below the two text lines
    const maxHp=200, hp=clamp(halley.hp||100,0,maxHp), pct=hp/maxHp;
    const bw=size*1.5, bx=cx-bw/2, by=cy+size+8+fs*2.9, bh=2;
    ctx.fillStyle='rgba(148,228,255,.18)';ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle=pct<.3?'rgba(255,120,112,.78)':'rgba(148,228,255,.62)';
    ctx.fillRect(bx,by,bw*pct,bh);
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

  /** U8 (2026-07-11): left column — mode word + coupled-flight badge (both
   *  cosmetic cockpit dressing, same tier as the rest of this file's
   *  non-gameplay flavour text) + a vertical speed tape + the big m/s
   *  number (the same cosmetic `speed` this view already computed) + two
   *  propellant readouts derived from warpIntensity (real runtime value,
   *  not static text — same honesty tier as the old chip stack's SCM/GUN
   *  rows it replaces). */
  function drawLeftColumn(ctx,w,h,now,mode,speed,warpIntensity){
    if(w<300||h<220) return;
    const combatMode=['missile','nukeAuth','nemp','mainGun','ciws'].includes(mode);
    const x=w*.045;
    ctx.save();
    ctx.font=`${Math.max(7,Math.min(9,w*.015))}px 'JetBrains Mono',monospace`;
    ctx.textAlign='left';ctx.textBaseline='top';
    // mode chip
    ctx.fillStyle='rgba(226,246,255,.85)';
    ctx.beginPath();ctx.arc(x+4,h*.34+4,3.5,0,Math.PI*2);ctx.fill();
    ctx.fillText(combatMode?'战斗':'巡航',x+13,h*.34-2);
    // coupled badge
    ctx.fillStyle='rgba(148,228,255,.55)';
    ctx.fillText('耦合',x,h*.34+16);
    // vertical speed tape — U28 28e: same y-start/height/width as the right
    // column's boost/capacitor bar (RULER_Y/RULER_H/RULER_W below) so the
    // two rulers read as a mirrored pair instead of sitting at different
    // heights, per station master's "标尺左右平行对称" call.
    const RULER_Y=h*.20, RULER_H=h*.34, RULER_W=6;
    const tapeY=RULER_Y, tapeH=RULER_H, tapeX=x+2;
    ctx.fillStyle='rgba(154,229,255,.10)';ctx.fillRect(tapeX-RULER_W/2,tapeY,RULER_W,tapeH);
    ctx.strokeStyle='rgba(154,229,255,.30)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(tapeX,tapeY);ctx.lineTo(tapeX,tapeY+tapeH);ctx.stroke();
    for(let i=0;i<=4;i++){
      const ty=tapeY+tapeH*i/4;
      ctx.beginPath();ctx.moveTo(tapeX-3,ty);ctx.lineTo(tapeX+3,ty);ctx.stroke();
    }
    const speedT=clamp((speed-600)/500,0,1);
    const markY=tapeY+tapeH*(1-speedT);
    ctx.fillStyle='rgba(226,246,255,.92)';
    ctx.fillRect(tapeX-5,markY-1.5,10,3);
    // big m/s number
    ctx.font=`${Math.max(16,Math.min(26,w*.045))}px 'Orbitron',sans-serif`;
    ctx.fillStyle='rgba(226,246,255,.95)';
    ctx.textBaseline='alphabetic';
    ctx.fillText(String(speed),x,tapeY+tapeH+28);
    ctx.font=`${Math.max(6,w*.011)}px 'JetBrains Mono',monospace`;
    ctx.fillStyle='rgba(180,225,255,.5)';
    ctx.fillText('m/s',x,tapeY+tapeH+38);
    // propellant readouts (derived from warpIntensity — real value)
    const h2Pct=Math.round(clamp(99-warpIntensity*6,60,99));
    const qPct=Math.round(clamp(89-(1-warpIntensity)*4,55,89));
    ctx.font=`${Math.max(7,w*.013)}px 'JetBrains Mono',monospace`;
    ctx.fillStyle='rgba(148,228,255,.7)';
    ctx.fillText(`${h2Pct}% 氢燃料`,x,h*.92);
    ctx.fillText(`${qPct}% 量子燃料`,x,h*.92+13);
    ctx.restore();
  }

  /** U8 (2026-07-11): right column — ammo tally + a two-tone boost/capacitor
   *  bar + the real G readout (already computed elsewhere in this view from
   *  warpIntensity) + a boost percentage derived from the same value.
   *  U14e (2026-07-12): the tally used to be two hard-coded strings ("速射炮
   *  48·4"/"导弹 5·1") that never changed for the entire session — the
   *  leading count now actually depletes with the real kill count (same
   *  honesty tier as the rest of this view: a real number, just applied
   *  with a plausible-not-invented depletion rate since the game doesn't
   *  track literal rounds-per-kill); the trailing "current burst" digit is
   *  still cosmetic dressing, but now visibly cycles instead of being
   *  frozen at its first-paint value. */
  function drawRightColumn(ctx,w,h,now,warpIntensity){
    if(w<300||h<220) return;
    const rx=w*.955;
    const kills=getKillCount?getKillCount():0;
    const cannonLeft=Math.max(6,48-kills*2);
    const missileLeft=Math.max(0,5-Math.floor(kills/2));
    const burstA=1+Math.floor((now/1300)%4);
    const burstB=1+Math.floor((now/1700)%2);
    ctx.save();
    ctx.font=`${Math.max(7,Math.min(9,w*.014))}px 'JetBrains Mono',monospace`;
    ctx.textAlign='right';ctx.textBaseline='top';
    ctx.fillStyle='rgba(148,228,255,.6)';
    ctx.fillText(`速射炮 ${cannonLeft}·${burstA}`,rx,h*.10);
    ctx.fillText(`导弹 ${missileLeft}·${burstB}`,rx,h*.10+13);
    // boost bar (two-tone: cyan-green body, amber-red base segment) — U28
    // 28e: y/height/width (h*.20/h*.34/6) mirror drawLeftColumn's RULER_Y/
    // RULER_H/RULER_W exactly, keeping the two side rulers symmetric.
    const barX=rx-8, barY=h*.20, barH=h*.34, barW=6;
    const fillT=clamp(warpIntensity,0,1);
    ctx.fillStyle='rgba(154,229,255,.14)';ctx.fillRect(barX-barW,barY,barW,barH);
    const baseH=barH*.18;
    ctx.fillStyle='rgba(255,120,112,.7)';ctx.fillRect(barX-barW,barY+barH-baseH,barW,Math.min(baseH,barH*fillT));
    const bodyH=Math.max(0,barH*fillT-baseH);
    ctx.fillStyle='rgba(120,255,178,.7)';ctx.fillRect(barX-barW,barY+barH-baseH-bodyH,barW,bodyH);
    // G readout (real, same figure the old bottom telemetry line used)
    const g=(1.2+warpIntensity*.9);
    ctx.textAlign='right';ctx.textBaseline='alphabetic';
    ctx.font=`${Math.max(8,w*.016)}px 'JetBrains Mono',monospace`;
    ctx.fillStyle='rgba(226,246,255,.85)';
    ctx.fillText(g.toFixed(1),rx,h*.62);
    ctx.font=`${Math.max(6,w*.011)}px 'JetBrains Mono',monospace`;
    ctx.fillStyle='rgba(180,225,255,.5)';
    ctx.fillText('G',rx,h*.62+11);
    // boost %
    const boostPct=Math.round(clamp(70+warpIntensity*30,70,100));
    ctx.font=`${Math.max(7,w*.013)}px 'JetBrains Mono',monospace`;
    ctx.fillStyle='rgba(148,228,255,.7)';
    ctx.fillText(`${boostPct}% 加力`,rx,h*.92);
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

  /* ===== Main combat HMD (v3 — U8 2026-07-11: "减法改造", Star Citizen
     reference-screenshot minimal layout — near-monochrome cyan/white,
     no panel chrome, no bordered boxes anywhere except the one central
     target frame; the centre of the screen stays clear for the scene) === */
  function drawCleanCombatHmd(ctx,w,h,now,label,mode){
    const halley=getHalley(), warpIntensity=getWarpIntensity(), shipRecoil=getShipRecoil();
    const missileLike=mode==='missile'||mode==='nukeAuth'||mode==='nemp';
    const lock=pilotTrackedPoint(w,h,mode);
    const speed=Math.round(760+warpIntensity*240+Math.sin(now/900)*16);
    const range=lock.visible?Math.max(88,Math.round(720-lock.approach*560+(halley?.collisionRisk||0)*80)):620;
    ctx.save();

    // Soft vignette — glass tint
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'rgba(8,26,42,.28)');g.addColorStop(.5,'rgba(0,5,12,.02)');g.addColorStop(1,'rgba(3,10,18,.40)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);

    // ── Flight-path marker (velocity vector) ────────────────────────────────
    drawVelocityVector(ctx,w,h,now);

    // ── Boresight (V17b: SC dashed-cross reticle) ────────────────────────────
    drawSCReticle(ctx,w*.5,h*.46);

    // ── Left/right cockpit columns (U8: replaces the old chip stacks) ──────
    drawLeftColumn(ctx,w,h,now,mode,speed,warpIntensity);
    drawRightColumn(ctx,w,h,now,warpIntensity);

    // U28 28e (2026-07-14): the fixed-position decorative contact labels
    // (DEEP-SPACE-KING/WARMASTAR/etc + the real-escort branch that fed them)
    // were deleted outright — station master: they never should have
    // existed. Any future on-HUD contact list must come from a real 3D
    // entity projection, not an invented 2D screen slot.

    // ── Target: comet + plain frame + lead indicator ────────────────────────
    const cx=lock.visible?lock.cx:w*.62;
    const cy=lock.visible?lock.cy:h*.40;
    if(lock.visible){
      const sizeScale={small:1,medium:1.2,large:1.4,giant:1.65}[halley?.sizeClass]||1.2;
      hmdComet(ctx,cx,cy,4.4*sizeScale,now,halley?.vx??-1,halley?.vy??.3);
      // U14e: the tracking frame eases toward the real point instead of
      // snapping to it — a plain per-frame lerp (no dt weighting; this
      // canvas already assumes a steady rAF cadence elsewhere, e.g. the
      // sine-driven drifts above) reads as a servo with a little inertia.
      if(trackCx==null){trackCx=cx;trackCy=cy;}
      else{trackCx+=(cx-trackCx)*.16;trackCy+=(cy-trackCy)*.16;}
      drawTargetFrame(ctx,trackCx,trackCy,Math.min(w,h)*.062*sizeScale,range,!!lock.locked);
      drawLeadIndicator(ctx,trackCx,trackCy,w,h,now);
    } else {
      trackCx=null;trackCy=null;
      drawThreatEdgeArrow(ctx,w,h);
    }

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

    ctx.restore();
  }

  return { drawCleanCombatHmd };
}
