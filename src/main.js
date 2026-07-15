import './styles.css';
import { createHudImages } from './assets/hudAssets.js';
import { createCombatRuntime } from './combat/combatRuntime.js';
import {
  DEFENSE_ATTACK_TIME_SCALE,
  DEFENSE_PROJECTILE_SPEED_SCALE,
  MISSILE_DROP_MS,
  MISSILE_IGNITE_MS,
  MISSILE_RAMP_MS,
  TOTAL_BOMBERS,
  TOTAL_FIGHTERS,
  WEAPON_COOLDOWN_MS,
  WEAPON_NAMES,
  createInitialFleetHp,
} from './config/combatConfig.js';
import { COPY, HUD_COPY, getHudCopy } from './data/content.js';
import { createBackgroundScene } from './scene/backgroundScene.js';
import { createSpriteCraft } from './scene/spriteCraft.js';
import { createCameraDirector } from './scene/cameraDirector.js';
import { createCapitalFlyby } from './scene/capitalFlyby.js';
import { drawCombatHudSC } from './scene/combatHudSC.js';
import { drawMissileCine, drawNukeCine } from './scene/combatCine.js';
import { startTimeline, activePhase } from './combat/weaponClock.js';
import { createBattleFeed } from './ui/battleFeed.js';
import {
  HMD,
  cornerFrame as hmdCornerFrame,
  cometTarget as hmdComet,
  targetBracket as hmdBracket,
  telemetryLine as hmdTelemetry,
  statusChip as hmdStatusChip,
  tracerStream as hmdTracer,
  impactSparks as hmdSparks,
} from './ui/hmdMinimal.js';
import { createCombatHmdV3, drawCockpitFrame, drawSCZoomScope } from './ui/combatHmdV3.js';
import { createCombatViewState } from './ui/combatView.js';
import { initMarketDeck } from './ui/marketDeck.js';
import { createPageTurnController } from './ui/pageTurn.js';
import { createRadarDeck } from './ui/radarDeck.js';
import { createSoftClockRenderer } from './ui/softClock.js';
import { initTerminalStarMap } from './ui/terminalStarMap.js';
import { applyDeviceBodyClasses, setText } from './utils/dom.js';
import { clamp, easeOut, lerp, rand } from './utils/math.js';
import { createCursor } from './ui/cursor.ts';

let currentLang='en';
try{const savedLang=localStorage.getItem('afflatus-lang');if(savedLang==='zh'||savedLang==='en')currentLang=savedLang;}catch(e){}
const REDUCED_MOTION=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

applyDeviceBodyClasses();

/* ===== baked multi-angle craft sprites + cinematic cameras ===== */
const spriteCraft=createSpriteCraft();
const cameraDirector=createCameraDirector(spriteCraft);
const capitalFlyby=createCapitalFlyby();

// Lazy-loaded three.js capital ship (code-split so three.js only downloads the
// first time the main gun fires). Until it loads, the 2D flyby is the fallback.
let ship3D=null, ship3DTried=false;
function getShip3D(){
  if(!ship3DTried){
    ship3DTried=true;
    import('./scene/capitalShip3D.js')
      .then(m=>{ try{ ship3D=m.createCapitalShip3D(); }catch(e){ ship3D=null; } })
      .catch(()=>{ ship3D=null; });
  }
  return ship3D;
}

// Lazy-loaded three.js combat fighter (code-split; loads when escorts launch).
let fighter3D=null, fighter3DTried=false;
function getFighter3D(){
  if(!fighter3DTried){
    fighter3DTried=true;
    import('./scene/fighter3D.js')
      .then(m=>{ try{ fighter3D=m.createFighter3D(); }catch(e){ fighter3D=null; } })
      .catch(()=>{ fighter3D=null; });
  }
  return fighter3D;
}

// ── Top-down WebGL combat view (U23 M1, 2026-07-13: now the DEFAULT) ──
// Renders the 2.5D god's-eye scene (src/scene/topdownCombat.js) offscreen and
// blits it into #pilotFeed for the main combat/standby modes. ON by default;
// opt out with ?combatview=2d (persists), re-enable with ?combatview=topdown.
// Falls back to the existing 2D cockpit if WebGL/the module is unavailable.
let topdownCV=null, topdownTried=false, topdownCanvas=null;
let tdFlightStamp=0; // U24 (24c): last pilotView.started that triggered a flight event — one event per mode entry
function combatViewTopdown(){
  try{
    const q=location.search;
    if(/[?&]combatview=topdown\b/.test(q)) localStorage.setItem('afflatus-combatview','topdown');
    else if(/[?&]combatview=2d\b/.test(q)) localStorage.setItem('afflatus-combatview','2d');
    return localStorage.getItem('afflatus-combatview')!=='2d';
  }catch(e){ return !/[?&]combatview=2d\b/.test(location.search); }
}
function getTopdownCV(){
  if(!topdownTried){
    topdownTried=true;
    import('./scene/topdownCombat.js')
      .then(m=>{ try{ topdownCanvas=document.createElement('canvas'); topdownCV=m.createTopdownCombat({canvas:topdownCanvas}); }catch(e){ topdownCV=null; } })
      .catch(()=>{ topdownCV=null; });
  }
  return topdownCV;
}

// HMD v3 (cockpit frame + flight-path marker / power pips / target health bars /
// lead indicator / threat edge arrows) is the default combat/standby HUD.
// ?combatview=sc opts into the alternate SC-cockpit-panel HUD (combatHudSC.js —
// GIMBAL/GROUP holo, SCM/AB throttle bars); ?combatview=legacy affects the
// unrelated missile/nuke POV-vs-cinematic toggles below.
function combatViewLegacy(){ try{ return /[?&]combatview=legacy\b/.test(location.search); }catch(e){ return false; } }
function combatViewScPanel(){ try{ return /[?&]combatview=sc\b/.test(location.search); }catch(e){ return false; } }
// V18 Phase 1 item 2 → U23 M1 (2026-07-13): the camera director is now ON by
// default (matches the scene's own cameraDirectorEnabled()); opt out with
// ?combatcam=tactical. Still ANDed with combatViewTopdown() to gate the
// missile-mode 3D chase-cam path below — ?combatview=2d therefore restores
// the full legacy experience (drawMissileCine included) in one flag.
function combatCamDirector(){ try{ return !/[?&]combatcam=tactical\b/.test(location.search); }catch(e){ return true; } }
// 2026-07-03 data-binding audit (ROADMAP §4b item 1): combatHudState() is only
// ever called from the combat/standby branches of drawPilotFeed (mode is
// always 'combat' or 'standby' there — launch/landing render through
// drawPilotDeck+drawCockpitFrame instead, see drawPilotFeed). So the
// mode==='launch'/'landing' branches below, and alt/vsi/atmo/ladder, are
// currently unreachable with real values — confirmed, not a regression.
// Wiring combatHudSC into the launch/landing path too (so its pitch-ladder
// and R-ALT/VSI/ATMO fields would actually fire) is bigger than a data-
// binding fix — it's a second visual system for a phase HMD v3 already
// covers well — so it's left as a documented gap rather than faked here.
// speed/ab/g all read real live flight telemetry (window.__warpPower /
// window.__gLoad, set alongside the bridge dashboard gauges); kills/lock
// read real combat state (killCount / halley.hover). heading previously used
// a synthetic time sweep unrelated to any other instrument — switched to the
// same real window.__navDeg the bridge nav dial uses, so the SC-panel skin's
// heading tape now agrees with the rest of the HUD instead of drifting on
// its own clock.
function combatHudState(mode){
  const cls=document.body.classList; const warn=[]; let accent='cy';
  if(cls.contains('nuke-alert')){ warn.push(currentLang==='zh'?'警报：核打击在途':'ALERT: NUCLEAR STRIKE INBOUND'); accent='rd'; }
  else if(cls.contains('emp-effect')){ warn.push(currentLang==='zh'?'警告：EMP · 系统降级':'WARNING: EMP — SYSTEMS DEGRADED'); accent='am'; }
  const wp=(window.__warpPower||41)/100;
  return {
    scm:(mode==='launch'||mode==='landing')?'NAV':'SCM', mode:'GUN',
    speed:Math.round(60+wp*180+warpIntensity*120), ab:clamp(0.4+wp*0.6,0,1),
    hFuel:99, qFuel:100, alt:0, vsi:0, g:(window.__gLoad||1.2), gMax:8.0,
    heading:Math.round(window.__navDeg??((performance.now()/80)%360)), decoy:48, noise:5,
    shieldF:cls.contains('nuke-alert')?0:75, shieldR:cls.contains('nuke-alert')?0:75,
    status: mode==='launch'?(currentLang==='zh'?'起飞授权':'TAKEOFF'):(mode==='landing'?(currentLang==='zh'?'进近':'APPROACH'):'ONLINE'),
    warn, accent, ladder:false,
    kills: killCount, lock: !!(halley && halley.hover)   // real battle state
  };
}

function HC(key){return getHudCopy(key,currentLang);}
function lerpAngle(from,to,t){
  const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));
  return from+delta*t;
}
function smoothHeadingFromVelocity(obj,fallback=-Math.PI/2,rate=.18){
  const sp=Math.hypot(obj.vx||0,obj.vy||0);
  const target=sp>.04?Math.atan2(obj.vy,obj.vx):fallback;
  obj.angle=lerpAngle(obj.angle??target,target,rate);
  obj.bank=lerp(obj.bank||0,clamp(Math.atan2(Math.sin(target-(obj.prevAngle??target)),Math.cos(target-(obj.prevAngle??target)))*3.4,-.42,.42),.16);
  obj.prevAngle=obj.angle;
  return obj.angle;
}
/* ===== UI & HUD ===== */
const cursorCtl=createCursor(document.getElementById('cursor'));
let mx=innerWidth/2,my=innerHeight/2,pcx=mx,pcy=my; window.__mouseReady=false;
addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;window.__mouseReady=true;});
document.querySelectorAll('[data-hot],a,button').forEach(el=>{
  el.addEventListener('mouseenter',()=>cursorCtl.setHot(true));
  el.addEventListener('mouseleave',()=>cursorCtl.setHot(false));
});

const combatHud=document.getElementById('combatHud');
const radarCanvas=document.getElementById('radarCanvas');
const radarDeck=createRadarDeck(radarCanvas);
const rctx=radarDeck.ctx;
const radarState=radarDeck.state;
const HUD_IMAGES=createHudImages();
const commandModeBtn=document.getElementById('commandModeBtn');
const jumpToggle=document.getElementById('jumpToggle');
const bridgeCallout=document.getElementById('bridgeCallout');
function showBridgeCallout(text){
  if(!bridgeCallout) return;
  bridgeCallout.textContent=text;
  bridgeCallout.classList.add('on');
  clearTimeout(showBridgeCallout.timer);
  showBridgeCallout.timer=setTimeout(()=>bridgeCallout.classList.remove('on'),1550);
}
function updateCommandButton(){
  if(!commandModeBtn) return;
  commandModeBtn.textContent=document.body.classList.contains('hud-off')?(currentLang==='zh'?'指挥模式':'Command'):(currentLang==='zh'?'巡航模式':'Cruise');
}
/* V22 §7.9 ③: mobile "reach any page" menu. index.html already shipped a
   hamburger button (.nav-menu-btn) that was never wired to anything —
   see styles.css's end-of-file note for why it was also invisible.
   Reuses the shared page list nav.js exposes as window.AfflatusSite and
   mirrors nav.js's own Labs-dropdown pattern: a panel portaled to a
   direct child of <body> (this page's nav only reaches z-index:100
   while several HUD layers sit at 900+, which would otherwise cover it),
   positioned via JS off the button's own rect. */
(function initNavSiteMenu(){
  const btn=document.querySelector('.nav-menu-btn');
  if(!btn) return;
  const pages=(window.AfflatusSite&&window.AfflatusSite.length)?window.AfflatusSite:[
    {path:'/',en:'Home',zh:'首页'},{path:'/arena.html',en:'Arena',zh:'竞技场'},
    {path:'/sectors.html',en:'Sectors',zh:'板块'},{path:'/signal.html',en:'Signal',zh:'信号'},
    {path:'/games.html',en:'Games',zh:'竞猜'},{path:'/league.html',en:'Leagues',zh:'电竞'},
    {path:'/horoscope.html',en:'Horoscope',zh:'观星'},{path:'/serial.html',en:'Novels',zh:'小说'},
    {path:'/course.html',en:'Course',zh:'课程'}
  ];
  // U27 27c: BRIDGE SIM entry — home-page-only (this dropdown only exists on
  // index.html; boot.html is a deliberately non-indexed prototype, so it's
  // appended here rather than added to nav.js's site-wide SITE array).
  pages.push({path:'/boot.html',en:'Bridge Sim',zh:'舰桥模拟'});
  const norm=(p)=>{p=(p||'/').replace(/index\.html$/,'');return p===''?'/':p;};
  const here=norm(location.pathname);
  let panel=null;
  function buildPanel(){
    if(!panel){
      panel=document.createElement('div');
      panel.className='nav-labs__menu nav-site-menu';
      pages.forEach((p)=>{
        const a=document.createElement('a');
        a.href=p.path;
        if(norm(p.path)===here) a.className='active';
        panel.appendChild(a);
      });
      document.body.appendChild(panel);
    }
    panel.querySelectorAll('a').forEach((a,idx)=>{ a.textContent=currentLang==='zh'?pages[idx].zh:pages[idx].en; });
    return panel;
  }
  function closePanel(){ if(panel) panel.classList.remove('open'); }
  btn.addEventListener('click',(e)=>{
    e.stopPropagation();
    const p=buildPanel();
    if(p.classList.contains('open')){ closePanel(); return; }
    const r=btn.getBoundingClientRect();
    p.style.top=Math.round(r.bottom+8)+'px';
    p.style.right=Math.max(8,Math.round(innerWidth-r.right))+'px';
    p.style.left='auto';
    p.classList.add('open');
  });
  document.addEventListener('click',closePanel);
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closePanel(); });
  addEventListener('scroll',closePanel,{passive:true});
  addEventListener('resize',closePanel);
})();
function updateJumpButton(){
  if(!jumpToggle) return;
  const holdings=document.querySelector('.holdings');
  const inHoldings=holdings && scrollY > holdings.offsetTop-innerHeight*.42;
  jumpToggle.textContent=inHoldings?(currentLang==='zh'?'返回舰桥':'Bridge'):(currentLang==='zh'?'资产甲板':'Assets');
}
function cruiseModeActive(){return document.body.classList.contains('hud-off');}
function disengageBattleSystems(){
  weapons=[]; escorts=[]; explosions=[]; mainCannonFx=null; nukeFlash=0; shipRecoil=0;
  enforcerChargeUntil=0; nukeCountdownUntil=0;
  document.body.classList.remove('weapon-cutoff','nuke-alert','emp-effect','emp-recover','hud-static','main-cannon-firing','shake');
  weaponWarning?.classList.remove('on');
  document.getElementById('nukeWarning')?.classList.remove('on');
  if(halley){halley.attackStarted=false;halley.playerFired=false;halley.escortsFired=true;halley.escortsSpawned=false;}
}
commandModeBtn?.addEventListener('click',()=>{
  const toHudOff=!document.body.classList.contains('hud-off');
  document.body.classList.toggle('hud-off',toHudOff);
  if(toHudOff) disengageBattleSystems();
  showBridgeCallout(toHudOff?'Cruising mode on':'Commander mode on');
  updateCommandButton();
});
jumpToggle?.addEventListener('click',()=>{
  const holdings=document.querySelector('.holdings'), hero=document.querySelector('.hero');
  const inHoldings=holdings && scrollY > holdings.offsetTop-innerHeight*.42;
  (inHoldings?hero:holdings)?.scrollIntoView({behavior:'smooth',block:'start'});
});
addEventListener('scroll',updateJumpButton,{passive:true});

createPageTurnController();

let combatHot=true, combatHoldTimer=null;
const weaponSelect=document.getElementById('weaponSelect');
const apToggle=document.getElementById('apToggle');
const battleLog=document.getElementById('battleLog');
const weaponWarning=document.getElementById('weaponWarning');
let enforcerCooldownUntil=0, empUntil=0, enforcerChargeUntil=0, nukeCountdownUntil=0, shipRecoil=0;
const weaponCooldownMs=WEAPON_COOLDOWN_MS;
let missileReloadPending=false;
const totalFighters=TOTAL_FIGHTERS, totalBombers=TOTAL_BOMBERS;
const weaponNames=WEAPON_NAMES;
let apAuto=true;
const combatRuntime=createCombatRuntime({
  weaponCooldownMs,
  createInitialFleetHp,
  getEscorts:()=>escorts,
  getCombatFlags:()=>({
    weaponCutoff:document.body.classList.contains('weapon-cutoff'),
    nukeAlert:document.body.classList.contains('nuke-alert'),
    empEffect:document.body.classList.contains('emp-effect')
  }),
  getEnforcerCooldown:()=>enforcerCooldownUntil,
  setEnforcerCooldown:value=>{enforcerCooldownUntil=value;}
});
const {
  fleetHp,
  fleetHealthAverage,
  hpFor,
  setProgress,
  startService,
  startWeaponCooldown,
  tickService,
  weaponCooldownRatio,
  weaponReady,
  weaponRemaining,
}=combatRuntime;
const combatViewState=createCombatViewState();
let pilotView=combatViewState.view;
function logBattle(msg){
  if(!battleLog) return;
  const text=String(msg || '').replace(/^\d{2}:\d{2}:\d{2}\s*/, '').trim();
  if(!text || battleLog.dataset.message===text) return;
  battleLog.dataset.message=text;
  battleLog.classList.remove('flipping');
  void battleLog.offsetWidth;
  battleLog.textContent=text;
  battleLog.classList.add('flipping');
}
function setPilotView(mode, subject=null, ms=4200){
  pilotView=combatViewState.set(mode,subject,ms);
}
function commandTimestamp(offsetSec=0){
  const d=new Date(Date.now()-offsetSec*1000);
  return [d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
}
const renderSoftClock=createSoftClockRenderer(document.getElementById('melDateTime'));
const {
  ensureKillMeter,
  pushBattleToast,
  seedBattleFeed,
}=createBattleFeed({getLang:()=>currentLang,timestamp:commandTimestamp});
if(weaponSelect) weaponSelect.addEventListener('change',()=>{
  apAuto=weaponSelect.value==='auto';
  updateCombatModule();
  logBattle(`${HC('logWeapon')} · ${weaponSelect.options[weaponSelect.selectedIndex].text}`);
});
if(apToggle) apToggle.addEventListener('click',(e)=>{
  e.preventDefault();
  e.stopPropagation();
  apAuto=!apAuto;
  if(apAuto && weaponSelect) weaponSelect.value='auto';
  if(!apAuto && weaponSelect && weaponSelect.value==='auto') weaponSelect.value=recommendedWeapon();
  updateCombatModule();
  logBattle(apAuto ? `${HC('logWeapon')} · AP ${HC('apAuto')}` : `${HC('logWeapon')} · AP ${HC('apManual')}`);
});
document.querySelectorAll('.weapon-choice').forEach(btn=>{
  btn.addEventListener('click',()=>{
    apAuto=false;
    weaponSelect.value=btn.dataset.weapon;
    updateCombatModule();
    logBattle(`${HC('logWeapon')} · ${btn.querySelector('b').textContent}`);
  });
});

function recommendedWeapon(){
  if(!halley) return 'auto';
  const byClass={
    small:['cannon','missile','enforcer','nuke'],
    medium:['missile','cannon','enforcer','nuke'],
    large:['nuke','missile','enforcer','cannon'],
    giant:['enforcer','nuke','missile','cannon']
  }[halley.sizeClass||'medium'];
  return byClass.find(weaponReady) || byClass.reduce((best,w)=>weaponRemaining(w)<weaponRemaining(best)?w:best,byClass[0]);
}
function selectedWeapon(){
  return !apAuto && weaponSelect?.value && weaponSelect.value !== 'auto' ? weaponSelect.value : recommendedWeapon();
}
function interceptProbability(){
  if(!halley) return 0;
  const mode=chooseWeapon(halley.isGiant);
  if(mode==='cannon'){
    const speedPenalty=clamp(((halley.speedKms||38)-34)/120,0,18);
    return Math.round(clamp(86-speedPenalty-(halley.collisionRisk||0)*10,52,90));
  }
  const base={small:96,medium:88,large:74,giant:62}[halley.sizeClass||'medium'];
  const weaponBonus={cannon:0,missile:4,nuke:10,enforcer:18,auto:0}[mode]||0;
  const riskPenalty=(halley.collisionRisk||0)*12;
  const cooldownPenalty=!weaponReady(mode)?22:0;
  return Math.round(clamp(base+weaponBonus-riskPenalty-cooldownPenalty,28,99));
}
function localWeaponName(w){
  const idx=currentLang==='zh'?0:1;
  return (weaponNames[w]||weaponNames.auto)[idx];
}
function updateCombatModule(){
  tickService();
  // 2026-07-04 (ROADMAP §4 V16 — single weapon clock): the nuke T-countdown
  // and main-gun charge countdown used to each run their own setInterval(40)
  // poll, independent of this rAF-driven update — two clocks for numbers
  // that both ultimately come from the same Date.now()-based deadline
  // variable. Both are now ticked right here, once per frame, reading the
  // exact same nukeCountdownUntil/enforcerChargeUntil that updateTopTelemetry()
  // already uses for the battle-log status line (see logBattle() calls
  // there) — one clock, multiple consumers, always in lockstep.
  if(nukeCountdownUntil>0){
    const remain=Math.max(0,(nukeCountdownUntil-Date.now())/1000);
    const nukeWarningEl=document.getElementById('nukeWarning');
    if(nukeWarningEl){
      nukeWarningEl.innerHTML=`<span class="rad-symbol">☢</span>${HC('fusion')}<br>LASER T-${remain.toFixed(2)}`;
      if(remain<=0){nukeWarningEl.classList.remove('on');document.body.classList.remove('nuke-alert');}
    }
  }
  if(enforcerChargeUntil>0){
    const remain=Math.max(0,(enforcerChargeUntil-Date.now())/1000);
    weaponWarning.innerHTML=`<b>${HC('enforcerWarn')}</b><span>${HC('brace')}${remain.toFixed(2)}</span>`;
  }
  const rec=recommendedWeapon(), active=chooseWeapon(!!halley?.isGiant), manual=apAuto ? 'auto' : (weaponSelect?.value || 'auto');
  ensureKillMeter();
  const killCounter=document.getElementById('killCounter');
  if(killCounter) killCounter.textContent=String(killCount);
  const battleFeed=document.getElementById('battleFeed');
  if(battleFeed) battleFeed.dataset.kills=String(killCount);
  const hudKillCount=document.getElementById('hudKillCount');
  if(hudKillCount) hudKillCount.textContent=String(killCount);
  const airborneFighters=escorts.filter(e=>e.type!=='b2'&&e.state!=='return'&&e.state!=='returnBoost').length;
  const airborneBombers=escorts.filter(e=>e.type==='b2'&&e.state!=='return'&&e.state!=='returnBoost').length;
  const fighterStock=document.getElementById('fighterStock');
  if(fighterStock) fighterStock.textContent=`${Math.max(0,totalFighters-Math.min(totalFighters,airborneFighters))} / ${totalFighters}`;
  const bomberStock=document.getElementById('bomberStock');
  if(bomberStock) bomberStock.textContent=`${Math.max(0,totalBombers-Math.min(totalBombers,airborneBombers))} / ${totalBombers}`;
  const apState=document.getElementById('apState'); if(apState) apState.textContent=apAuto ? HC('apAuto') : HC('apManual');
  if(apToggle) apToggle.classList.toggle('manual',!apAuto);
  const ammoPctVal=Math.round(combatRuntime.getAmmoLevel());
  const repairPctVal=Math.round(fleetHealthAverage());
  const bayPctVal=Math.round(Math.min(96,combatRuntime.getDeckReadiness()));
  const ammo=document.getElementById('ammoCd'), device=document.getElementById('deviceCd'), bay=document.getElementById('bayCd');
  const ammoPct=document.getElementById('ammoPct'), devicePct=document.getElementById('devicePct'), bayPct=document.getElementById('bayPct');
  setProgress(ammo,ammoPctVal);
  setProgress(device,repairPctVal);
  setProgress(bay,bayPctVal);
  if(ammoPct) ammoPct.textContent=`${ammoPctVal}%`;
  if(devicePct) devicePct.textContent=`${repairPctVal}%`;
  if(bayPct) bayPct.textContent=`${bayPctVal}%`;
  document.querySelectorAll('.weapon-choice').forEach(btn=>{
    const w=btn.dataset.weapon;
    const ready=weaponReady(w);
    const ratio=weaponCooldownRatio(w);
    const rem=Math.ceil(weaponRemaining(w)/1000);
    const temp=Math.round(lerp(820,86,ratio));
    btn.style.setProperty('--cool',ratio.toFixed(3));
    btn.dataset.status=ready?(currentLang==='zh'?'就绪':'READY'):(w==='enforcer'?`${temp}°C`:`${rem}s`);
    btn.classList.toggle('cooling',!ready);
    btn.classList.toggle('ready-gun',ready);
    btn.classList.toggle('ready',ready);
    btn.classList.toggle('recommended',w===rec);
    btn.classList.toggle('selected',w===active || (!apAuto && manual===w));
    btn.classList.toggle('locked',halley?.hover && w===active);
  });
  updateFleetBay();
}
function updateFleetBay(){
  const slots=[...document.querySelectorAll('.craft-slot')];
  if(!slots.length) return;
      const active={f47:new Set(),b2:new Set(),b1b:new Set()};
  escorts.forEach(e=>{if(active[e.type]&&!['return','returnBoost'].includes(e.state)) active[e.type].add(e.bayIndex??0);});
  const maintenance=document.body.classList.contains('nuke-alert')||document.body.classList.contains('weapon-cutoff')||document.body.classList.contains('emp-effect')||combatRuntime.serviceActive();
  const seen={f47:0,b2:0,b1b:0};
  slots.forEach(slot=>{
    const type=slot.dataset.craft;
    seen[type]=(seen[type]||0)+1;
    const hp=hpFor(type,seen[type]-1);
    const hpEl=slot.querySelector('.craft-hp');
    if(hpEl) hpEl.textContent=String(hp);
    const empty=!!active[type]?.has(seen[type]-1);
    slot.classList.toggle('empty',empty);
    slot.classList.toggle('maintenance',!empty && maintenance);
    slot.classList.toggle('ready',!empty && !maintenance);
    slot.classList.toggle('damaged',hp<88 && hp>=55);
    slot.classList.toggle('critical',hp<55);
  });
}
function updateCursorTarget(){
  document.querySelectorAll('#cursorTarget').forEach((el,idx)=>{ if(idx>0) el.remove(); });
  const box=document.getElementById('cursorTarget');
  if(!box) return;
  if(halley?.hover && !halley.destroyed){
    const h=HUD_COPY[currentLang]||HUD_COPY.zh;
    const threatIndex={small:0,medium:1,large:2,giant:3}[halley.sizeClass||'medium'];
    const prob = interceptProbability();
    box.innerHTML=`${h.speed} ${(halley.speedKms||0).toFixed(1)} KM/S<br>${h.heading} ${(halley.headingDeg||0).toFixed(0).padStart(3,'0')}°<br>${h.threatLabel} ${h.threat[threatIndex]} · ${h.intercept} ${prob}%`;
    // Keep the readout clear of the comet's bright tail. The tail trails
    // opposite to the comet's velocity, so place the box on the leading side;
    // flip near screen edges so it never runs off-frame.
    const vx=halley.vx??-1, vy=halley.vy??.3;
    let boxLeft = vx<0;                       // moving left → tail on right → box left
    if(mx > innerWidth*.78) boxLeft=true;
    if(mx < innerWidth*.22) boxLeft=false;
    let boxAbove = vy<0;                       // moving up → tail below → box above
    if(my < innerHeight*.24) boxAbove=false;
    if(my > innerHeight*.72) boxAbove=true;
    cursorCtl.setTargeting({left:boxLeft, above:boxAbove});
  }else{
    cursorCtl.setTargeting(null);
  }
}

function applyHudLanguage(){
  const h=HUD_COPY[currentLang]||HUD_COPY.zh;
  setText('.hud-warning',h.wake);
  setText('.hud-subwarning',h.sub);
  setText('[data-hud="battleTitle"]',h.battleTitle);
  setText('[data-hud="pilotTitle"]',h.pilotTitle);
  setText('[data-hud="systemsTitle"]',h.systemsTitle);
  setText('[data-hud="hangarTitle"]',h.hangarTitle);
  setText('[data-hud="sideProfile"]',h.sideProfile);
  setText('[data-hud="rearProfile"]',h.rearProfile);
  const weaponLabel=document.querySelector('.mobile-weapon-form label'); if(weaponLabel) weaponLabel.textContent=h.weaponLabel;
  if(weaponSelect) [...weaponSelect.options].forEach((opt,i)=>{opt.textContent=h.options[i];});
  const rows=[...document.querySelectorAll('.hud-right .hud-row span:first-child')];
  [h.core,h.thrusters,h.shield,h.scan].forEach((txt,i)=>{if(rows[i])rows[i].textContent=txt;});
  ['core','thrusters','shield','scan'].forEach(k=>document.querySelectorAll(`.sys-bars [data-hud="${k}"]`).forEach(el=>el.textContent=h[k]));
  const hudThrusters=document.getElementById('hudThrusters'); if(hudThrusters) hudThrusters.textContent=document.body.classList.contains('warp-hover')?h.ready:h.armed;
  const hudScan=document.getElementById('hudScan'); if(hudScan) hudScan.textContent='0.73C';
  ['killsLabel','bayLabel','bomberLabel','recommendLabel','manualLabel','maintenanceLabel','ammoLabel','deviceLabel','bayCdLabel','radarG','radarAzimuth','radarCruise','wCannon','wMissile','wNuke','wEnforcer'].forEach(k=>{
    document.querySelectorAll(`[data-hud="${k}"]`).forEach(el=>el.textContent=h[k]);
  });
  if(battleLog && !halley) battleLog.textContent=h.battleReady;
  const topMap={uplink:h.uplink,trajectory:currentLang==='zh'?'虚空航迹':'VOID TRACK',origin:COPY[currentLang].distEarth,target:h.target,warp:h.warp};
  Object.entries(topMap).forEach(([key,val])=>document.querySelectorAll(`[data-top="${key}"]`).forEach(el=>el.textContent=val));
  const topUplink=document.getElementById('topUplink'); if(topUplink) topUplink.textContent=h.active;
  document.getElementById('topLock').textContent=h.idle;
  document.getElementById('topTrajectory').textContent=currentLang==='zh'?'L1 · 稳定':'L1 · stable';
  document.getElementById('nukeWarning').innerHTML=`<span class="rad-symbol">☢</span>${h.fusion}`;
  weaponWarning.innerHTML=`<b>${h.enforcerWarn}</b><span>${currentLang==='zh'?'粒子脊柱待命':'charging particle spine · stand by'}</span>`;
  updateCombatModule();
}

function setCombatMode(on){
  combatHot=on;
  document.body.classList.toggle('combat-mode',on);
  combatHud.setAttribute('aria-hidden',on?'false':'true');
  if(on){
    if(combatHoldTimer)clearTimeout(combatHoldTimer);
    combatHoldTimer=setTimeout(()=>{ if(!combatHot) document.body.classList.remove('combat-mode'); }, 120);
  }
}

function updateTopTelemetry(){
  try {
    const now = new Date();
    const elapsedH = (now.getTime() - window.__launchTime) / 3600000;
    const voyageDays = currentLang==='zh' ? '2738 天' : '2738 DAYS';
    const fuel = clamp(100 - elapsedH * 0.23 - (warpIntensity - .18) * 8.5, 12, 100);
    const hull = clamp(98.8 - Math.max(0, (halley?.collisionRisk || 0)) * 10 - (warpIntensity - .18) * 3.2, 72, 100);
    const navDeg = (112 + Math.sin(now.getTime()/9000)*3.5 + (halley?.collisionRisk||0)*18).toFixed(0).padStart(3,'0');
    const rangeScan = (12.4 + Math.sin(now.getTime()/6000)*1.8 + warpIntensity*2.2).toFixed(1);
    const throttle = clamp(36 + warpIntensity*55 + Math.sin(now.getTime()/4200)*4, 0, 100).toFixed(0);
    window.__warpPower=parseFloat(throttle);
    
    const clockZone=document.getElementById('clockZone');
    if(clockZone){ clockZone.textContent=''; clockZone.hidden=true; }
    renderSoftClock(now.toLocaleTimeString(undefined, { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' }));
    
    document.getElementById('earthDistLabel').textContent = COPY[currentLang].distEarth;
    document.getElementById('earthDistance').textContent = voyageDays;

    const gLoad=(1.18+warpIntensity*.72+(halley?.collisionRisk||0)*1.05);
    const cruiseSpeed=(0.69 + warpIntensity*.18);
    window.__navDeg=navDeg; window.__gLoad=gLoad; window.__cruiseSpeed=cruiseSpeed;
    const hullReadout=document.getElementById('hullReadout'); if(hullReadout) hullReadout.textContent = `${hull.toFixed(0)}%`;
    const gLoadReadout=document.getElementById('gLoadReadout'); if(gLoadReadout) gLoadReadout.textContent = `${gLoad.toFixed(2)}G`;
    const throttleEl=document.getElementById('throttleState');
    if(throttleEl){
      throttleEl.style.setProperty('--energy',`${throttle}%`);
      const txt=throttleEl.querySelector('em');
      if(txt) txt.textContent=`${throttle}%`; else throttleEl.textContent = `${throttle}%`;
    }
    const drivePower=document.getElementById('drivePower'); if(drivePower) drivePower.textContent = `${cruiseSpeed.toFixed(2)}C`;
    const topLock=document.getElementById('topLock'); if(topLock) topLock.textContent = halley ? (halley.hover ? (currentLang==='zh'?'锁定':'LOCK') : (currentLang==='zh'?'扫描':'SCAN')) : HC('idle');
    const cd = Math.max(0, Math.ceil(weaponRemaining('enforcer')/1000));
    const hudCore=document.getElementById('hudCore'); if(hudCore) hudCore.textContent = `${fuel.toFixed(1)}%`;
    const hudCoreBar=document.getElementById('hudCoreBar'); setProgress(hudCoreBar,fuel);
    const barCore=document.getElementById('barCore'); setProgress(barCore,fuel,'height');
    const barThrust=document.getElementById('barThrust'); setProgress(barThrust,throttle,'height');
    const barCannon=document.getElementById('barCannon'); setProgress(barCannon,weaponCooldownRatio('enforcer')*100,'height');
    const barCruise=document.getElementById('barCruise'); setProgress(barCruise,clamp(68 + warpIntensity*24,10,100),'height');
    const hudScan=document.getElementById('hudScan'); if(hudScan) hudScan.textContent = `${(0.68 + warpIntensity*.22).toFixed(2)}C`;
    const hudShield=document.getElementById('hudShield'); if(hudShield) hudShield.textContent = cd ? `${cd}s` : HC('ready');
    const hudThrusters=document.getElementById('hudThrusters'); if(hudThrusters) hudThrusters.textContent = document.body.classList.contains('warp-hover') ? HC('ready') : HC('armed');
    const linkText = document.body.classList.contains('nuke-alert') ? (currentLang==='zh'?'红色':'RED') : (document.body.classList.contains('emp-effect') ? (currentLang==='zh'?'黄色':'YELLOW') : (currentLang==='zh'?'绿色':'GREEN'));
    const linkEl=document.getElementById('topUplink'); if(linkEl) linkEl.textContent=linkText;
    if(enforcerChargeUntil > Date.now()) logBattle(`${HC('logEnforcerCharge')}${((enforcerChargeUntil-Date.now())/1000).toFixed(2)}s`);
    else if(nukeCountdownUntil > Date.now()) logBattle(`${HC('logNuke')}${((nukeCountdownUntil-Date.now())/1000).toFixed(2)}s`);
    else if(enforcerCooldownUntil > Date.now()) logBattle(`${HC('logCooldown')}${Math.ceil((enforcerCooldownUntil-Date.now())/1000)}s`);
  } catch(e){}
}

function sizeRadar(){
  radarDeck.resize();
}
function angleDelta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function getCannonFx(){
  if(!mainCannonFx) return null;
  const now=Date.now();
  if(mainCannonFx.fireAt){
    const t=(now-mainCannonFx.fireAt)/2400;
    if(t>1.05){mainCannonFx=null;return null;}
    return {...mainCannonFx,mode:'fire',t:clamp(t,0,1)};
  }
  return {...mainCannonFx,mode:'charge',t:clamp((now-mainCannonFx.chargeStart)/4500,0,1)};
}
function drawRadar(){
  if(!combatHot){document.body.classList.remove('radar-sweeping');return;}
  const w=radarCanvas.width, h=radarCanvas.height;
  if(!w||!h) return;
  const cx=w/2, cy=h/2, min=Math.min(w,h);
  rctx.clearRect(0,0,w,h); rctx.save(); rctx.translate(cx,cy);
  const now=performance.now();
  const navDeg=window.__navDeg || '128';
  const contacts=[];
  if(halley && !halley.destroyed) contacts.push({id:'comet',kind:'comet',x:halley.curX,y:halley.curY,size:halley.isGiant?5.5:4});
  escorts.forEach((e,i)=>contacts.push({id:`escort-${i}`,kind:'ally',x:e.x,y:e.y,size:e.type==='b2'?4.5:3.2}));
  weapons.forEach((w,i)=>{
    if(w.type==='missile') contacts.push({id:`missile-${i}`,kind:'missile',x:w.x,y:w.y,size:3});
    if(w.type==='phalanx') contacts.push({id:`round-${i}`,kind:'missile',x:w.x,y:w.y,size:2.6});
    if(w.type==='nuke') contacts.push({id:`nuke-${i}`,kind:'nuke',x:w.x,y:w.y,size:4.2});
  });
  if(halley) contacts.push({id:'unknown-1',kind:'ufo',x:innerWidth*.82+Math.sin(radarState.phase)*80,y:innerHeight*.28+Math.cos(radarState.phase*.7)*40,size:3});
  const radarScanning=contacts.length>0;
  if(radarScanning){
    const lastTurn=Math.floor(radarState.phase/(Math.PI*2));
    radarState.phase += .018;
    if(Math.floor(radarState.phase/(Math.PI*2))>lastTurn) {
      radarState.glowUntil=now+980;
    }
    const sweepPct=clamp(50+Math.cos(radarState.phase)*50,0,100);
    const sweepAlpha=clamp(-Math.sin(radarState.phase)*1.65,0,1);
    document.body.classList.add('radar-sweeping');
    document.body.style.setProperty('--hud-sweep-x',`${sweepPct.toFixed(2)}%`);
    document.body.style.setProperty('--hud-sweep-alpha',`${(sweepAlpha*.96).toFixed(3)}`);
    // U28 follow-up (2026-07-14): --oracle-sweep-x/--oracle-sweep-alpha
    // writes removed along with .hud-scan-line (src/styles.css) — that was
    // a full-viewport duplicate of the .hud-panels::before sweep these two
    // --hud-sweep-* vars still drive, and it was the actual source of the
    // "floating elements over Combat View" real-device report.
  }else{
    document.body.classList.remove('radar-sweeping');
  }
  const sweepA=radarState.phase;
  // U9 (2026-07-11): "左侧雷达换全息扫描盘" — the brass pocket-watch dial
  // (gears/case/hour numerals/date windows/PATEK PHILIPPE branding, ~160
  // lines) is replaced with a borderless holographic scan disc (station
  // screenshot reference): an elliptically-squashed perspective disc
  // (concentric rings + sweep wedge + rim points + amber primary-target
  // flame/pin/beam), all additive-blended, no hard rim/case anywhere.
  // Scope note: the player-ship silhouette + cannon fx + the three analog
  // gauges (IAS/CORE/ATT) further below in this same function are a
  // separate feature (not the "机械齿轮" the screenshot complained about)
  // and are intentionally left untouched — they now float over the new
  // disc instead of the old brass case. `radarR` is kept as the shared
  // variable name the contact-blip loop below already reads (its value +
  // the loop's y-coordinate are the only two edits needed there to match
  // the new ellipse — see the `*ELLIPSE` added at that loop).
  const ELLIPSE=.42, radarR=min*.46;
  // U13b (2026-07-11): radar moved into a small dock under Combat View —
  // at that size the degree/km readout and "SILENT WATCH" text would be
  // illegible clutter, so skip text (keep disc/sweep/blips/flame, which
  // still read fine as color+motion small) below this threshold, same
  // "skip rather than turn to mush" pattern combatHmdV3.js already uses.
  const compact=min<220;
  rctx.save();
  rctx.scale(1,ELLIPSE);
  const body=rctx.createRadialGradient(0,0,radarR*.1,0,0,radarR);
  body.addColorStop(0,'rgba(80,220,200,.10)');
  body.addColorStop(.7,'rgba(60,200,190,.05)');
  body.addColorStop(1,'rgba(60,200,190,0)');
  rctx.fillStyle=body;rctx.beginPath();rctx.arc(0,0,radarR,0,Math.PI*2);rctx.fill();
  rctx.strokeStyle='rgba(120,230,215,.22)';rctx.lineWidth=1;
  for(let i=1;i<=4;i++){rctx.beginPath();rctx.arc(0,0,radarR*i/4,0,Math.PI*2);rctx.stroke();}
  if(radarScanning){
    rctx.save();rctx.globalCompositeOperation='lighter';
    const wedge=rctx.createRadialGradient(0,0,0,0,0,radarR);
    wedge.addColorStop(0,'rgba(140,255,230,.30)');wedge.addColorStop(1,'rgba(140,255,230,0)');
    rctx.fillStyle=wedge;
    rctx.beginPath();rctx.moveTo(0,0);rctx.arc(0,0,radarR,sweepA-.5,sweepA+.02);rctx.closePath();rctx.fill();
    rctx.restore();
  }
  rctx.fillStyle='rgba(232,250,255,.7)';
  for(let i=0;i<14;i++){
    const a=i*(Math.PI*2/14)+Math.sin(i*3.1)*.12;
    const r=radarR*(.72+((i*53)%17)/60);
    rctx.globalAlpha=.35+.5*((i*29)%10)/10;
    rctx.beginPath();rctx.arc(Math.cos(a)*r,Math.sin(a)*r,1.1,0,Math.PI*2);rctx.fill();
  }
  rctx.globalAlpha=1;
  rctx.restore();   // undo the ELLIPSE squash before drawing anything non-elliptical

  if(halley&&!halley.destroyed){
    const dx=(halley.curX-innerWidth/2)/innerWidth, dy=(halley.curY-innerHeight/2)/innerHeight;
    const tAng=Math.atan2(dy,dx), tDist=clamp(Math.hypot(dx,dy)*1.8,.08,.92);
    const bx=Math.cos(tAng)*radarR*tDist, by=Math.sin(tAng)*radarR*tDist*ELLIPSE;
    rctx.save();rctx.globalCompositeOperation='lighter';
    const flame=rctx.createRadialGradient(bx,by,0,bx,by,min*.05);
    flame.addColorStop(0,'rgba(255,205,128,.9)');flame.addColorStop(1,'rgba(255,140,60,0)');
    rctx.fillStyle=flame;rctx.beginPath();rctx.arc(bx,by,min*.05,0,Math.PI*2);rctx.fill();
    const beam=rctx.createLinearGradient(bx,by,bx,radarR*ELLIPSE*1.3);
    beam.addColorStop(0,'rgba(154,229,255,.5)');beam.addColorStop(1,'rgba(154,229,255,0)');
    rctx.strokeStyle=beam;rctx.lineWidth=1.2;
    rctx.beginPath();rctx.moveTo(bx,by);rctx.lineTo(bx,radarR*ELLIPSE*1.3);rctx.stroke();
    rctx.restore();
    rctx.strokeStyle='rgba(255,255,255,.85)';rctx.lineWidth=1;
    rctx.beginPath();rctx.moveTo(bx,by-min*.045);rctx.lineTo(bx,by-min*.018);rctx.stroke();
  }

  const navDegNum=Math.round(parseFloat(navDeg)||128);
  const primaryKm=halley&&!halley.destroyed?(Math.hypot(halley.curX-innerWidth/2,halley.curY-innerHeight/2)/Math.min(innerWidth,innerHeight)*9).toFixed(1):'--';
  if(!compact){
    rctx.save();
    rctx.textAlign='center';rctx.textBaseline='middle';
    rctx.font=`${Math.max(7,min*.024)}px 'JetBrains Mono',monospace`;
    rctx.fillStyle='rgba(200,245,235,.72)';
    rctx.fillText(`${navDegNum}度`,-radarR*.26,radarR*ELLIPSE+16);
    rctx.fillStyle='rgba(200,245,235,.55)';
    rctx.fillText(`${primaryKm}km`,radarR*.30,radarR*ELLIPSE+16);
    rctx.restore();
  }

  if(!radarScanning && !compact){
    rctx.save();
    rctx.fillStyle='rgba(120,230,215,.5)';
    rctx.font=`${Math.max(4.2,min*.016)}px 'JetBrains Mono',monospace`;
    rctx.textAlign='center';rctx.textBaseline='middle';
    rctx.fillText(currentLang==='zh'?'静默守望':'SILENT WATCH',0,0);
    rctx.restore();
  }

  rctx.save();
  const navRad=((parseFloat(navDeg)||128)-90)*Math.PI/180;
  const shipRot=navRad*.08;
  const cannonFx=getCannonFx();
  rctx.rotate(shipRot);
  if(cannonFx?.mode==='fire') rctx.translate(0,min*.034*(1-cannonFx.t));
  rctx.scale(.38,.38);
  const hullGrad=rctx.createLinearGradient(0,-min*.26,0,min*.22);
  hullGrad.addColorStop(0,'rgba(196,207,218,.46)');
  hullGrad.addColorStop(.5,'rgba(82,96,110,.32)');
  hullGrad.addColorStop(1,'rgba(20,30,42,.48)');
  rctx.strokeStyle='rgba(218,232,246,.64)';rctx.fillStyle=hullGrad;rctx.lineWidth=1;
  rctx.beginPath();
  rctx.moveTo(0,-min*.265);
  rctx.lineTo(min*.255,min*.18);
  rctx.lineTo(min*.07,min*.226);
  rctx.lineTo(0,min*.19);
  rctx.lineTo(-min*.07,min*.226);
  rctx.lineTo(-min*.255,min*.18);
  rctx.closePath();rctx.fill();rctx.stroke();
  rctx.strokeStyle='rgba(218,232,246,.26)';rctx.lineWidth=.8;
  rctx.beginPath();rctx.moveTo(0,-min*.25);rctx.lineTo(0,min*.18);rctx.stroke();
  for(let i=1;i<=6;i++){
    const y=lerp(-min*.145,min*.145,i/7), half=lerp(min*.032,min*.205,i/7);
    rctx.beginPath();rctx.moveTo(-half,y);rctx.lineTo(half,y);rctx.stroke();
  }
  rctx.strokeStyle='rgba(154,229,255,.24)';
  for(let i=-4;i<=4;i++){
    rctx.beginPath();rctx.moveTo(i*min*.015,-min*.09);rctx.lineTo(i*min*.043,min*.145);rctx.stroke();
  }
  rctx.fillStyle='rgba(91,106,120,.52)';rctx.strokeStyle='rgba(214,226,244,.35)';
  rctx.beginPath();
  rctx.moveTo(-min*.052,-min*.015);rctx.lineTo(min*.052,-min*.015);rctx.lineTo(min*.073,min*.072);rctx.lineTo(min*.032,min*.112);rctx.lineTo(-min*.032,min*.112);rctx.lineTo(-min*.073,min*.072);
  rctx.closePath();rctx.fill();rctx.stroke();
  rctx.fillStyle='rgba(93,255,157,.92)';
  [-.036,0,.036].forEach(x=>{rctx.beginPath();rctx.arc(x*min,min*.201,1.6,0,Math.PI*2);rctx.fill();});
  if(cannonFx){
    const open=cannonFx.mode==='charge'?easeOut(cannonFx.t):1;
    const tipY=-min*.265, barrelY=-min*(.285+.055*open);
    rctx.save();
    rctx.globalCompositeOperation='lighter';
    rctx.strokeStyle=`rgba(154,229,255,${.18+.52*open})`;rctx.lineWidth=1.2;
    rctx.beginPath();
    rctx.moveTo(-min*.012*open,tipY);rctx.lineTo(-min*(.055+.02*open),-min*.205);
    rctx.moveTo(min*.012*open,tipY);rctx.lineTo(min*(.055+.02*open),-min*.205);
    rctx.stroke();
    rctx.strokeStyle=`rgba(255,240,240,${.24+.52*open})`;rctx.lineWidth=1.5;
    rctx.beginPath();rctx.moveTo(0,-min*.21);rctx.lineTo(0,barrelY);rctx.stroke();
    rctx.fillStyle=`rgba(255,245,245,${.2+.6*open})`;rctx.beginPath();rctx.arc(0,barrelY,2.2+2.4*open,0,Math.PI*2);rctx.fill();
    if(cannonFx.mode==='fire'){
      const targetX=halley&&!halley.destroyed?halley.curX:cannonFx.tx;
      const targetY=halley&&!halley.destroyed?halley.curY:cannonFx.ty;
      const dx=(targetX-innerWidth/2)/innerWidth, dy=(targetY-innerHeight/2)/innerHeight;
      const ang=Math.atan2(dy,dx), dist=clamp(Math.hypot(dx,dy)*1.8,.12,.92), rr=min*.94*dist;
      const rawX=Math.cos(ang)*rr, rawY=Math.sin(ang)*rr;
      const inv=-shipRot, bx=rawX*Math.cos(inv)-rawY*Math.sin(inv), by=rawX*Math.sin(inv)+rawY*Math.cos(inv);
      const pulse=1-cannonFx.t;
      const beam=rctx.createLinearGradient(0,barrelY,bx,by);
      beam.addColorStop(0,`rgba(255,255,255,${.92*pulse})`);
      beam.addColorStop(.34,`rgba(255,42,54,${.78*pulse})`);
      beam.addColorStop(.72,`rgba(255,0,36,${.70*pulse})`);
      beam.addColorStop(1,`rgba(255,255,255,${.72*pulse})`);
      rctx.strokeStyle=beam;rctx.lineCap='round';
      [8,4,1.2].forEach((lw,i)=>{rctx.globalAlpha=i===0 ? .22:i===1 ? .6:1;rctx.lineWidth=lw*pulse;rctx.beginPath();rctx.moveTo(0,barrelY);rctx.lineTo(bx,by);rctx.stroke();});
      rctx.globalAlpha=.9*pulse;rctx.fillStyle='rgba(255,220,210,.7)';rctx.beginPath();rctx.arc(bx,by,min*.035*(1+cannonFx.t),0,Math.PI*2);rctx.fill();
    }
    rctx.restore();
  }
  rctx.restore();
  // U13b (2026-07-11): the three analog gauges (IAS/CORE/ATT) that used to
  // float here — deleted per station reference ("delete the three small
  // dials entirely"); the ship silhouette + cannon fx directly above are
  // untouched, they were never the complaint. `drawGauge` and its 3 calls
  // fully removed (this was their only caller).
  contacts.forEach(c=>{
    const dx=(c.x-innerWidth/2)/innerWidth, dy=(c.y-innerHeight/2)/innerHeight;
    const ang=Math.atan2(dy,dx), dist=clamp(Math.hypot(dx,dy)*1.8,.08,.92);
    if(Math.abs(angleDelta(sweepA,ang))<.12) radarState.contacts.set(c.id,{...c,ang,dist,seen:performance.now()+2200});
  });
  for(const [id,c] of [...radarState.contacts.entries()]){
    if(c.seen<performance.now()){radarState.contacts.delete(id);continue;}
    if(c.kind==='comet') continue;   // U9: comet gets its own amber flame+pin+beam marker above, not a second blip
    const fade=clamp((c.seen-performance.now())/2200,0,1);
    const rr=radarR*c.dist, x=Math.cos(c.ang)*rr, y=Math.sin(c.ang)*rr*ELLIPSE;   // U9: squashed to match the elliptical disc
    const palette={
      comet:['rgba(255,45,62,', '#ff2d3e'],
      ally:['rgba(93,255,157,', '#5dff9d'],
      missile:['rgba(255,255,255,', '#ffffff'],
      nuke:['rgba(255,212,93,', '#ffd45d'],
      ufo:['rgba(154,229,255,', '#9ae5ff']
    }[c.kind];
    const targetLume=radarScanning?clamp(1-Math.abs(angleDelta(sweepA,c.ang))/.16,0,1):0;
    const drawContactShape=(scale=1)=>{
      const s=c.size*scale;
      rctx.beginPath();
      if(c.kind==='comet'){rctx.moveTo(x,y-s*2);rctx.lineTo(x+s*2,y);rctx.lineTo(x,y+s*2);rctx.lineTo(x-s*2,y);rctx.closePath();rctx.fill();rctx.stroke();}
      else if(c.kind==='ally'){rctx.moveTo(x,y-s*2.4);rctx.lineTo(x+s*2.2,y+s*1.8);rctx.lineTo(x-s*2.2,y+s*1.8);rctx.closePath();rctx.fill();rctx.stroke();}
      else if(c.kind==='missile'){rctx.arc(x,y,s,0,Math.PI*2);rctx.fill();rctx.stroke();}
      else if(c.kind==='nuke'){rctx.font=`${s*5}px 'JetBrains Mono',monospace`;rctx.textAlign='center';rctx.textBaseline='middle';rctx.fillText('☢',x,y);}
      else{rctx.rect(x-s*1.6,y-s*1.6,s*3.2,s*3.2);rctx.fill();rctx.stroke();}
    };
    if(targetLume>0){
      rctx.save();
      rctx.globalCompositeOperation='lighter';
      rctx.shadowBlur=18*targetLume;
      rctx.shadowColor=palette[1];
      rctx.fillStyle=`${palette[0]}${.12+.36*targetLume})`;
      rctx.strokeStyle=`${palette[0]}${.16+.62*targetLume})`;
      rctx.lineWidth=1.4+targetLume*1.2;
      drawContactShape(1.8);
      rctx.restore();
    }
    rctx.save();
    rctx.shadowBlur=targetLume?9*targetLume:0;
    rctx.shadowColor=palette[1];
    rctx.fillStyle=`${palette[0]}${.25+.55*fade})`;
    rctx.strokeStyle=`${palette[0]}${.45*fade})`;
    rctx.lineWidth=1.2;
    drawContactShape(1);
    rctx.restore();
  }
  rctx.fillStyle='rgba(255,255,255,.85)'; rctx.beginPath(); rctx.arc(0,0,2.5,0,Math.PI*2); rctx.fill();
  rctx.restore();
}

function drawAttitude(now){
  const canvas=document.getElementById('attitudeCanvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d'), rect=canvas.getBoundingClientRect(), dpr=Math.min(2, devicePixelRatio || 1);
  if(canvas.width !== rect.width*dpr || canvas.height !== rect.height*dpr){ canvas.width=rect.width*dpr; canvas.height=rect.height*dpr; }
  const cx=rect.width/2, cy=rect.height/2;
  ctx.clearRect(0,0,canvas.width,canvas.height); ctx.save(); ctx.scale(dpr,dpr);
  ctx.translate(rand(-2,2)*shipRecoil, rand(-1,1)*shipRecoil);
  ctx.fillStyle='rgba(5,8,12,.62)';ctx.fillRect(0,0,rect.width,rect.height);
  const roll=Math.sin(now/2600)*0.18 + (warpIntensity-.18)*0.18;
  const pitch=Math.sin(now/3400)*10;
  ctx.save();ctx.translate(cx,cy+pitch);ctx.rotate(roll);
  ctx.fillStyle='rgba(141,180,192,.08)';ctx.fillRect(-rect.width, -rect.height, rect.width*2, rect.height);
  ctx.fillStyle='rgba(232,179,128,.06)';ctx.fillRect(-rect.width, 0, rect.width*2, rect.height);
  ctx.strokeStyle='rgba(228,232,240,.28)';ctx.lineWidth=1;
  for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(-54,i*16);ctx.lineTo(54,i*16);ctx.stroke();}
  ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(cx-54,cy);ctx.lineTo(cx-16,cy);ctx.moveTo(cx+16,cy);ctx.lineTo(cx+54,cy);ctx.moveTo(cx,cy-7);ctx.lineTo(cx,cy+7);ctx.stroke();
  ctx.strokeStyle='rgba(232,179,128,.55)';ctx.beginPath();ctx.arc(cx,cy,38,Math.PI*.08,Math.PI*.92);ctx.stroke();
  ctx.fillStyle='rgba(154,229,255,.75)';ctx.font="8px 'JetBrains Mono',monospace";
  ctx.fillText(`${currentLang==='zh'?'航向':'HDG'} ${((now/80)%360).toFixed(0).padStart(3,'0')}°`,12,16);
  ctx.fillText(`${currentLang==='zh'?'姿态':'ATT'} ${(roll*57.3).toFixed(1)}°`,12,rect.height-10);
  ctx.restore();
}

function setupFeedCanvas(canvas){
  if(!canvas) return null;
  const rect=canvas.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1);
  if(rect.width<2||rect.height<2) return null;
  if(canvas.width!==Math.floor(rect.width*dpr)||canvas.height!==Math.floor(rect.height*dpr)){
    canvas.width=Math.floor(rect.width*dpr);canvas.height=Math.floor(rect.height*dpr);
  }
  const ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);
  return {ctx,w:rect.width,h:rect.height};
}
function assetReady(img){
  return !!(img && img.complete && img.naturalWidth && img.naturalHeight);
}
function drawImageContain(ctx,img,x,y,w,h,alpha=1){
  if(!assetReady(img)) return false;
  const ratio=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const dw=img.naturalWidth*ratio, dh=img.naturalHeight*ratio;
  ctx.save();
  ctx.globalAlpha*=alpha;
  ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  ctx.restore();
  return true;
}
function drawImageCover(ctx,img,x,y,w,h,alpha=1){
  if(!assetReady(img)) return false;
  const ratio=Math.max(w/img.naturalWidth,h/img.naturalHeight);
  const dw=img.naturalWidth*ratio, dh=img.naturalHeight*ratio;
  ctx.save();
  ctx.globalAlpha*=alpha;
  ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  ctx.restore();
  return true;
}
function drawAIM120Model(ctx,len=34,stage='locked'){
  const r=len*.055;
  ctx.save();
  ctx.lineJoin='round';
  const body=ctx.createLinearGradient(-len*.5,-r,len*.5,r);
  body.addColorStop(0,'#8798a4');body.addColorStop(.18,'#d7e1e8');body.addColorStop(.53,'#eff4f6');body.addColorStop(.82,'#cbd6dc');body.addColorStop(1,'#f6f1df');
  ctx.fillStyle=body;ctx.strokeStyle='rgba(23,31,38,.72)';ctx.lineWidth=Math.max(.6,len*.012);
  ctx.beginPath();ctx.moveTo(-len*.46,-r);ctx.lineTo(len*.34,-r);ctx.quadraticCurveTo(len*.52,0,len*.34,r);ctx.lineTo(-len*.46,r);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#6f4b34';ctx.fillRect(-len*.2,-r*.98,len*.055,r*1.96);
  ctx.fillStyle='#e5d414';ctx.fillRect(len*.18,-r*.98,len*.048,r*1.96);
  ctx.fillStyle='rgba(35,44,52,.9)';
  ctx.beginPath();ctx.moveTo(-len*.43,-r);ctx.lineTo(-len*.58,-r*2.4);ctx.lineTo(-len*.55,0);ctx.lineTo(-len*.58,r*2.4);ctx.lineTo(-len*.43,r);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-len*.23,-r);ctx.lineTo(-len*.14,-r*3.1);ctx.lineTo(-len*.05,-r);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-len*.23,r);ctx.lineTo(-len*.14,r*3.1);ctx.lineTo(-len*.05,r);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(len*.13,-r);ctx.lineTo(len*.22,-r*3);ctx.lineTo(len*.31,-r);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(len*.13,r);ctx.lineTo(len*.22,r*3);ctx.lineTo(len*.31,r);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(30,38,44,.65)';ctx.font=`${Math.max(4,len*.08)}px 'JetBrains Mono',monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
  if(len>24) ctx.fillText('AIM-120',len*.02,-r*.18);
  if(stage!=='drop'){
    const flame=ctx.createRadialGradient(-len*.55,0,0,-len*.7,0,len*.28);
    flame.addColorStop(0,'rgba(255,255,255,.82)');flame.addColorStop(.26,'rgba(255,210,110,.58)');flame.addColorStop(1,'rgba(255,90,45,0)');
    ctx.globalCompositeOperation='lighter';ctx.fillStyle=flame;ctx.beginPath();ctx.ellipse(-len*.66,0,len*.28,r*3.2,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawFeedCraft(ctx,x,y,type,size=5,angle=-Math.PI/2,color='rgba(93,255,157,.85)'){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  if(type==='f47'){
    ctx.scale(size/26,size/26);
    drawF47(ctx);
    ctx.restore();
    return;
  }
  ctx.fillStyle=color;ctx.strokeStyle='rgba(226,242,255,.65)';ctx.lineWidth=.7;
  ctx.beginPath();
  if(type==='b2'){
    ctx.moveTo(0,-size*.45);ctx.lineTo(size*1.8,size*.35);ctx.lineTo(size*.55,size*.5);ctx.lineTo(size*.18,size*.95);ctx.lineTo(0,size*.55);ctx.lineTo(-size*.18,size*.95);ctx.lineTo(-size*.55,size*.5);ctx.lineTo(-size*1.8,size*.35);
  }else if(type==='b1b'){
    ctx.moveTo(0,-size*1.3);ctx.lineTo(size*.38,-size*.15);ctx.lineTo(size*1.75,size*.18);ctx.lineTo(size*.55,size*.55);ctx.lineTo(size*.25,size*1.15);ctx.lineTo(0,size*.55);ctx.lineTo(-size*.25,size*1.15);ctx.lineTo(-size*.55,size*.55);ctx.lineTo(-size*1.75,size*.18);ctx.lineTo(-size*.38,-size*.15);
  }else if(type==='f47'){
    ctx.moveTo(0,-size*1.55);ctx.lineTo(size*.58,-size*.35);ctx.lineTo(size*1.65,size*.28);ctx.lineTo(size*.54,size*.55);ctx.lineTo(size*.22,size*1.18);ctx.lineTo(0,size*.72);ctx.lineTo(-size*.22,size*1.18);ctx.lineTo(-size*.54,size*.55);ctx.lineTo(-size*1.65,size*.28);ctx.lineTo(-size*.58,-size*.35);
  }else{
    ctx.moveTo(0,-size*1.35);ctx.lineTo(size*.58,-size*.08);ctx.lineTo(size*1.35,size*.38);ctx.lineTo(size*.42,size*.55);ctx.lineTo(size*.22,size*1.18);ctx.lineTo(0,size*.7);ctx.lineTo(-size*.22,size*1.18);ctx.lineTo(-size*.42,size*.55);ctx.lineTo(-size*1.35,size*.38);ctx.lineTo(-size*.58,-size*.08);
  }
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(154,229,255,.8)';ctx.fillRect(-size*.08,-size*.45,size*.16,size*.28);
  ctx.restore();
}
function drawFeedContact(ctx,x,y,c){
  ctx.save();ctx.globalCompositeOperation='lighter';
  if(c.kind==='comet'){
    const r=c.big?5:3.6;
    const g=ctx.createRadialGradient(x,y,0,x,y,r*4);
    g.addColorStop(0,'rgba(255,240,202,.95)');g.addColorStop(.34,'rgba(232,128,64,.58)');g.addColorStop(1,'rgba(232,128,64,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*4,0,Math.PI*2);ctx.fill();
    const tvx=-(c.vx||1), tvy=-(c.vy||0);
    const tl=Math.hypot(tvx,tvy)||1;
    ctx.strokeStyle='rgba(232,179,128,.62)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+tvx/tl*24,y+tvy/tl*24+rand(-2,2));ctx.stroke();
    ctx.fillStyle='rgba(255,70,83,.95)';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }else if(c.kind==='missile'){
    ctx.translate(x,y);ctx.rotate(-.28);
    if(c.nuke){
      ctx.strokeStyle='rgba(255,212,93,.9)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-9,4);ctx.lineTo(7,-3);ctx.stroke();
      ctx.fillStyle='rgba(255,212,93,.95)';ctx.beginPath();ctx.arc(7,-3,2.2,0,Math.PI*2);ctx.fill();
      ctx.font="8px 'JetBrains Mono',monospace";ctx.fillText('☢',11,-5);
    }else{
      drawAIM120Model(ctx,22,'locked');
    }
  }else{
    drawFeedCraft(ctx,x,y,c.type,c.type==='b2'?4.4:3.8,c.angle,c.returning?'rgba(154,229,255,.72)':'rgba(93,255,157,.82)');
    ctx.strokeStyle='rgba(154,229,255,.28)';ctx.beginPath();ctx.moveTo(x,y+5);ctx.lineTo(x,y+12);ctx.stroke();
  }
  ctx.restore();
}
function drawFeedCannon(ctx,w,h,mode,fx){
  if(!fx) return;
  const open=fx.mode==='charge'?easeOut(fx.t):1;
  ctx.save();ctx.globalCompositeOperation='lighter';
  if(mode==='side'){
    const recoil=fx.mode==='fire'?(1-fx.t)*w*.025:0;
    const sx=w*.095+recoil, sy=h*.55, barrel=w*(.055+.028*open);
    ctx.strokeStyle=`rgba(154,229,255,${.18+.42*open})`;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(sx+barrel,sy-6*open);ctx.lineTo(sx+barrel+w*.04,sy-14);ctx.moveTo(sx+barrel,sy+6*open);ctx.lineTo(sx+barrel+w*.04,sy+14);ctx.stroke();
    ctx.strokeStyle=`rgba(255,245,245,${.30+.50*open})`;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(sx+barrel,sy);ctx.lineTo(sx-w*.035,sy);ctx.stroke();
    if(fx.mode==='fire'){
      const tx=clamp(w*(.1+((halley&&!halley.destroyed?halley.curX:fx.tx)/innerWidth)*.82),6,w-6);
      const ty=clamp(h*(.2+((halley&&!halley.destroyed?halley.curY:fx.ty)/innerHeight)*.58),8,h-6);
      const pulse=1-fx.t;
      const beam=ctx.createLinearGradient(sx-w*.035,sy,tx,ty);
      beam.addColorStop(0,`rgba(255,255,255,${.9*pulse})`);beam.addColorStop(.34,`rgba(255,52,66,${.72*pulse})`);beam.addColorStop(.68,`rgba(180,0,36,${.66*pulse})`);beam.addColorStop(1,`rgba(255,255,255,${.70*pulse})`);
      ctx.strokeStyle=beam;ctx.lineCap='round';
      [9,4,1.2].forEach((lw,i)=>{ctx.globalAlpha=i===0 ? .18:i===1 ? .55:1;ctx.lineWidth=lw*pulse;ctx.beginPath();ctx.moveTo(sx-w*.035,sy);ctx.lineTo(tx,ty);ctx.stroke();});
      ctx.globalAlpha=.85*pulse;ctx.fillStyle='rgba(255,220,160,.55)';ctx.beginPath();ctx.arc(tx,ty,10+18*fx.t,0,Math.PI*2);ctx.fill();
    }
  }else if(fx.mode==='fire'){
    const pulse=1-fx.t;
    ctx.strokeStyle=`rgba(120,237,255,${.45*pulse})`;ctx.lineWidth=1;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(w*.5,h*.72,18+i*13+fx.t*26,0,Math.PI*2);ctx.stroke();}
    const g=ctx.createRadialGradient(w*.5,h*.72,0,w*.5,h*.72,w*.45);
    g.addColorStop(0,`rgba(255,255,255,${.22*pulse})`);g.addColorStop(.4,`rgba(120,237,255,${.12*pulse})`);g.addColorStop(1,'rgba(120,237,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(w*.5,h*.72,w*.45,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawCapitalFeed(feed,now,contacts,cannonFx){
  if(!feed) return;
  const {ctx,w,h}=feed, u=Math.min(w,h);
  ctx.save();
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(3,6,10,.56)';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(154,229,255,.06)';ctx.lineWidth=1;
  for(let x=0;x<w;x+=Math.max(24,w/20)){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=Math.max(12,h/10)){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  const title=currentLang==='zh'?'实况战舰透视 · 12点方向':'LIVE CAPITAL VIEW · 12 O CLOCK';
  ctx.fillStyle='rgba(220,232,245,.74)';ctx.font=`${Math.max(8,u*.045)}px 'JetBrains Mono',monospace`;ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText(title,10,8);
  const power=(0.69+warpIntensity*.22).toFixed(2);
  ctx.textAlign='right';ctx.fillStyle=document.body.classList.contains('warp-hover')?'rgba(93,255,157,.92)':'rgba(154,229,255,.82)';
  ctx.fillText(`${currentLang==='zh'?'动力':'DRIVE'} ${power}C`,w-10,8);
  const energy=clamp(window.__warpPower||41,0,100);
  const eX=w-18,eY=34,eH=h-56,eW=7;
  ctx.strokeStyle='rgba(141,180,192,.26)';ctx.strokeRect(eX,eY,eW,eH);
  const eg=ctx.createLinearGradient(0,eY+eH,0,eY);
  eg.addColorStop(0,'rgba(93,255,157,.35)');eg.addColorStop(.55,'rgba(154,229,255,.72)');eg.addColorStop(1,'rgba(120,104,255,.7)');
  ctx.fillStyle=eg;ctx.fillRect(eX+1,eY+eH-(eH-2)*energy/100,eW-2,(eH-2)*energy/100);
  ctx.save();ctx.translate(eX-4,eY+eH/2);ctx.rotate(-Math.PI/2);ctx.fillStyle='rgba(154,229,255,.58)';ctx.textAlign='center';ctx.font=`${Math.max(6,u*.026)}px 'JetBrains Mono',monospace`;ctx.fillText(`${currentLang==='zh'?'跃迁功率':'WARP'} ${Math.round(energy)}%`,0,0);ctx.restore();
  const recoil=cannonFx?.mode==='fire' ? (1-cannonFx.t)*u*.03 : 0;
  ctx.save();ctx.translate(0,recoil);
  const hull=ctx.createLinearGradient(0,h*.08,0,h*.82);
  hull.addColorStop(0,'rgba(220,229,238,.62)');
  hull.addColorStop(.42,'rgba(92,104,118,.5)');
  hull.addColorStop(1,'rgba(20,28,38,.72)');
  ctx.fillStyle=hull;ctx.strokeStyle='rgba(229,239,249,.76)';ctx.lineWidth=1.25;
  const capitalHullPath=()=>{
    ctx.beginPath();
    ctx.moveTo(w*.50,h*.08);
    ctx.lineTo(w*.08,h*.70);
    ctx.lineTo(w*.22,h*.86);
    ctx.lineTo(w*.50,h*.78);
    ctx.lineTo(w*.78,h*.86);
    ctx.lineTo(w*.92,h*.70);
    ctx.closePath();
  };
  capitalHullPath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(154,229,255,.24)';ctx.lineWidth=.9;
  ctx.beginPath();ctx.moveTo(w*.5,h*.09);ctx.lineTo(w*.5,h*.78);ctx.stroke();
  for(let i=1;i<=10;i++){
    const t=i/11,y=lerp(h*.19,h*.73,t),half=lerp(w*.055,w*.37,t);
    ctx.beginPath();ctx.moveTo(w*.5-half,y);ctx.lineTo(w*.5+half,y);ctx.stroke();
  }
  for(let i=-6;i<=6;i++){
    const side=i/6, x0=w*.5+side*w*.03, x1=w*.5+side*w*.35;
    ctx.beginPath();ctx.moveTo(x0,h*.16);ctx.lineTo(x1,h*.68);ctx.stroke();
  }
  ctx.fillStyle='rgba(90,102,116,.58)';ctx.strokeStyle='rgba(226,238,248,.58)';
  const deck=(pts)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();};
  deck([[w*.32,h*.50],[w*.68,h*.50],[w*.72,h*.62],[w*.62,h*.70],[w*.38,h*.70],[w*.28,h*.62]]);
  deck([[w*.37,h*.42],[w*.63,h*.42],[w*.66,h*.50],[w*.34,h*.50]]);
  deck([[w*.41,h*.34],[w*.59,h*.34],[w*.62,h*.42],[w*.38,h*.42]]);
  deck([[w*.44,h*.24],[w*.56,h*.24],[w*.58,h*.34],[w*.42,h*.34]]);
  ctx.fillStyle='rgba(112,126,140,.7)';
  deck([[w*.39,h*.18],[w*.61,h*.18],[w*.64,h*.24],[w*.36,h*.24]]);
  deck([[w*.45,h*.12],[w*.55,h*.12],[w*.57,h*.18],[w*.43,h*.18]]);
  ctx.fillStyle='rgba(152,164,176,.62)';ctx.strokeStyle='rgba(226,238,248,.5)';
  deck([[w*.42,h*.20],[w*.58,h*.20],[w*.60,h*.255],[w*.40,h*.255]]);
  deck([[w*.445,h*.145],[w*.555,h*.145],[w*.57,h*.20],[w*.43,h*.20]]);
  deck([[w*.47,h*.095],[w*.53,h*.095],[w*.548,h*.145],[w*.452,h*.145]]);
  ctx.fillStyle='rgba(7,12,18,.62)';
  ctx.fillRect(w*.365,h*.565,w*.27,h*.025);
  ctx.fillRect(w*.315,h*.628,w*.37,h*.022);
  ctx.strokeStyle='rgba(7,12,18,.58)';ctx.lineWidth=1;
  for(let i=0;i<34;i++){
    const t=i/33, y=lerp(h*.36,h*.76,t), half=lerp(w*.09,w*.38,t);
    ctx.beginPath();ctx.moveTo(w*.5-half,y);ctx.lineTo(w*.5-half+w*.045,y-2);ctx.moveTo(w*.5+half,y);ctx.lineTo(w*.5+half-w*.045,y-2);ctx.stroke();
  }
  ctx.strokeStyle='rgba(228,238,248,.18)';ctx.lineWidth=.65;
  for(let i=0;i<9;i++){
    const y=lerp(h*.29,h*.68,i/8);
    ctx.beginPath();ctx.moveTo(w*.24,y);ctx.lineTo(w*.76,y+Math.sin(i)*2);ctx.stroke();
  }
  ctx.save();capitalHullPath();ctx.clip();
  ctx.strokeStyle='rgba(229,239,249,.42)';ctx.lineWidth=.75;
  for(let y=h*.28;y<h*.72;y+=h*.055){
    for(let x=w*.18;x<w*.82;x+=w*.07){
      if(Math.abs(x-w*.5)<w*.05) continue;
      ctx.strokeRect(x,y,w*.026,h*.018);
    }
  }
  ctx.strokeStyle='rgba(232,179,128,.5)';
  for(let i=0;i<18;i++){
    const t=i/17,y=lerp(h*.30,h*.68,t),left=lerp(w*.36,w*.24,t),right=lerp(w*.64,w*.76,t);
    [left,right].forEach((x,side)=>{
      ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(side?5:-5),y-4);ctx.stroke();
    });
  }
  ctx.restore();
  const open=cannonFx?(cannonFx.mode==='charge'?easeOut(cannonFx.t):1):0;
  ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle=`rgba(255,245,245,${.28+.5*open})`;ctx.lineWidth=1.4+open*1.2;
  ctx.beginPath();ctx.moveTo(w*.5,h*.47);ctx.lineTo(w*.5,h*(.13-.025*open));ctx.stroke();
  ctx.fillStyle=`rgba(255,240,255,${.18+.6*open})`;ctx.beginPath();ctx.arc(w*.5,h*(.13-.025*open),2+open*4,0,Math.PI*2);ctx.fill();
  if(cannonFx?.mode==='fire'){
    const tx=clamp(w*(.08+((halley&&!halley.destroyed?halley.curX:cannonFx.tx)/innerWidth)*.84),8,w-8);
    const ty=clamp(h*(.05+((halley&&!halley.destroyed?halley.curY:cannonFx.ty)/innerHeight)*.46),8,h*.62);
    const pulse=1-cannonFx.t;
    const beam=ctx.createLinearGradient(w*.5,h*.105,tx,ty);
    beam.addColorStop(0,`rgba(255,255,255,${.92*pulse})`);
    beam.addColorStop(.34,`rgba(255,52,66,${.78*pulse})`);
    beam.addColorStop(.68,`rgba(180,0,36,${.68*pulse})`);
    beam.addColorStop(1,`rgba(154,229,255,${.8*pulse})`);
    ctx.strokeStyle=beam;ctx.lineCap='round';
    [14,7,2].forEach((lw,i)=>{ctx.globalAlpha=i===0 ? .18:i===1 ? .58:1;ctx.lineWidth=lw*pulse;ctx.beginPath();ctx.moveTo(w*.5,h*.105);ctx.lineTo(tx,ty);ctx.stroke();});
    ctx.globalAlpha=.7*pulse;ctx.fillStyle='rgba(255,218,160,.55)';ctx.beginPath();ctx.arc(tx,ty,u*.08*(1+cannonFx.t),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  const flameBoost=(document.body.classList.contains('warp-hover')?1.85:1)*(1+Math.sin(now/260)*.08); // U28 28g: 1.42→1.85
  const engines=[
    [.365,.84,u*.038], [.5,.84,u*.052], [.635,.84,u*.038],
    [.43,.74,u*.023], [.57,.74,u*.023], [.43,.93,u*.019], [.57,.93,u*.019]
  ];
  ctx.fillStyle='rgba(5,9,14,.72)';ctx.strokeStyle='rgba(218,236,255,.24)';
  ctx.beginPath();ctx.moveTo(w*.24,h*.78);ctx.lineTo(w*.76,h*.78);ctx.lineTo(w*.69,h*.94);ctx.lineTo(w*.31,h*.94);ctx.closePath();ctx.fill();ctx.stroke();
  engines.forEach(([ex,eyr,er],i)=>{
    const ey=h*eyr;
    ctx.fillStyle='rgba(7,12,18,.82)';ctx.strokeStyle='rgba(218,236,255,.5)';ctx.lineWidth=1.1;
    ctx.beginPath();ctx.arc(w*ex,ey,er,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(142,190,224,.42)';ctx.lineWidth=.7;
    for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(w*ex,ey,er*(.45+k*.22),0,Math.PI*2);ctx.stroke();}
    const g=ctx.createRadialGradient(w*ex,ey,0,w*ex,ey,er*2.7*flameBoost);
    g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.26,'rgba(184,250,255,.84)');g.addColorStop(.55,'rgba(73,198,255,.42)');g.addColorStop(1,'rgba(73,198,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(w*ex,ey+er*.8,er*1.2,er*2.1*flameBoost,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(154,229,255,${.34+.18*Math.sin(now/220+i)})`;ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(w*ex,ey,er*(1.15+.08*Math.sin(now/180+i)),0,Math.PI*2);ctx.stroke();
  });
  const bays=[
    ['f47',0,.30,.68],['f47',1,.38,.71],['f47',2,.46,.70],
    ['f47',3,.54,.70],['f47',4,.62,.71],['f47',5,.70,.68],
    ['b2',0,.42,.58],['b1b',0,.58,.58]
  ];
  const active=new Set(escorts.map(e=>`${e.type}-${e.bayIndex}`));
  ctx.save();capitalHullPath();ctx.clip();
  bays.forEach(([type,idx,px,py])=>{
    const bw=Math.min(w*.085,h*.18), x=w*px-bw/2, y=h*py-bw/2, hp=hpFor(type,idx), empty=active.has(`${type}-${idx}`);
    ctx.strokeStyle=empty?'rgba(154,229,255,.18)':(hp<55?'rgba(255,77,91,.5)':hp<88?'rgba(255,212,93,.46)':'rgba(93,255,157,.42)');
    ctx.fillStyle=empty?'rgba(154,229,255,.025)':'rgba(255,255,255,.035)';
    ctx.fillRect(x,y,bw,bw);ctx.strokeRect(x,y,bw,bw);
    ctx.fillStyle=empty?'rgba(154,229,255,.38)':'rgba(220,232,245,.76)';
    ctx.font=`${Math.max(5,u*.026)}px 'JetBrains Mono',monospace`;ctx.textAlign='left';ctx.textBaseline='bottom';
    ctx.fillText(empty?'OUT':type.toUpperCase(),x+4,y+bw-4);
    if(!empty) drawFeedCraft(ctx,x+bw*.52,y+bw*.48,type,bw*.12,-Math.PI/2,'rgba(116,130,145,.86)');
    else{
      ctx.strokeStyle='rgba(154,229,255,.22)';
      ctx.beginPath();ctx.moveTo(x+bw*.22,y+bw*.5);ctx.lineTo(x+bw*.78,y+bw*.5);ctx.stroke();
    }
  });
  ctx.restore();
  ctx.restore();
  contacts.forEach(c=>{
    let x=w*(.08+(c.x/innerWidth)*.84), y=h*(.04+(c.y/innerHeight)*.50);
    if(c.kind==='craft'&&c.returning){x=w*(.28+Math.sin(now/360+c.x*.01)*.44);y=h*(.70+Math.cos(now/410+c.y*.01)*.16);}
    drawFeedContact(ctx,clamp(x,8,w-8),clamp(y,24,h-10),c);
  });
  ctx.fillStyle='rgba(154,229,255,.64)';ctx.font=`${Math.max(7,u*.033)}px 'JetBrains Mono',monospace`;ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillText(`${currentLang==='zh'?'过载':'G'} ${(window.__gLoad||1.2).toFixed(2)}G`,10,h-10);
  ctx.textAlign='center';ctx.fillText(`${currentLang==='zh'?'机库':'BAY'} 8 · ${currentLang==='zh'?'主炮脊柱':'CANNON SPINE'}`,w*.5,h-10);
  ctx.restore();
}
function drawCapitalFeedV2(feed,now,contacts,cannonFx){
  if(!feed) return;
  const {ctx,w,h}=feed, u=Math.min(w,h);
  ctx.save();
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(3,6,10,.58)';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(154,229,255,.07)';ctx.lineWidth=1;
  for(let x=0;x<w;x+=Math.max(24,w/22)){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=Math.max(12,h/11)){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  const title=currentLang==='zh'?'实况战舰侧视 · 12点方向':'LIVE CAPITAL SIDE · 12 O CLOCK';
  ctx.fillStyle='rgba(220,232,245,.76)';ctx.font=`${Math.max(8,u*.044)}px 'JetBrains Mono',monospace`;ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText(title,10,8);
  const power=(0.69+warpIntensity*.22).toFixed(2);
  ctx.textAlign='right';ctx.fillStyle=document.body.classList.contains('warp-hover')?'rgba(93,255,157,.94)':'rgba(154,229,255,.84)';
  ctx.fillText(`${currentLang==='zh'?'动力':'DRIVE'} ${power}C`,w-10,8);
  const energy=clamp(window.__warpPower||41,0,100), eX=w-18, eY=34, eH=h-56, eW=7;
  ctx.strokeStyle='rgba(141,180,192,.28)';ctx.strokeRect(eX,eY,eW,eH);
  const eg=ctx.createLinearGradient(0,eY+eH,0,eY);
  eg.addColorStop(0,'rgba(93,255,157,.38)');eg.addColorStop(.55,'rgba(154,229,255,.74)');eg.addColorStop(1,'rgba(120,104,255,.72)');
  ctx.fillStyle=eg;ctx.fillRect(eX+1,eY+eH-(eH-2)*energy/100,eW-2,(eH-2)*energy/100);
  ctx.save();ctx.translate(eX-4,eY+eH/2);ctx.rotate(-Math.PI/2);ctx.fillStyle='rgba(154,229,255,.58)';ctx.textAlign='center';ctx.font=`${Math.max(6,u*.026)}px 'JetBrains Mono',monospace`;ctx.fillText(`${currentLang==='zh'?'跃迁功率':'WARP'} ${Math.round(energy)}%`,0,0);ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=.92;
  drawImageContain(ctx,HUD_IMAGES.starshipSide,w*.035,h*.24,w*.58,h*.55,1);
  ctx.globalAlpha=.74;
  drawImageContain(ctx,HUD_IMAGES.starshipBack,w*.53,h*.13,w*.39,h*.70,1);
  ctx.globalCompositeOperation='screen';
  ctx.globalAlpha=.22+.10*Math.sin(now/360);
  drawF47Vector(ctx,w*.43,h*.66,.18,-Math.PI/2,'rgba(154,229,255,.44)');
  ctx.restore();

  if(cannonFx){
    const open=cannonFx.mode==='charge'?easeOut(cannonFx.t):1;
    const sx=w*.075, sy=h*.57;
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=`rgba(255,255,255,${.22+.46*open})`;ctx.lineWidth=1+open*1.3;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+w*.05*open,sy-h*.035*open);ctx.moveTo(sx,sy);ctx.lineTo(sx+w*.05*open,sy+h*.035*open);ctx.stroke();
    if(cannonFx.mode==='fire'){
      const tx=clamp(w*(.08+((halley&&!halley.destroyed?halley.curX:cannonFx.tx)/innerWidth)*.84),8,w-8);
      const ty=clamp(h*(.06+((halley&&!halley.destroyed?halley.curY:cannonFx.ty)/innerHeight)*.50),8,h*.7);
      const pulse=1-cannonFx.t;
      const beam=ctx.createLinearGradient(sx,sy,tx,ty);
      beam.addColorStop(0,`rgba(255,255,255,${.95*pulse})`);
      beam.addColorStop(.30,`rgba(255,50,62,${.82*pulse})`);
      beam.addColorStop(.64,`rgba(190,0,34,${.78*pulse})`);
      beam.addColorStop(1,`rgba(255,255,255,${.70*pulse})`);
      ctx.strokeStyle=beam;ctx.lineCap='round';
      [18,9,2.5].forEach((lw,i)=>{ctx.globalAlpha=i===0 ? .18:i===1 ? .58:1;ctx.lineWidth=lw*pulse;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(tx,ty);ctx.stroke();});
      for(let k=0;k<5;k++){
        ctx.strokeStyle=`rgba(255,255,255,${(.18-k*.025)*pulse})`;ctx.lineWidth=(14+k*4)*pulse;ctx.setLineDash([20+k*6,18+k*4]);ctx.lineDashOffset=-now/(18+k*4);
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);
      }
      ctx.globalAlpha=.76*pulse;ctx.fillStyle='rgba(255,224,210,.58)';ctx.beginPath();ctx.arc(tx,ty,u*.09*(1+cannonFx.t),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  contacts.forEach(c=>{
    let x=w*(.08+(c.x/innerWidth)*.84), y=h*(.10+(c.y/innerHeight)*.42);
    if(c.kind==='craft'&&c.returning){x=w*(.28+Math.sin(now/360+c.x*.01)*.44);y=h*(.64+Math.cos(now/410+c.y*.01)*.16);}
    drawFeedContact(ctx,clamp(x,8,w-8),clamp(y,24,h-10),c);
  });
  ctx.fillStyle='rgba(154,229,255,.64)';ctx.font=`${Math.max(7,u*.033)}px 'JetBrains Mono',monospace`;ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillText(`${currentLang==='zh'?'过载':'G'} ${(window.__gLoad||1.2).toFixed(2)}G`,10,h-10);
  ctx.textAlign='center';ctx.fillText(`${currentLang==='zh'?'PNG 战舰实况':'PNG CAPITAL FEED'} · AIM-120`,w*.5,h-10);
  ctx.restore();
  return;

  ctx.save();
  ctx.globalAlpha=.54;
  drawImageContain(ctx,HUD_IMAGES.starshipSide,w*.03,h*.17,w*.62,h*.62,1);
  ctx.globalAlpha=.70;
  drawImageContain(ctx,HUD_IMAGES.starshipBack,w*.55,h*.18,w*.37,h*.62,1);
  ctx.globalCompositeOperation='screen';
  ctx.globalAlpha=.18;
  drawF47Vector(ctx,w*.39,h*.68,.16,-Math.PI/2,'rgba(154,229,255,.42)');
  ctx.restore();

  const recoil=cannonFx?.mode==='fire' ? (1-cannonFx.t)*u*.032 : 0;
  const flameBoost=(document.body.classList.contains('warp-hover')?1.9:1)*(1+Math.sin(now/240)*.07); // U28 28g: 1.45→1.9
  ctx.save();ctx.translate(recoil,0);
  const hullPath=()=>{
    ctx.beginPath();
    ctx.moveTo(w*.065,h*.61);
    ctx.lineTo(w*.27,h*.42);
    ctx.lineTo(w*.67,h*.32);
    ctx.lineTo(w*.88,h*.43);
    ctx.lineTo(w*.93,h*.58);
    ctx.lineTo(w*.84,h*.74);
    ctx.lineTo(w*.25,h*.78);
    ctx.closePath();
  };
  const hull=ctx.createLinearGradient(w*.06,h*.30,w*.92,h*.82);
  hull.addColorStop(0,'rgba(214,224,233,.62)');
  hull.addColorStop(.28,'rgba(110,123,138,.54)');
  hull.addColorStop(.66,'rgba(47,58,70,.68)');
  hull.addColorStop(1,'rgba(12,18,26,.84)');
  ctx.fillStyle=hull;ctx.strokeStyle='rgba(229,239,249,.78)';ctx.lineWidth=1.25;
  hullPath();ctx.fill();ctx.stroke();

  ctx.save();hullPath();ctx.clip();
  ctx.strokeStyle='rgba(154,229,255,.22)';ctx.lineWidth=.8;
  for(let i=0;i<13;i++){
    const t=i/12;
    ctx.beginPath();
    ctx.moveTo(lerp(w*.13,w*.76,t),lerp(h*.61,h*.38,t));
    ctx.lineTo(lerp(w*.25,w*.87,t),lerp(h*.74,h*.55,t));
    ctx.stroke();
  }
  for(let i=0;i<15;i++){
    const x=lerp(w*.22,w*.82,i/14);
    ctx.beginPath();ctx.moveTo(x,h*.45+Math.sin(i)*2);ctx.lineTo(x+w*.028,h*.71-Math.cos(i)*2);ctx.stroke();
  }
  ctx.strokeStyle='rgba(8,12,18,.58)';ctx.lineWidth=1;
  for(let i=0;i<36;i++){
    const x=lerp(w*.18,w*.86,i/35), y=lerp(h*.59,h*.70,(i%7)/7);
    ctx.strokeRect(x,y,w*.024,h*.014);
  }
  ctx.fillStyle='rgba(3,7,11,.6)';
  ctx.fillRect(w*.22,h*.67,w*.62,h*.027);
  ctx.fillRect(w*.31,h*.55,w*.46,h*.019);
  ctx.restore();

  const deck=(pts,fill='rgba(92,105,119,.72)')=>{
    ctx.fillStyle=fill;ctx.strokeStyle='rgba(226,238,248,.54)';ctx.lineWidth=.9;
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();
  };
  deck([[w*.46,h*.34],[w*.74,h*.29],[w*.82,h*.36],[w*.55,h*.43]],'rgba(94,106,120,.7)');
  deck([[w*.51,h*.27],[w*.69,h*.24],[w*.76,h*.30],[w*.56,h*.34]],'rgba(111,123,136,.7)');
  deck([[w*.58,h*.18],[w*.68,h*.16],[w*.72,h*.24],[w*.61,h*.27]],'rgba(86,98,112,.76)');
  deck([[w*.63,h*.09],[w*.70,h*.09],[w*.70,h*.16],[w*.62,h*.18]],'rgba(107,119,131,.78)');
  deck([[w*.60,h*.045],[w*.73,h*.045],[w*.70,h*.09],[w*.63,h*.09]],'rgba(121,132,144,.76)');
  ctx.strokeStyle='rgba(7,12,18,.52)';ctx.lineWidth=1;
  for(let i=0;i<9;i++){
    const y=h*(.34+i*.035);
    ctx.beginPath();ctx.moveTo(w*.42,y);ctx.lineTo(w*.82,y-8);ctx.stroke();
  }
  ctx.strokeStyle='rgba(232,179,128,.54)';ctx.lineWidth=.9;
  for(let i=0;i<22;i++){
    const t=i/21, x=lerp(w*.23,w*.80,t), y=h*(.50+.12*Math.sin(t*Math.PI));
    ctx.beginPath();ctx.arc(x,y,2.1,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+4,y-4);ctx.stroke();
  }

  const open=cannonFx?(cannonFx.mode==='charge'?easeOut(cannonFx.t):1):0;
  ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle=`rgba(255,245,245,${.25+.54*open})`;ctx.lineWidth=1.3+open*1.4;
  ctx.beginPath();
  ctx.moveTo(w*.067,h*.61);ctx.lineTo(w*(.115+.022*open),h*(.58-.035*open));
  ctx.moveTo(w*.067,h*.61);ctx.lineTo(w*(.115+.022*open),h*(.64+.035*open));
  ctx.stroke();
  ctx.fillStyle=`rgba(255,240,255,${.20+.62*open})`;ctx.beginPath();ctx.arc(w*(.092+.022*open),h*.61,2+open*4,0,Math.PI*2);ctx.fill();
  if(cannonFx?.mode==='fire'){
    const tx=clamp(w*(.08+((halley&&!halley.destroyed?halley.curX:cannonFx.tx)/innerWidth)*.84),8,w-8);
    const ty=clamp(h*(.05+((halley&&!halley.destroyed?halley.curY:cannonFx.ty)/innerHeight)*.46),8,h*.62);
    const pulse=1-cannonFx.t;
    const beam=ctx.createLinearGradient(w*.088,h*.61,tx,ty);
    beam.addColorStop(0,`rgba(255,255,255,${.95*pulse})`);
    beam.addColorStop(.32,`rgba(255,52,66,${.80*pulse})`);
    beam.addColorStop(.66,`rgba(180,0,36,${.74*pulse})`);
    beam.addColorStop(1,`rgba(154,229,255,${.84*pulse})`);
    ctx.strokeStyle=beam;ctx.lineCap='round';
    [16,8,2.4].forEach((lw,i)=>{ctx.globalAlpha=i===0 ? .16:i===1 ? .58:1;ctx.lineWidth=lw*pulse;ctx.beginPath();ctx.moveTo(w*.088,h*.61);ctx.lineTo(tx,ty);ctx.stroke();});
    ctx.globalAlpha=.76*pulse;ctx.fillStyle='rgba(255,218,160,.58)';ctx.beginPath();ctx.arc(tx,ty,u*.09*(1+cannonFx.t),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();

  const rear=[[w*.815,h*.405],[w*.94,h*.49],[w*.94,h*.68],[w*.82,h*.755],[w*.765,h*.685],[w*.775,h*.50]];
  deck(rear,'rgba(28,38,50,.86)');
  const engines=[
    [.855,.525,u*.041], [.915,.525,u*.041], [.885,.625,u*.052],
    [.835,.625,u*.021], [.935,.625,u*.021], [.858,.705,u*.021], [.914,.705,u*.021]
  ];
  engines.forEach(([ex,eyr,er],i)=>{
    const ey=h*eyr, px=w*ex;
    ctx.fillStyle='rgba(4,8,14,.9)';ctx.strokeStyle='rgba(218,236,255,.56)';ctx.lineWidth=1.1;
    ctx.beginPath();ctx.arc(px,ey,er,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(142,190,224,.45)';ctx.lineWidth=.7;
    for(let k=0;k<4;k++){ctx.beginPath();ctx.arc(px,ey,er*(.35+k*.18),0,Math.PI*2);ctx.stroke();}
    const g=ctx.createRadialGradient(px,ey,0,px+er*1.65,ey,er*3.2*flameBoost);
    g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.25,'rgba(187,252,255,.88)');g.addColorStop(.58,'rgba(65,190,255,.48)');g.addColorStop(1,'rgba(65,190,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(px+er*1.25,ey,er*2.25*flameBoost,er*.92,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(154,229,255,${.36+.2*Math.sin(now/210+i)})`;ctx.beginPath();ctx.arc(px,ey,er*(1.14+.08*Math.sin(now/170+i)),0,Math.PI*2);ctx.stroke();
  });

  const bays=[
    ['f47',0,.31,.66],['f47',1,.39,.64],['f47',2,.47,.63],
    ['f47',3,.55,.62],['f47',4,.63,.61],['f47',5,.71,.60],
    ['b2',0,.50,.72],['b1b',0,.59,.71]
  ];
  const active=new Set(escorts.map(e=>`${e.type}-${e.bayIndex}`));
  bays.forEach(([type,idx,px,py])=>{
    const bw=Math.min(w*.067,h*.145), x=w*px-bw/2, y=h*py-bw/2, hp=hpFor(type,idx), empty=active.has(`${type}-${idx}`);
    ctx.strokeStyle=empty?'rgba(154,229,255,.2)':(hp<55?'rgba(255,77,91,.5)':hp<88?'rgba(255,212,93,.46)':'rgba(93,255,157,.42)');
    ctx.fillStyle=empty?'rgba(154,229,255,.026)':'rgba(255,255,255,.035)';
    ctx.fillRect(x,y,bw,bw);ctx.strokeRect(x,y,bw,bw);
    if(!empty) drawFeedCraft(ctx,x+bw*.52,y+bw*.50,type,bw*.115,-Math.PI/2,'rgba(116,130,145,.86)');
    ctx.fillStyle=empty?'rgba(154,229,255,.38)':'rgba(220,232,245,.76)';
    ctx.font=`${Math.max(5,u*.023)}px 'JetBrains Mono',monospace`;ctx.textAlign='left';ctx.textBaseline='bottom';
    ctx.fillText(empty?'OUT':type.toUpperCase(),x+3,y+bw-3);
  });

  ctx.restore();
  contacts.forEach(c=>{
    let x=w*(.08+(c.x/innerWidth)*.84), y=h*(.06+(c.y/innerHeight)*.42);
    if(c.kind==='craft'&&c.returning){x=w*(.30+Math.sin(now/360+c.x*.01)*.40);y=h*(.62+Math.cos(now/410+c.y*.01)*.15);}
    drawFeedContact(ctx,clamp(x,8,w-8),clamp(y,24,h-10),c);
  });
  ctx.fillStyle='rgba(154,229,255,.64)';ctx.font=`${Math.max(7,u*.033)}px 'JetBrains Mono',monospace`;ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillText(`${currentLang==='zh'?'过载':'G'} ${(window.__gLoad||1.2).toFixed(2)}G`,10,h-10);
  ctx.textAlign='center';ctx.fillText(`${currentLang==='zh'?'机库':'BAY'} 8 · AIM-120`,w*.5,h-10);
  ctx.restore();
}
function drawF47Vector(ctx,x,y,size=1,angle=-Math.PI/2,color='rgba(93,255,157,.82)'){
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(angle);
  ctx.scale(size,size);
  ctx.lineJoin='round';
  const hull=ctx.createLinearGradient(-18,-9,18,9);
  hull.addColorStop(0,'rgba(40,56,70,.20)');
  hull.addColorStop(.5,'rgba(154,229,255,.40)');
  hull.addColorStop(1,'rgba(25,38,52,.18)');
  ctx.fillStyle=hull;
  ctx.strokeStyle=color;
  ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.moveTo(23,0);
  ctx.lineTo(8,-7);
  ctx.lineTo(-5,-12);
  ctx.lineTo(-14,-22);
  ctx.lineTo(-11,-7);
  ctx.lineTo(-25,-4);
  ctx.lineTo(-27,4);
  ctx.lineTo(-11,7);
  ctx.lineTo(-14,22);
  ctx.lineTo(-5,12);
  ctx.lineTo(8,7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha=.85;
  ctx.strokeStyle='rgba(180,238,255,.38)';
  ctx.lineWidth=.75;
  [['nose',16,0,-12,0],['left',0,-4,-17,-15],['right',0,4,-17,15],['spine',8,0,-19,0]].forEach(([,x1,y1,x2,y2])=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  });
  ctx.fillStyle='rgba(8,16,26,.70)';
  ctx.beginPath();ctx.ellipse(8,0,5,2.2,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawCapitalOverlay(feed,mode,now,contacts,cannonFx){
  if(!feed) return;
  const {ctx,w,h}=feed;
  ctx.save();
  ctx.clearRect(0,0,w,h);
  ctx.globalAlpha=.78;
  ctx.strokeStyle='rgba(154,229,255,.08)';
  ctx.lineWidth=.8;
  for(let x=0;x<=w;x+=Math.max(18,w/18)){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<=h;y+=Math.max(10,h/9)){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.globalAlpha=1;
  const label=mode==='side'
    ? (currentLang==='zh'?'母舰侧向 WebGL 实况':'MOTHERSHIP SIDE · WEBGL LIVE')
    : (currentLang==='zh'?'尾部推进 WebGL 实况':'AFT DRIVE · WEBGL LIVE');
  ctx.fillStyle='rgba(181,236,255,.72)';
  ctx.font=`${Math.max(6,Math.min(9,w*.025))}px 'JetBrains Mono',monospace`;
  ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText(label,8,7);
  ctx.textAlign='right';
  ctx.fillText(mode==='side'?`${(window.__gLoad||1.31).toFixed(2)}G`:`${(0.72+warpIntensity*.17).toFixed(2)}C`,w-8,7);

  const flow=(now/1200)%1;
  const sx=mode==='side'?w*(.10+flow*.78):w*(.18+flow*.64);
  const sheen=ctx.createLinearGradient(sx-w*.12,0,sx+w*.12,0);
  sheen.addColorStop(0,'rgba(154,229,255,0)');
  sheen.addColorStop(.5,'rgba(154,229,255,.16)');
  sheen.addColorStop(1,'rgba(154,229,255,0)');
  ctx.fillStyle=sheen;
  ctx.fillRect(0,0,w,h);

  contacts.forEach(c=>{
    let x=w*(.08+(c.x/innerWidth)*.84);
    let y=h*(.18+(c.y/innerHeight)*.58);
    if(mode==='rear'){
      x=w*(.18+(c.x/innerWidth)*.64);
      y=h*(.16+(c.y/innerHeight)*.72);
    }
    x=clamp(x,14,w-14);y=clamp(y,22,h-12);
    if(c.kind==='craft'){
      drawF47Vector(ctx,x,y,c.type==='b2'?0.16:0.14,c.angle||-Math.PI/2,c.returning?'rgba(154,229,255,.72)':'rgba(93,255,157,.82)');
      ctx.fillStyle='rgba(93,255,157,.70)';
      ctx.font=`${Math.max(5,w*.017)}px 'JetBrains Mono',monospace`;
      ctx.textAlign='center';ctx.textBaseline='top';
      ctx.fillText('F-47',x,y+13);
      return;
    }
    if(c.kind==='missile'){
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(c.nuke?0.1:-0.2);
      ctx.strokeStyle=c.nuke?'rgba(255,210,120,.92)':'rgba(240,248,255,.88)';
      ctx.lineWidth=1.2;
      ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);ctx.stroke();
      ctx.fillStyle=c.nuke?'rgba(255,77,91,.76)':'rgba(255,255,255,.72)';
      ctx.beginPath();ctx.arc(-12,0,2,0,Math.PI*2);ctx.fill();
      ctx.restore();
      return;
    }
    if(c.kind==='comet'){
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=c.big?'rgba(255,77,91,.88)':'rgba(255,210,120,.86)';
      ctx.beginPath();ctx.arc(x,y,c.big?5:3.5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=c.big?'rgba(255,77,91,.62)':'rgba(255,210,120,.44)';
      ctx.setLineDash([5,4]);
      ctx.beginPath();ctx.arc(x,y,c.big?18:13,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation='source-over';
      ctx.fillStyle='rgba(255,210,120,.72)';
      ctx.font=`${Math.max(5,w*.017)}px 'JetBrains Mono',monospace`;
      ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText(c.big?'GIANT COMET':'COMET',x+9,y);
    }
  });

  if(cannonFx){
    drawFeedCannon(ctx,w,h,mode,cannonFx);
  }
  ctx.restore();
}

function drawShipLiveFeeds(now){
  updateSignalDeckHud();
}

/* ===== STARS & WARP ===== */
const sky=document.getElementById('starfield');
const orbitalCanvas=document.getElementById('blackhole-gl');
let W,H,DPR;
let warpIntensity=.18, warpTarget=.18;
const backgroundScene=createBackgroundScene({
  canvas:sky,
  getPointer:()=>({x:mx,y:my}),
  getWarpIntensity:()=>warpIntensity
});
const saturnRenderer=createSaturnRenderer(orbitalCanvas);

function createSaturnRenderer(canvas){
  if(!canvas) return null;
  const gl=canvas.getContext('webgl',{
    alpha:true,
    antialias:false,
    depth:false,
    stencil:false,
    premultipliedAlpha:false,
    preserveDrawingBuffer:false,
    powerPreference:'high-performance'
  });
  if(!gl) return null;
  canvas.addEventListener('webglcontextlost',(e)=>e.preventDefault(),false); // keep the canvas alive on context loss
  const vert=`
    attribute vec2 aPos;
    void main(){gl_Position=vec4(aPos,0.0,1.0);}
  `;
  const frag=`
    precision highp float;
    uniform vec2 uResolution;
    uniform vec2 uCenter;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uEventR;
    uniform float uReadFade;

    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);
      vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);
    }
    float fbm(vec2 p){
      float v=0.0,a=0.5;
      for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=0.52;}
      return v;
    }
    mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}

    void main(){
      vec2 p=(gl_FragCoord.xy-uCenter)/max(uEventR,1.0);
      p.x*=1.04;
      p=rot(uTime*.013)*p;
      float fade=uReadFade;
      float r=length(p);
      float a=atan(p.y,p.x);
      vec3 color=vec3(0.0);
      float alpha=0.0;

      float flow=fbm(vec2(a*2.4-uTime*.055,r*9.0+uTime*.026));
      float micro=fbm(vec2(abs(p.x)*20.0-uTime*.11,p.y*18.0+flow*2.8));
      float bentY=p.y*3.85 + .10*sin(p.x*4.6 + flow*4.0 - uTime*.17);
      float radial=smoothstep(1.36,.18,abs(p.x))*smoothstep(.18,.33,r);
      float disk=exp(-abs(bentY)*10.5)*radial;
      float lanes=.50+.50*sin(abs(p.x)*74.0 + flow*10.0 - uTime*.58);
      disk*=.48+.52*lanes;
      disk*=.72+.28*micro;

      float topArc=exp(-pow((length((p-vec2(0.0,.030))/vec2(.58,.36))-1.0)/.038,2.0))*smoothstep(-.07,.18,p.y);
      float bottomArc=exp(-pow((length((p-vec2(0.0,-.035))/vec2(.52,.31))-1.0)/.048,2.0))*smoothstep(.12,-.12,p.y)*.52;
      float photon=exp(-pow((r-.355)/.044,2.0));
      float breath=.54+.46*sin(uTime*.52);
      float rimPulse=.72+.28*sin(uTime*.37+flow*2.1);
      float goldenRim=exp(-pow((r-.362)/.168,2.0))*(.48+.52*breath);
      float outerHalo=exp(-pow((r-.60)/.30,2.0))*(.12+.34*breath*rimPulse);
      float lensGlow=exp(-pow((r-.52)/.20,2.0))*.14;
      float horizon=1.0-smoothstep(.300,.333,r);
      float shadow=exp(-pow(r/.46,4.0));

      vec3 deep=vec3(.22,.105,.028);
      vec3 gold=vec3(1.0,.62,.18);
      vec3 cream=vec3(1.0,.88,.58);
      vec3 white=vec3(1.0,.97,.82);
      vec3 diskCol=mix(deep,gold,.56+.32*micro);
      diskCol=mix(diskCol,cream,smoothstep(.70,1.0,lanes)*.55);
      color+=diskCol*disk*(.76+uIntensity*.10);
      color+=white*topArc*.34 + vec3(1.0,.73,.34)*bottomArc*.24;
      color+=vec3(1.0,.66,.22)*goldenRim*.50 + white*goldenRim*.18*breath + vec3(1.0,.72,.28)*outerHalo*.22;
      color+=white*photon*.58 + vec3(.90,.58,.25)*lensGlow;

      float sparks=0.0;
      for(int i=0;i<7;i++){
        float fi=float(i);
        float px=fract(flow+fi*.137+uTime*.030)*2.0-1.0;
        vec2 sp=vec2(px,.030*sin(px*5.0+uTime*.12+fi));
        sparks+=exp(-pow(length((p-sp)/vec2(.030,.010)),2.0))*.12;
      }
      color+=white*sparks*disk;

      color=mix(color,vec3(.001,.0008,.00045),max(horizon,shadow*.44));
      alpha=max(alpha,disk*.62);
      alpha=max(alpha,topArc*.28);
      alpha=max(alpha,bottomArc*.20);
      alpha=max(alpha,goldenRim*.82);
      alpha=max(alpha,outerHalo*.42);
      alpha=max(alpha,photon*.86);
      alpha=max(alpha,lensGlow*.42);
      alpha=max(alpha,horizon*.93);
      alpha=clamp(alpha*fade,0.0,.94);
      if(alpha<0.005) discard;
      gl_FragColor=vec4(color,alpha);
    }
  `;
  const compile=(type,source)=>{
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      console.warn(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };
  const vs=compile(gl.VERTEX_SHADER,vert),fs=compile(gl.FRAGMENT_SHADER,frag);
  if(!vs||!fs) return null;
  const program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
    console.warn(gl.getProgramInfoLog(program));
    return null;
  }
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const aPos=gl.getAttribLocation(program,'aPos');
  const loc={
    resolution:gl.getUniformLocation(program,'uResolution'),
    center:gl.getUniformLocation(program,'uCenter'),
    time:gl.getUniformLocation(program,'uTime'),
    intensity:gl.getUniformLocation(program,'uIntensity'),
    eventR:gl.getUniformLocation(program,'uEventR'),
    readFade:gl.getUniformLocation(program,'uReadFade')
  };
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  canvas.addEventListener('webglcontextlost',e=>e.preventDefault());
  return {
    resize(dpr){
      const w=Math.max(1,Math.floor(innerWidth*dpr));
      const h=Math.max(1,Math.floor(innerHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){
        canvas.width=w;canvas.height=h;
      }
      canvas.style.width=innerWidth+'px';
      canvas.style.height=innerHeight+'px';
      gl.viewport(0,0,w,h);
    },
    draw(time,intensity){
      const dpr=canvas.width/Math.max(1,innerWidth);
      const compact=innerWidth<880;
      const readFade=clamp(1-Math.max(0,scrollY-innerHeight*.42)/(innerHeight*.85),.16,1);
      const cx=innerWidth*(compact?0.82:0.84);
      const cy=innerHeight*(compact?0.28:0.33);
      const eventR=Math.min(compact?330:540,Math.max(compact?215:370,Math.min(innerWidth,innerHeight)*.46))*(compact?0.98+intensity*.02:1.0+intensity*.035);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);
      gl.uniform2f(loc.resolution,canvas.width,canvas.height);
      gl.uniform2f(loc.center,cx*dpr,canvas.height-cy*dpr);
      gl.uniform1f(loc.time,time);
      gl.uniform1f(loc.intensity,intensity);
      gl.uniform1f(loc.eventR,eventR*dpr);
      gl.uniform1f(loc.readFade,readFade);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }
  };
}


function resize(){
  backgroundScene.resize();
  DPR=backgroundScene.dpr;
  W=backgroundScene.width;
  H=backgroundScene.height;
  saturnRenderer?.resize(DPR);
}
addEventListener('resize',resize);
/* ===== NEW COMET, WEAPONS & FX ===== */
const evtCanvas=document.getElementById('event-layer');
const ectx=evtCanvas.getContext('2d');
function resizeEvt(){ evtCanvas.width=innerWidth*DPR; evtCanvas.height=innerHeight*DPR; evtCanvas.style.width=innerWidth+'px'; evtCanvas.style.height=innerHeight+'px'; sizeRadar(); }
addEventListener('resize',resizeEvt);

let halley=null, weapons=[], escorts=[], explosions=[], nukeFlash=0, killCount=0, giantKillCount=0, mainCannonFx=null;
const COMET_LOCK_MS=2000;

// Real-battle state snapshot: merges combatRuntime's own getState() (fleet
// HP / ammo / deck / weapon cooldowns) with the halley/weapons/escorts/
// killCount that live directly in this module's scope. This is the
// interface topdownCombat (and any future renderer) reads instead of
// self-driving its own timeline. See ROADMAP §4 Phase 2b.
function getBattleSnapshot(){
  return {
    runtime: combatRuntime.getState(),
    halley: halley ? {
      x: halley.curX, y: halley.curY, vx: halley.vx, vy: halley.vy,
      hp: halley.hp, sizeClass: halley.sizeClass, isGiant: halley.isGiant,
      hover: !!halley.hover, destroyed: !!halley.destroyed,
      collisionRisk: halley.collisionRisk||0,
    } : null,
    weapons: weapons.map(w=>({type:w.type, x:w.x, y:w.y, stage:w.stage})),
    escorts: escorts.map(e=>({type:e.type, x:e.x, y:e.y, state:e.state})),
    killCount, giantKillCount,
    phase: pilotView?.mode || 'standby',
  };
}

function spawnHalley(){
  if(halley) return;
  const fr=Math.random()<.5, roll=Math.random();
  const sizeClass = roll < .36 ? 'small' : roll < .68 ? 'medium' : roll < .9 ? 'large' : 'giant';
  const isGiant = sizeClass === 'giant';
  const hpMap={small:14,medium:34,large:95,giant:180};
  const durMap={small:[96000,120000],medium:[120000,152000],large:[152000,184000],giant:[176000,216000]};
  const durRange=durMap[sizeClass];
  halley={
    t:0, dur: rand(durRange[0],durRange[1]),
    p0:{x:fr?innerWidth+350:-350,y:rand(60,innerHeight*.35)},
    pc:{x:innerWidth/2+rand(-120,120),y:innerHeight/2+rand(-50,100)},
    p1:{x:fr?-400:innerWidth+400,y:rand(innerHeight*.55,innerHeight-60)},
    closestT:.55+rand(-.05,.05), alerted:false, shaken:false,
    particles:[], trail:[],
    isGiant, sizeClass, hp: hpMap[sizeClass], destroyed: false, escortsSpawned: false
  };
}

function chooseWeapon(isGiant){
  const selected = apAuto ? 'auto' : (weaponSelect ? weaponSelect.value : 'auto');
  if(selected !== 'auto' && weaponReady(selected)) return selected;
  const cls=halley?.sizeClass || (isGiant ? 'giant' : 'medium');
  const byClass={
    small:['cannon','missile','enforcer','nuke'],
    medium:['missile','cannon','enforcer','nuke'],
    large:['nuke','missile','enforcer','cannon'],
    giant:['enforcer','nuke','missile','cannon']
  }[cls] || ['missile','cannon','enforcer','nuke'];
  return byClass.find(weaponReady) || byClass.reduce((best,w)=>weaponRemaining(w)<weaponRemaining(best)?w:best,byClass[0]);
}

function firePlayerBarrage(tx, ty) {
  if(cruiseModeActive()) return;
  if(halley?.attackStarted) return;
  const mode = chooseWeapon(!!halley?.isGiant);
  if(mode === 'enforcer') return fireEnforcerMain(tx, ty);
  if(mode === 'nuke') return fireEscortWeapons(tx, ty, true);
  if(mode === 'missile') return fireEscortWeapons(tx, ty, false);
  return firePhalanxIntercept(tx, ty);
}

function firePhalanxIntercept(tx, ty) {
  if(halley?.attackStarted) return;
  halley.attackStarted=true;
  halley.phalanxSequence=true;
  logBattle(HC('logSmall'));
  pushBattleToast(currentLang==='zh'?'密集阵光学锁定 · 3秒激光照射':'CIWS OPTICAL LOCK · 3S LASER DESIGNATION');
  setPilotView('ciws',halley,9600);
  startService('ammo',9000,16); startService('bay',5200,6);
  const speedPenalty=clamp(((halley?.speedKms||38)-34)/120,0,.18);
  const saturationPenalty=clamp((halley?.collisionRisk||0)*.12,0,.12);
  const success=clamp(rand(.7,.9)-speedPenalty-saturationPenalty,.52,.92);
  halley.phalanxChance=success;
  const beginBarrage=()=>{
    if(!halley || halley.destroyed || Date.now()-started>2600){
      clearInterval(barrage);
      return;
    }
    if(halley.curX<70 || halley.curX>innerWidth-70 || halley.curY<50 || halley.curY>innerHeight-45){
      clearInterval(barrage);
      pushBattleToast(currentLang==='zh'?'目标离开近防射界 · 停止弹幕':'TARGET LEAVING CIWS ARC · CEASE FIRE');
      return;
    }
    const turrets=[
      {side:0,x:innerWidth*.11,y:innerHeight*.73},
      {side:1,x:innerWidth*.89,y:innerHeight*.73}
    ];
    const turret=turrets[shot%turrets.length];
    const sx=turret.x+Math.sin(shot*.24)*5;
    const sy=turret.y+Math.cos(shot*.21)*4;
    const aimX=halley.curX+rand(-8,8), aimY=halley.curY+rand(-7,7);
    const a=Math.atan2(aimY-sy,aimX-sx)+rand(-.01,.01);
    const sp=rand(34,42)*DEFENSE_PROJECTILE_SPEED_SCALE;
    weapons.push({type:'phalanx',x:sx,y:sy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:62,hit:Math.random()<success,trail:[],side:turret.side,burst:rand(11,15),width:1.1,gold:true});
    shot++;
  };
  const started=Date.now()+3000;
  let shot=0;
  let barrage=null;
  setTimeout(()=>{
    if(!halley || halley.destroyed) return;
    pushBattleToast(currentLang==='zh'?'密集阵饱和开火':'PHALANX SATURATION FIRE');
    barrage=setInterval(beginBarrage,78);
  },3000);
}

function fireEscortWeapons(tx, ty, isGiant) {
  if(cruiseModeActive()) return;
  if(halley?.attackStarted) return;
  if(halley) halley.attackStarted=true;
  if (isGiant) {
    logBattle(HC('logLarge'));
    pushBattleToast(HC('logLarge'));
    startService('ammo',18000,28); startService('repair',16000); startService('bay',10000,14);
    const warning=document.getElementById('nukeWarning');
    warning.innerHTML=`<span class="rad-symbol">☢</span>${HC('fusion')}<br>LASER T-3.00`;
    warning.classList.add('on');
    document.body.classList.add('nuke-alert');
    // 2026-07-04 (ROADMAP §4 V16): T- countdown text used to be its own
    // setInterval(40) poll, independent of the rAF loop driving everything
    // else on screen (a second clock for the same 3s window). It's now
    // ticked from updateCombatModule() every frame instead, reading the
    // same nukeCountdownUntil deadline every other consumer already uses
    // (see the logBattle() read of this same variable in updateTopTelemetry).
    nukeCountdownUntil=Date.now()+3000;
    let wing=escorts.filter(e=>e.type==='f47').slice(0,3);
    while(wing.length<3){
      const idx=wing.length;
      const e={type:'f47',bayIndex:idx,hp:fleetHp.f47[idx]||100,x:innerWidth*(.38+idx*.12),y:innerHeight+160+idx*18,vx:0,vy:-2.4,state:'escortB2',phase:idx*2.1,lTrail:[],rTrail:[],afterburn:'blue',cloaked:true,guardSlot:idx};
      escorts.push(e); wing.push(e);
    }
    wing.forEach((e,i)=>{e.state='escortB2';e.afterburn='blue';e.guardSlot=i;e.cloaked=true;e.laserDesignating=true;});
    escorts=escorts.filter(e=>e.type!=='b2');
    const bomber={type:'b2',bayIndex:0,hp:fleetHp.b2[0],x:innerWidth*.5,y:innerHeight+180,vx:0,vy:-2.5,state:'bomberEscort',phase:9,lTrail:[],rTrail:[],afterburn:'violet',cloaked:true};
    escorts.push(bomber);
    const leadWing=wing[1] || wing[0] || bomber;
    setPilotView('launch',leadWing,2200);
    setTimeout(()=>{
      if(pilotView.mode==='launch') setPilotView('nukeAuth',halley,6400);
    },2100);
    pushBattleToast(currentLang==='zh'?'三机护航 · 激光照射开始':'THREE-SHIP ESCORT · LASER DESIGNATION START','warning');
    setTimeout(()=>{
      pushBattleToast(currentLang==='zh'?'B2 战术投放 · 核弹头离架':'B2 TACTICAL RELEASE · NUCLEAR WARHEAD AWAY','critical');
      const bx=bomber.x, by=bomber.y;
      const aimX=halley && !halley.destroyed ? halley.curX : tx;
      const aimY=halley && !halley.destroyed ? halley.curY : ty;
      weapons.push({ type:'nuke', x:bx, y:by+22, tx:aimX, ty:aimY, vx:rand(-.25,.25)*DEFENSE_PROJECTILE_SPEED_SCALE, vy:2.1*DEFENSE_PROJECTILE_SPEED_SCALE, trail:[], born:performance.now(), stage:'drop' });
      nukeCountdownUntil=0;
      bomber.state='bomberReturn';
      wing.forEach(e=>{e.state='returnCover';e.laserDesignating=false;e.afterburn='violet';});
      setTimeout(()=>{
        if(!['mosaic','nemp'].includes(pilotView.mode)) setPilotView('landing',leadWing,4200);
      },4300);
    },3000);
  } else {
    logBattle(HC('logMedium'));
    pushBattleToast(HC('logMedium'));
    missileReloadPending=true;
    startService('ammo',12000,18); startService('bay',7000,10);
    let wing=escorts.filter(e=>e.type==='f47');
    while(wing.length<2){
      const idx=wing.length;
      const e={type:'f47',bayIndex:idx,hp:fleetHp.f47[idx]||100,x:innerWidth*(.45+idx*.10),y:innerHeight+150+idx*18,tx:0,ty:0,vx:0,vy:-2.8,phase:idx*2.4,state:'intercept',lTrail:[],rTrail:[],cloaked:true,afterburn:'blue'};
      escorts.push(e); wing.push(e);
    }
    escorts.forEach((e, i) => {
       e.state='intercept'; e.afterburn='blue';
       e.orbitRadius=Math.max(130,(halley?.scale||2.2)*82);
       if(i===0){
         setPilotView('launch',e,2200);
         setTimeout(()=>{
           if(pilotView.mode==='launch') setPilotView('combat',e,1900);
         },2100);
       }
       setTimeout(() => {
         e.state='shadow';
         const aimX=halley && !halley.destroyed ? halley.curX : tx;
         const aimY=halley && !halley.destroyed ? halley.curY : ty;
         const missile={ type: 'missile', x: e.x, y: e.y + 16, tx: aimX, ty: aimY, vx: rand(-.45,.45)*DEFENSE_PROJECTILE_SPEED_SCALE, vy: 2.5*DEFENSE_PROJECTILE_SPEED_SCALE, trail: [], born: performance.now(), stage: 'drop' };
         weapons.push(missile);
         // V18 Phase 1 item 2: one authoritative timeline for this missile's
         // pilot-feed narrative (ROADMAP §4 "时间轴接 weaponClock 的具名
         // phases") — phase boundaries match the SAME MISSILE_DROP_MS/
         // MISSILE_IGNITE_MS thresholds that drive the real w.stage
         // transitions above, so the 3D chase-cam (when enabled) switches
         // shots on the real drop→ignite→terminal beats, not a separate
         // guess. Only consumed when ?combatview=topdown+?combatcam=director
         // are both on (see combatCamDirector()); the default 2D
         // drawMissileCine narrative below never reads this.
         missile.timeline = startTimeline('missile', [
           { name: 'drop', at: 0 },
           { name: 'ignite', at: MISSILE_DROP_MS },
           { name: 'terminal', at: MISSILE_IGNITE_MS },
           { name: 'impact', at: 7000 },
         ], Date.now());
         setPilotView('missile',missile,7000);
       }, 2400 + i*420);
       setTimeout(()=>{
         e.state='return';
         if(i===0 && !['mosaic','nemp'].includes(pilotView.mode)) setPilotView('landing',e,4200);
       }, 10500);
    });
  }
}

function fireEnforcerMain(tx, ty){
  if(cruiseModeActive()) return;
  const now=Date.now();
  if(now < enforcerCooldownUntil){
    logBattle(`${HC('logCooldown')}${Math.ceil((enforcerCooldownUntil-now)/1000)}s`);
    fireEscortWeapons(tx, ty, false);
    return;
  }
  if(halley?.attackStarted) return;
  if(halley) halley.attackStarted=true;
  setPilotView('mainGun',halley,9200);
  startService('ammo',26000,34); startService('bay',30000,24); startService('repair',9000);
  logBattle(`${HC('logEnforcerCharge')}4.50s`);
  pushBattleToast(`${HC('enforcerWarn')} · ${HC('brace')}4.50`);
  enforcerChargeUntil=Date.now()+4500;
  mainCannonFx={chargeStart:Date.now(),fireAt:0,tx,ty};
  weaponWarning.innerHTML=`<b>${HC('enforcerWarn')}</b><span>${HC('brace')}4.50</span>`;
  weaponWarning.classList.add('on');
  // 2026-07-04 (ROADMAP §4 V16): same fix as the nuke ticker above — this
  // used to be its own setInterval(40) poll; now ticked from
  // updateCombatModule() every frame, same enforcerChargeUntil deadline.
  setTimeout(()=>{
    enforcerChargeUntil=0;
    weaponWarning.classList.remove('on');
    document.body.classList.add('weapon-cutoff');
    const fireTx=halley&&!halley.destroyed?halley.curX:tx;
    const fireTy=halley&&!halley.destroyed?halley.curY:ty;
    mainCannonFx={...(mainCannonFx||{}),chargeStart:mainCannonFx?.chargeStart||Date.now()-4500,fireAt:Date.now(),tx:fireTx,ty:fireTy};
    document.body.classList.add('main-cannon-firing');
    shipRecoil=42;
    document.body.classList.add('shake');
    setTimeout(()=>document.body.classList.remove('main-cannon-firing'),1100);
    setTimeout(()=>document.body.classList.remove('shake'),900);
    weapons.push({type:'enforcer', active:128, tx:fireTx, ty:fireTy, ox:innerWidth*.5, oy:innerHeight+420, particles:[]});
    setTimeout(()=>document.body.classList.remove('weapon-cutoff'), 1700);
  },4500);
}

function createExplosion(x, y, isGiant, isNuke=false) {
  explosions.push({ x, y, age: 0, maxAge: 180, isGiant, particles: [] });
  const pCount = isGiant ? 320 : 150;
  for(let i=0; i<pCount; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(1.2, isGiant? 20: 10);
    explosions[explosions.length-1].particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1, decay: rand(0.0035, 0.009), size: rand(1, isGiant?4.5:3), col: Math.random()<.5?'#ffb87a':(Math.random()<.72?'#9ae5ff':'#ff3a46')
    });
  }
  if (isGiant || isNuke) nukeFlash = 1.0;
  if(isNuke){
    empUntil = Date.now() + 3000;
    document.body.classList.add('emp-effect','emp-recover','hud-static');
    setTimeout(()=>document.body.classList.remove('emp-effect','emp-recover','hud-static'),3000);
  }
  const fromMainCannon=!!(!isNuke && halley?.mainCannoned);
  const damageRadius=isNuke?460:(fromMainCannon?390:190);
  const aircraftDamageChance=isNuke ? .223 : (fromMainCannon ? .823 : 0);
  let shockCount=0;
  escorts.forEach(e=>{
    const d=Math.hypot((e.x||0)-x,(e.y||0)-y);
    if(d<damageRadius && Math.random()<aircraftDamageChance){
      const dmg=clamp((1-d/damageRadius)*(isNuke?46:62),18,isNuke?48:66);
      e.hp=Math.max(18,(e.hp??100)-dmg);
      if(e.bayIndex!==undefined && fleetHp[e.type]) fleetHp[e.type][e.bayIndex]=e.hp;
      shockCount++;
    }
  });
  if(shockCount){
    startService('repair',isNuke?18000:12000);
    pushBattleToast(currentLang==='zh'?`近爆冲击 · ${shockCount} 架舰载机受损`:`NEAR-BLAST SHOCK · ${shockCount} AIRFRAME(S) DAMAGED`);
  }
  document.body.classList.add('shake');
  setTimeout(()=>document.body.classList.remove('shake'), isGiant ? 1500 : 500);
  document.getElementById('nukeWarning').classList.remove('on');
}
function showCaptainWatermark(){
  const wm=document.getElementById('captainWatermark');
  if(!wm) return;
  wm.querySelector('b').textContent=`Feida "Bruce" Wang · giant comet kill ${giantKillCount}`;
  wm.classList.add('on');
  clearTimeout(showCaptainWatermark.t);
  showCaptainWatermark.t=setTimeout(()=>wm.classList.remove('on'),5000);
}

function updateHalley(dt){
  if(!halley) return;
  if(halley.destroyed) {
    halley.strikeAge = (halley.strikeAge||0) + dt;
    if(halley.strikeAge > 1200) halley = null;
    return;
  }

  halley.t += dt; const tt = halley.t / halley.dur;
  if(tt >= 1) { halley = null; return; }
  
  const u=1-tt, pos={x:u*u*halley.p0.x+2*u*tt*halley.pc.x+tt*tt*halley.p1.x, y:u*u*halley.p0.y+2*u*tt*halley.pc.y+tt*tt*halley.p1.y};
  const tan={x:2*u*(halley.pc.x-halley.p0.x)+2*tt*(halley.p1.x-halley.pc.x), y:2*u*(halley.pc.y-halley.p0.y)+2*tt*(halley.p1.y-halley.pc.y)};
  const tl=Math.hypot(tan.x,tan.y)||1, tdx=-tan.x/tl, tdy=-tan.y/tl;
  halley.vx=tan.x/tl; halley.vy=tan.y/tl;
  
  const proximity=1-Math.min(1,Math.abs(tt-halley.closestT)*3.2);
  // 【放大彗星体积】
  const classScale={small:[1.1,1.6],medium:[2.0,2.8],large:[3.8,4.8],giant:[5.8,7.0]}[halley.sizeClass || 'medium'];
  const baseScale = rand(classScale[0], classScale[1]);
  const scale = lerp(baseScale*0.4, baseScale, proximity);
  
  halley.trail.push({x:pos.x,y:pos.y}); if(halley.trail.length > (halley.isGiant? 160:80)) halley.trail.shift();
  
  const pCount = halley.isGiant ? 16 : 6;
  for(let i=0;i<pCount;i++){
    const sp=(Math.random()*2-1)*.2;
    halley.particles.push({type:'ion',x:pos.x,y:pos.y,vx:(tdx*Math.cos(sp)-tdy*Math.sin(sp))*rand(3,6)*scale,vy:(tdx*Math.sin(sp)+tdy*Math.cos(sp))*rand(3,6)*scale, r:rand(2,4)*scale,life:1,decay:rand(.01,.02)});
  }
  for(let i=0;i<pCount*1.5;i++){
    const sp=(Math.random()*2-1)*.4, d=(Math.random()*2-1)*.1;
    halley.particles.push({type:'dust',x:pos.x,y:pos.y,vx:(tdx*Math.cos(sp)-tdy*Math.sin(sp))*rand(1.5,3)*scale,vy:(tdx*Math.sin(sp)+tdy*Math.cos(sp))*rand(1.5,3)*scale, r:rand(2,5)*scale,life:1,decay:rand(.008,.015)});
  }
  
  for(let i=halley.particles.length-1;i>=0;i--){
    const p=halley.particles[i]; p.x+=p.vx; p.y+=p.vy; p.life-=p.decay;
    if(p.life<=0) halley.particles.splice(i,1);
  }
  if(halley.particles.length > (halley.isGiant?1800:1000)) halley.particles.splice(0, halley.particles.length-(halley.isGiant?1800:1000));

  halley.hover = Math.hypot(mx-pos.x,my-pos.y) < (50 + 60*scale);
  halley.collisionRisk = clamp(1 - Math.hypot(pos.x-innerWidth/2,pos.y-innerHeight/2)/(Math.min(innerWidth,innerHeight)*.4), 0, 1);
  halley.speedKms = Math.max(18, Math.hypot(tan.x,tan.y)/halley.dur*1000*42);
  halley.headingDeg = ((Math.atan2(tan.y,tan.x)*180/Math.PI)+360)%360;

  if(!halley.alerted && tt>halley.closestT-.1) {
    pushBattleToast(currentLang==='zh'?'近距警报 · 哈雷型彗星':'PROXIMITY · 1P/HALLEY');
    halley.alerted=true;
  }
  
  // Escorts logic (截击机突入)
  if(!cruiseModeActive() && chooseWeapon(halley.isGiant)!=='cannon' && (halley.hover || (tt > halley.closestT - 0.15))) {
    if(!halley.escortsSpawned) {
      halley.escortsSpawned = true;
      escorts = [
          {type:'f47',bayIndex:0,hp:fleetHp.f47[0],x: innerWidth/2 - 82, y: innerHeight+132, tx: 0, ty: 0, vx: 0, vy: -3.4, phase: 0, state: 'intercept', lTrail: [], rTrail: [], cloaked:true},
          {type:'f47',bayIndex:1,hp:fleetHp.f47[1],x: innerWidth/2,      y: innerHeight+152, tx: 0, ty: 0, vx: 0, vy: -3.7, phase: 2, state: 'intercept', lTrail: [], rTrail: [], cloaked:true},
          {type:'f47',bayIndex:2,hp:fleetHp.f47[2],x: innerWidth/2 + 82, y: innerHeight+132, tx: 0, ty: 0, vx: 0, vy: -3.4, phase: 4, state: 'intercept', lTrail: [], rTrail: [], cloaked:true}
      ];
      setPilotView('launch',escorts[1],5600);
    }
  }

  // Player Lock Logic
  if (!cruiseModeActive() && halley.hover) {
    halley.hoverMs = Math.min(COMET_LOCK_MS, (halley.hoverMs||0) + dt);
    if(halley.hoverMs >= COMET_LOCK_MS && !halley.playerFired) {
      halley.playerFired = true;
      firePlayerBarrage(pos.x, pos.y);
    }
    if(!halley.hoverNotified){halley.hoverNotified=true;logBattle(HC('targetNotify'));pushBattleToast(HC('targetNotify'));}
  } else { halley.hoverMs = 0; }

  // Auto-Destruct Logic
  if(!cruiseModeActive() && tt > halley.closestT + 0.05 && !halley.escortsFired && !halley.destroyed && !halley.attackStarted) {
    halley.escortsFired = true;
    const mode = chooseWeapon(halley.isGiant);
    if(mode === 'enforcer') fireEnforcerMain(pos.x, pos.y);
    else if(mode === 'nuke') fireEscortWeapons(pos.x, pos.y, halley.sizeClass === 'large' || halley.isGiant);
    else if(mode === 'cannon') firePlayerBarrage(pos.x, pos.y);
    else fireEscortWeapons(pos.x, pos.y, false);
  }

  halley.curX=pos.x; halley.curY=pos.y; halley.scale=scale; halley.proximity=proximity;
}

function drawHalley(){
  if(!halley || halley.destroyed) return;
  ectx.save(); ectx.scale(DPR,DPR);
  
  if(halley.trail.length>2){
    ectx.strokeStyle=halley.isGiant ? 'rgba(232,179,128,0.2)' : 'rgba(180,200,230,0.15)';
    ectx.lineWidth=halley.isGiant ? 3 : 1.5; ectx.beginPath();
    halley.trail.forEach((t,i)=>i===0?ectx.moveTo(t.x,t.y):ectx.lineTo(t.x,t.y));
    ectx.stroke();
  }
  
  ectx.globalCompositeOperation='lighter';
  halley.particles.forEach(p=>{
    ectx.fillStyle=p.type==='dust'?`rgba(255,210,160,${p.life*.4})`:`rgba(154,229,255,${p.life*.6})`;
    ectx.beginPath();ectx.arc(p.x,p.y,p.r,0,Math.PI*2);ectx.fill();
  });
  
  const cx0=halley.curX, cy0=halley.curY, scale = halley.scale;
  const comaR = 30 + 70*scale; // 发光日冕更大
  const coma=ectx.createRadialGradient(cx0,cy0,0,cx0,cy0,comaR);
  if(halley.isGiant) {
    coma.addColorStop(0,`rgba(255,255,255,${.95})`);
    coma.addColorStop(.2,`rgba(232,179,128,${.8})`);
    coma.addColorStop(.5,`rgba(255,100,80,${.4})`);
  } else {
    coma.addColorStop(0,`rgba(255,255,255,${.9})`);
    coma.addColorStop(.2,`rgba(154,229,255,${.7})`);
    coma.addColorStop(.5,`rgba(141,180,192,${.3})`);
  }
  coma.addColorStop(1,'rgba(0,0,0,0)');
  ectx.fillStyle=coma; ectx.beginPath();ectx.arc(cx0,cy0,comaR,0,Math.PI*2);ectx.fill();
  
  ectx.shadowBlur = 30; ectx.shadowColor = '#fff';
  ectx.fillStyle='#ffffff'; ectx.beginPath();ectx.arc(cx0,cy0,5+8*scale,0,Math.PI*2);ectx.fill(); // 核心更亮更大
  ectx.shadowBlur = 0;

  if(halley.hover) {
    const r=Math.max(22,Math.min(52,comaR*.36));
    ectx.strokeStyle='rgba(255,77,91,.96)'; ectx.lineWidth=1.6;
    ectx.setLineDash([10,7]);ectx.lineDashOffset=-performance.now()/32;
    ectx.beginPath(); ectx.arc(cx0,cy0,r,0,Math.PI*2); ectx.stroke();ectx.setLineDash([]);
    ectx.strokeStyle='rgba(255,220,220,.82)';ectx.lineWidth=1.1;
    for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;ectx.beginPath();ectx.moveTo(cx0+Math.cos(a)*(r+7),cy0+Math.sin(a)*(r+7));ectx.lineTo(cx0+Math.cos(a)*(r+18),cy0+Math.sin(a)*(r+18));ectx.stroke();}
    ectx.fillStyle='rgba(255,50,50,.8)'; ectx.beginPath(); ectx.arc(cx0,cy0,2.4,0,Math.PI*2); ectx.fill();
  }
  ectx.globalCompositeOperation='source-over'; ectx.restore();
}

/* ===== F-47 STEALTH WING + B2 NUCLEAR PLATFORM ===== */
function drawB2(ctx){
  ctx.save();
  ctx.scale(1.08,1.08);
  ctx.lineJoin='round';
  ctx.save();
  ctx.translate(4,5);
  ctx.fillStyle='rgba(0,0,0,.38)';
  ctx.beginPath();
  ctx.moveTo(0,-24);
  ctx.bezierCurveTo(18,-12,35,-2,57,8);
  ctx.lineTo(38,12);ctx.lineTo(19,16);ctx.lineTo(7,25);
  ctx.lineTo(0,18);ctx.lineTo(-7,25);ctx.lineTo(-19,16);
  ctx.lineTo(-38,12);ctx.lineTo(-57,8);
  ctx.bezierCurveTo(-35,-2,-18,-12,0,-24);
  ctx.closePath();ctx.fill();ctx.restore();
  const g=ctx.createLinearGradient(-55,-18,55,22);
  g.addColorStop(0,'#252d37');g.addColorStop(.28,'#151b24');g.addColorStop(.55,'#04070c');g.addColorStop(1,'#202732');
  ctx.fillStyle=g;ctx.strokeStyle='rgba(132,148,169,.42)';ctx.lineWidth=.7;
  ctx.beginPath();
  ctx.moveTo(0,-24);
  ctx.bezierCurveTo(18,-12,35,-2,58,8);
  ctx.lineTo(38,12);ctx.lineTo(19,16);ctx.lineTo(7,25);
  ctx.lineTo(0,18);ctx.lineTo(-7,25);ctx.lineTo(-19,16);
  ctx.lineTo(-38,12);ctx.lineTo(-58,8);
  ctx.bezierCurveTo(-35,-2,-18,-12,0,-24);
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(43,51,62,.72)';
  ctx.beginPath();ctx.moveTo(-18,1);ctx.lineTo(-5,-7);ctx.lineTo(0,-3);ctx.lineTo(5,-7);ctx.lineTo(18,1);ctx.lineTo(8,6);ctx.lineTo(-8,6);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(135,154,177,.20)';ctx.lineWidth=.55;
  ctx.beginPath();
  ctx.moveTo(-45,7);ctx.lineTo(-18,1);ctx.lineTo(0,-17);ctx.lineTo(18,1);ctx.lineTo(45,7);
  ctx.moveTo(-31,9);ctx.lineTo(-8,13);ctx.moveTo(31,9);ctx.lineTo(8,13);
  ctx.moveTo(0,-17);ctx.lineTo(0,18);
  ctx.stroke();
  ctx.fillStyle='rgba(5,8,12,.85)';
  [-18,-7,7,18].forEach(x=>{ctx.beginPath();ctx.ellipse(x,8,5,2.6,0,0,Math.PI*2);ctx.fill();});
  ctx.fillStyle='rgba(118,209,255,.16)';
  [-18,18].forEach(x=>{ctx.beginPath();ctx.ellipse(x,9,4,1.5,0,0,Math.PI*2);ctx.fill();});
  ctx.restore();
}
function drawF47(ctx){
  ctx.save();
  ctx.scale(.92,.92);
  ctx.lineJoin='round';
  ctx.translate(0,-1);
  ctx.save();
  ctx.translate(5,5);
  ctx.fillStyle='rgba(0,0,0,.38)';
  ctx.beginPath();
  ctx.moveTo(0,-48);ctx.bezierCurveTo(8,-35,18,-23,31,-13);
  ctx.lineTo(54,8);ctx.lineTo(22,9);ctx.lineTo(12,19);
  ctx.lineTo(22,36);ctx.lineTo(5,28);ctx.lineTo(0,39);
  ctx.lineTo(-5,28);ctx.lineTo(-22,36);ctx.lineTo(-12,19);
  ctx.lineTo(-22,9);ctx.lineTo(-54,8);ctx.lineTo(-31,-13);
  ctx.bezierCurveTo(-18,-23,-8,-35,0,-48);
  ctx.closePath();ctx.fill();ctx.restore();
  const hull=ctx.createLinearGradient(-42,-40,42,34);
  hull.addColorStop(0,'#9db0c4');
  hull.addColorStop(.22,'#6f8296');
  hull.addColorStop(.5,'#405367');
  hull.addColorStop(.76,'#1c2a3a');
  hull.addColorStop(1,'#0a111c');
  ctx.fillStyle=hull;ctx.strokeStyle='rgba(219,232,246,.46)';ctx.lineWidth=.7;
  ctx.beginPath();
  ctx.moveTo(0,-48);
  ctx.bezierCurveTo(9,-33,19,-22,32,-12);
  ctx.lineTo(55,8);ctx.lineTo(22,10);ctx.lineTo(13,19);
  ctx.lineTo(23,36);ctx.lineTo(6,28);ctx.lineTo(0,39);
  ctx.lineTo(-6,28);ctx.lineTo(-23,36);ctx.lineTo(-13,19);
  ctx.lineTo(-22,10);ctx.lineTo(-55,8);ctx.lineTo(-32,-12);
  ctx.bezierCurveTo(-19,-22,-9,-33,0,-48);
  ctx.closePath();ctx.fill();ctx.stroke();
  const spine=ctx.createLinearGradient(0,-42,0,30);
  spine.addColorStop(0,'rgba(188,205,222,.42)');
  spine.addColorStop(.48,'rgba(82,102,121,.36)');
  spine.addColorStop(1,'rgba(10,15,22,.42)');
  ctx.fillStyle=spine;
  ctx.beginPath();ctx.moveTo(0,-45);ctx.lineTo(11,-18);ctx.lineTo(8,18);ctx.lineTo(0,31);ctx.lineTo(-8,18);ctx.lineTo(-11,-18);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(60,16,25,.88)';
  ctx.beginPath();ctx.moveTo(0,-35);ctx.bezierCurveTo(7,-27,8,-17,4,-11);ctx.lineTo(-8,-9);ctx.bezierCurveTo(-10,-20,-7,-29,0,-35);ctx.fill();
  ctx.strokeStyle='rgba(226,238,248,.18)';ctx.lineWidth=.55;
  ctx.beginPath();
  ctx.moveTo(-42,7);ctx.lineTo(-9,-16);ctx.lineTo(0,-42);ctx.lineTo(9,-16);ctx.lineTo(42,7);
  ctx.moveTo(-27,10);ctx.lineTo(-8,18);ctx.moveTo(27,10);ctx.lineTo(8,18);
  ctx.moveTo(-17,26);ctx.lineTo(-5,27);ctx.moveTo(17,26);ctx.lineTo(5,27);
  ctx.stroke();
  ctx.strokeStyle='rgba(6,10,16,.5)';
  for(let y=-12;y<=20;y+=8){ctx.beginPath();ctx.moveTo(-7,y);ctx.lineTo(7,y+1);ctx.stroke();}
  ctx.fillStyle='rgba(18,29,42,.96)';
  ctx.beginPath();ctx.moveTo(-17,22);ctx.lineTo(-26,37);ctx.lineTo(-16,31);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(17,22);ctx.lineTo(26,37);ctx.lineTo(16,31);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.18)';
  ctx.beginPath();ctx.moveTo(-3,-45);ctx.lineTo(0,-48);ctx.lineTo(3,-45);ctx.lineTo(1,25);ctx.lineTo(-1,25);ctx.closePath();ctx.fill();
  ctx.restore();
}

function updateEscorts(dt, now) {
  ectx.save(); ectx.scale(DPR, DPR);
  for (let i = escorts.length - 1; i >= 0; i--) {
      let e = escorts[i];
      
      // 平滑控制航线与速度
      if (halley && !halley.destroyed && !['return','returnBoost'].includes(e.state)) {
          let tx = halley.curX + Math.cos(now/900 + e.phase) * (halley.sizeClass==='large'? 180 : 105);
          let ty = halley.curY + 76 + Math.sin(now/900 + e.phase) * 42;
          if(e.state === 'gunRun'){ tx=halley.curX+Math.cos(e.phase)*42; ty=halley.curY+Math.sin(e.phase)*34; }
          if(e.state === 'returnSide'){ tx=e.returnSide?innerWidth+130:-130; ty=innerHeight*.46; if(Math.abs(e.x-tx)<28){e.state='return'; e.x=e.returnSide?innerWidth+90:-90; e.y=innerHeight*.5;} }
          if(e.state === 'shadow'){
            const radius=e.orbitRadius||Math.max(130,(halley.scale||2.2)*82);
            const orbit=now/760+(e.phase||0);
            tx=halley.curX+Math.cos(orbit)*radius;
            ty=halley.curY+Math.sin(orbit)*radius*.62;
          }
          if(e.state === 'escortRing'){ tx=halley.curX+Math.cos((e.guardSlot||0)*Math.PI*2/3+now/1100)*150; ty=halley.curY+Math.sin((e.guardSlot||0)*Math.PI*2/3+now/1100)*110; }
          if(e.state === 'escortB2'){
            tx=halley.curX-130+(e.guardSlot-1)*64;
            ty=halley.curY+150+Math.sin(now/640+e.guardSlot)*9;
          }
          if(e.state === 'returnCover'){
            const bomber=escorts.find(v=>v.type==='b2');
            tx=(bomber?bomber.x:innerWidth*.5)+(e.guardSlot-1)*72;
            ty=(bomber?bomber.y:innerHeight+80)+86;
            if(!bomber || bomber.y>innerHeight+120) e.state='return';
          }
          if(e.type === 'b2'){
            if(e.state === 'bomberReturn'){tx=innerWidth*.5;ty=innerHeight+280;}
            else {tx=halley.curX-115; ty=halley.curY+165;}
          }
          const accel=e.type === 'b2' ? .00072 : .00112;
          e.vx += (tx - e.x) * accel;
          e.vy += (ty - e.y) * accel;
      } else {
          if(e.state !== 'returnBoost') e.state = 'return';
          let tx = innerWidth/2;
          let ty = innerHeight + 300;
          const boost=e.state === 'returnBoost' ? .004 : (e.type === 'b2' ? .0012 : .0018);
          e.vx += (tx - e.x) * boost;
          e.vy += (ty - e.y) * boost;
      }
      e.vx *= e.state === 'returnBoost' ? 0.985 : 0.95; e.vy *= e.state === 'returnBoost' ? 0.985 : 0.95; // 增加摩擦力，限制最高速度
      e.x += e.vx; e.y += e.vy;

      if ((e.state === 'return' || e.state === 'returnBoost') && e.y > innerHeight + 120) {
        if(missileReloadPending && e.type==='f47'){
          missileReloadPending=false;
          startWeaponCooldown('missile',weaponCooldownMs.missile);
          pushBattleToast(currentLang==='zh'?'AIM-120 回收装填 · 45秒':'AIM-120 RECOVERY RELOAD · 45S');
        }
        escorts.splice(i, 1);
        continue;
      }

      let ang = smoothHeadingFromVelocity(e,-Math.PI/2,e.type==='b2' ? .12 : .18);
      if(e.state==='intercept' && e.y>innerHeight*.68) ang=lerpAngle(e.angle??ang,-Math.PI/2,.32);
      e.angle=ang;
      let cosA = Math.cos(ang + Math.PI/2), sinA = Math.sin(ang + Math.PI/2);
      
      // 记录机翼拉烟轨迹 (Wingtip Vapor Trails)
      let lx = e.x + (-24 * cosA - 10 * sinA), ly = e.y + (-24 * sinA + 10 * cosA);
      let rx = e.x + ( 24 * cosA - 10 * sinA), ry = e.y + ( 24 * sinA + 10 * cosA);
      e.lTrail.push({x: lx, y: ly}); e.rTrail.push({x: rx, y: ry});
      if(e.lTrail.length > 25) { e.lTrail.shift(); e.rTrail.shift(); }

      if(e.laserDesignating && halley && !halley.destroyed){
        ectx.save();
        ectx.globalCompositeOperation='lighter';
        const beam=ectx.createLinearGradient(e.x,e.y-12,halley.curX,halley.curY);
        beam.addColorStop(0,'rgba(255,255,255,.18)');
        beam.addColorStop(.18,'rgba(255,78,78,.30)');
        beam.addColorStop(.66,'rgba(255,32,42,.48)');
        beam.addColorStop(1,'rgba(255,210,210,.24)');
        ectx.strokeStyle=beam;
        ectx.lineWidth=9+Math.sin(now/140)*1.2;
        ectx.lineCap='round';
        ectx.shadowBlur=18;
        ectx.shadowColor='rgba(255,48,60,.88)';
        ectx.beginPath();
        ectx.moveTo(e.x,e.y-12);
        ectx.lineTo(halley.curX+rand(-5,5),halley.curY+rand(-5,5));
        ectx.stroke();
        ectx.shadowBlur=0;
        ectx.strokeStyle='rgba(255,220,220,.62)';
        ectx.lineWidth=1.8;
        ectx.beginPath();
        ectx.moveTo(e.x,e.y-12);
        ectx.lineTo(halley.curX+rand(-3,3),halley.curY+rand(-3,3));
        ectx.stroke();
        ectx.fillStyle='rgba(255,72,72,.36)';
        ectx.beginPath();ectx.arc(halley.curX,halley.curY,20+Math.sin(now/90)*4,0,Math.PI*2);ectx.stroke();
        ectx.restore();
      }

      ectx.save();
      // 绘制拉烟
      ectx.globalCompositeOperation = 'lighter';
      ectx.lineWidth = e.state === 'returnBoost' ? 1.2 : .7; ectx.strokeStyle = e.cloaked ? 'rgba(154,229,255,0.045)' : (e.state === 'returnBoost' ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.1)');
      ectx.beginPath(); e.lTrail.forEach((t, idx) => { if(idx===0) ectx.moveTo(t.x, t.y); else ectx.lineTo(t.x, t.y); }); ectx.stroke();
      ectx.beginPath(); e.rTrail.forEach((t, idx) => { if(idx===0) ectx.moveTo(t.x, t.y); else ectx.lineTo(t.x, t.y); }); ectx.stroke();

      ectx.translate(e.x, e.y);
      ectx.rotate(ang + Math.PI/2);
      
      // 真实的高温喷口尾焰 (Engine Exhaust)
      const flame = e.afterburn === 'red' ? '#ff4d3f' : (e.afterburn === 'green' ? '#52ff9a' : (e.afterburn === 'violet' ? '#8d7cff' : '#10b0ff'));
      ectx.fillStyle = (Math.random()<.5) ? flame : '#ffdfa8';
      ectx.beginPath();
      ectx.ellipse(0, e.type==='b2'?23:24, e.type==='b2'?5:3.2, e.type==='b2'?9:7 + Math.random()*4, 0, 0, Math.PI*2);
      ectx.fill();
      ectx.shadowBlur = 15; ectx.shadowColor = ectx.fillStyle;
      
      ectx.globalCompositeOperation = 'source-over'; ectx.shadowBlur = 0;
      ectx.globalAlpha = e.cloaked ? (e.type==='b2' ? .48 : .58) : 1;
      if(e.cloaked){
        ectx.globalCompositeOperation='lighter';
        ectx.fillStyle=e.type==='b2'?'rgba(80,92,118,.035)':'rgba(154,229,255,.045)';
        ectx.beginPath();ectx.ellipse(0,0,e.type==='b2'?50:32,e.type==='b2'?27:38,0,0,Math.PI*2);ectx.fill();
        ectx.globalCompositeOperation='source-over';
      }
      {
        // Baked multi-angle sprite: visual angle follows the flight phase,
        // and the first ~2.2s play a deck-launch sequence that matches the
        // Combat View external camera: large near-side view pitching away
        // into a rear three-quarter, then settling into cruise top view.
        const turn=angleDelta(ang, e.prevAngle??ang); e.prevAngle=ang;
        e.born??=now;
        const launchT=clamp((now-e.born)/2200,0,1);
        const launchE=easeOut(launchT);
        const altP=clamp((innerHeight*1.02-e.y)/(innerHeight*.62),0,1);
        const elv=Math.min(lerp(16,90,easeOut(altP)), lerp(10,90,launchE));
        const away=clamp(-e.vy/(Math.abs(e.vx)+Math.abs(e.vy)+.001),-1,1);
        const azVel=90+away*88+clamp(turn*700,-32,32);
        const azv=lerp(96,azVel,launchE);
        const base=e.type==='b2'?100:96;
        const size=base*lerp(1.45,1,launchE); // closer to camera on the deck
        if(launchT<.3){
          // catapult exhaust streak behind the craft
          ectx.save();ectx.globalCompositeOperation='lighter';
          const cg=ectx.createLinearGradient(0,size*.35,0,size*1.3);
          cg.addColorStop(0,`rgba(150,240,255,${.5*(1-launchT/.3)})`);
          cg.addColorStop(1,'rgba(150,240,255,0)');
          ectx.fillStyle=cg;ectx.fillRect(-3,size*.35,6,size*.95);
          ectx.restore();
        }
        const drewSprite=spriteCraft.drawOriented(ectx, e.type==='b2'?'b2':'f47',
          {az:azv, el:elv, size});
        if(!drewSprite){ if(e.type === 'b2') drawB2(ectx); else drawF47(ectx); }
      }
      ectx.globalAlpha = 1;
      ectx.restore();
      if(e.bayIndex!==undefined && fleetHp[e.type]) fleetHp[e.type][e.bayIndex]=Math.max(18,Math.min(100,e.hp??fleetHp[e.type][e.bayIndex]??100));
  }
  ectx.restore();
}

function updateWeapons(dt) {
  ectx.save(); ectx.scale(DPR, DPR);
  
  for (let i = weapons.length - 1; i >= 0; i--) {
      let w = weapons[i];
      if (w.type === 'laser') {
          w.active -= 1;
          ectx.globalCompositeOperation = 'lighter';
          ectx.strokeStyle = `rgba(154,229,255,${w.active/30})`; ectx.lineWidth = 6 + Math.random()*4;
          ectx.shadowBlur = 20; ectx.shadowColor = '#9ae5ff';
          ectx.beginPath(); ectx.moveTo(w.ox, w.oy); ectx.lineTo(w.tx, w.ty); ectx.stroke();
          ectx.lineWidth = 2; ectx.strokeStyle = '#fff'; ectx.stroke();
          if(halley && !halley.destroyed) { halley.hp -= 2; }
          if(w.active <= 0) weapons.splice(i, 1);
      } 
      else if (w.type === 'enforcer') {
          w.active -= 1;
          const life = clamp(w.active/128,0,1);
          const pulse = .94 + Math.sin(w.active*.32)*.035;
          const width = Math.max(innerWidth/5.2, 230) * pulse;
          const coreW = width * .18;
          const dx=w.tx-w.ox, dy=w.ty-w.oy, len=Math.max(1,Math.hypot(dx,dy));
          const ux=dx/len, uy=dy/len;
          const span=Math.max(innerWidth,innerHeight)*2.35;
          const bx=w.ox-ux*260, by=w.oy-uy*260;
          const ex=w.ox+ux*span, ey=w.oy+uy*span;
          const beam=ectx.createLinearGradient(bx,by,ex,ey);
          beam.addColorStop(0,`rgba(255,255,255,${.70*life})`);
          beam.addColorStop(.20,`rgba(72,230,255,${.78*life})`);
          beam.addColorStop(.45,`rgba(255,20,78,${.92*life})`);
          beam.addColorStop(.68,`rgba(196,0,50,${.86*life})`);
          beam.addColorStop(1,`rgba(255,255,255,${.92*life})`);
          ectx.globalCompositeOperation='lighter';
          for(const sx of [innerWidth*.18, innerWidth*.82]){
            const side=ectx.createRadialGradient(sx,innerHeight-14,0,sx,innerHeight-14,220);
            side.addColorStop(0,`rgba(255,255,255,${.30*life})`);side.addColorStop(.34,`rgba(255,58,70,${.20*life})`);side.addColorStop(1,'rgba(255,58,70,0)');
            ectx.fillStyle=side;ectx.beginPath();ectx.arc(sx,innerHeight-14,220,0,Math.PI*2);ectx.fill();
          }
          ectx.strokeStyle=`rgba(72,230,255,${.22*life})`;ectx.lineCap='round';ectx.lineWidth=width*1.18;ectx.shadowBlur=76;ectx.shadowColor='#32dfff';
          ectx.beginPath();ectx.moveTo(bx,by);ectx.lineTo(ex,ey);ectx.stroke();
          ectx.strokeStyle=beam;ectx.lineWidth=width*.82;ectx.shadowBlur=86;ectx.shadowColor='#ff2e68';
          ectx.beginPath();ectx.moveTo(bx,by);ectx.lineTo(ex,ey);ectx.stroke();
          for(let wave=0;wave<5;wave++){
            ectx.strokeStyle=wave%2?`rgba(100,236,255,${(.14-wave*.018)*life})`:`rgba(255,255,255,${(.18-wave*.024)*life})`;
            ectx.lineWidth=width*(.72+wave*.14);
            ectx.setLineDash([28+wave*7,20+wave*4]);
            ectx.lineDashOffset=-w.active*(7+wave*2);
            ectx.beginPath();ectx.moveTo(bx,by);ectx.lineTo(ex,ey);ectx.stroke();
            ectx.setLineDash([]);
          }
          ectx.strokeStyle=`rgba(255,18,64,${.96*life})`;ectx.lineWidth=coreW;ectx.beginPath();ectx.moveTo(bx,by);ectx.lineTo(ex,ey);ectx.stroke();
          for(let p=0;p<28;p++){
            const t=(p/28 + (w.active%20)/20)%1, x=lerp(bx,ex,t), y=lerp(by,ey,t);
            ectx.fillStyle=`rgba(255,236,236,${.18+.36*life})`;ectx.beginPath();ectx.arc(x,y,2.2+Math.sin(w.active*.2+p)*1.2,0,Math.PI*2);ectx.fill();
          }
          if(halley && !halley.destroyed) {
            halley.hp -= 9.5; halley.mainCannoned=true;
            if(!halley.enforcerHit){halley.enforcerHit=true;startWeaponCooldown('enforcer',weaponCooldownMs.enforcer);}
          }
          if(w.active <= 0) { weapons.splice(i, 1); document.body.classList.remove('weapon-cutoff'); }
      }
      else if (w.type === 'phalanx') {
          w.x += w.vx; w.y += w.vy; w.life -= 1;
          // fine tracer rounds (SC style): short bright dash, tiny head, no fat bloom
          const tailX=w.x-w.vx*((w.burst||6.2)*.45);
          const tailY=w.y-w.vy*((w.burst||6.2)*.45);
          ectx.globalCompositeOperation='lighter';
          ectx.save();
          const warmRound=(w.side+w.life)%4!==0;
          ectx.strokeStyle=warmRound?'rgba(255,226,166,.88)':'rgba(140,232,255,.78)';
          ectx.lineWidth=.9;
          ectx.lineCap='round';
          ectx.beginPath();
          ectx.moveTo(tailX,tailY);
          ectx.lineTo(w.x,w.y);
          ectx.stroke();
          ectx.fillStyle='rgba(255,250,235,.85)';
          ectx.beginPath();ectx.arc(w.x,w.y,1.1,0,Math.PI*2);ectx.fill();
          ectx.restore();
          if(w.hit && halley && !halley.destroyed && Math.hypot(w.x - halley.curX, w.y - halley.curY) < 62) {
            halley.hp -= 1.65;
            explosions.push({x:w.x,y:w.y,age:0,maxAge:24,isGiant:false,particles:Array.from({length:4},()=>{const a=Math.random()*Math.PI*2,s=rand(.5,1.8);return{x:w.x,y:w.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rand(.06,.10),size:rand(.5,1.2),col:'#ffd68a'};})});
            weapons.splice(i,1); continue;
          }
          if(w.life<=0 || w.x<0 || w.x>innerWidth || w.y<0 || w.y>innerHeight) weapons.splice(i,1);
          continue;
      }
      else if (w.type === 'cannonRound') {
          w.x += w.vx; w.y += w.vy; w.life -= 1;
          ectx.globalCompositeOperation='lighter';
          ectx.fillStyle='rgba(154,229,255,.9)'; ectx.beginPath(); ectx.arc(w.x,w.y,2.2,0,Math.PI*2); ectx.fill();
          ectx.strokeStyle='rgba(154,229,255,.42)'; ectx.lineWidth=1.2; ectx.beginPath(); ectx.moveTo(w.x-w.vx*2,w.y-w.vy*2); ectx.lineTo(w.x,w.y); ectx.stroke();
          if (halley && !halley.destroyed && Math.hypot(w.x - halley.curX, w.y - halley.curY) < 70) { halley.hp -= 2.2; weapons.splice(i,1); continue; }
          if(w.life<=0) weapons.splice(i,1);
      }
      else if (w.type === 'kinetic') {
          w.x += w.vx; w.y += w.vy;
          ectx.fillStyle = '#ffdfa8'; ectx.beginPath(); ectx.arc(w.x, w.y, 2.5, 0, Math.PI*2); ectx.fill();
          if (halley && !halley.destroyed && Math.hypot(w.x - halley.curX, w.y - halley.curY) < 60) {
              halley.hp -= 1.5; weapons.splice(i, 1); continue;
          }
      } 
      else if (w.type === 'missile' || w.type === 'nuke') {
          const age = performance.now() - (w.born || performance.now());
          w.life = (w.life ?? (w.type==='nuke'?720:520)) - 1;
          if(age < MISSILE_DROP_MS){
            w.stage='drop';
            w.vy += 0.035*DEFENSE_PROJECTILE_SPEED_SCALE;
            w.vx *= .992;
          } else if(age < MISSILE_IGNITE_MS){
            w.stage='ignite';
            w.vy -= (w.type === 'nuke' ? 0.035 : 0.06)*DEFENSE_PROJECTILE_SPEED_SCALE;
            w.vx *= .986; w.vy *= .982;
          } else {
            w.stage='locked';
            const rawAim = {x: halley && !halley.destroyed ? halley.curX : w.tx, y: halley && !halley.destroyed ? halley.curY : w.ty};
            let aim=rawAim;
            let speedParams = (w.type === 'nuke' ? 0.00105 : 0.0022) * DEFENSE_PROJECTILE_SPEED_SCALE * clamp((age-MISSILE_IGNITE_MS)/MISSILE_RAMP_MS,.35,1.25);
            w.vx += (aim.x - w.x) * speedParams; w.vy += (aim.y - w.y) * speedParams;
            w.vx *= 0.974; w.vy *= 0.974;
          }
          w.x += w.vx; w.y += w.vy;
          w.x=clamp(w.x,24,innerWidth-24); w.y=clamp(w.y,24,innerHeight-24);
          w.trail = w.trail || [];
          w.trail.push({x:w.x,y:w.y}); if(w.trail.length > (w.type==='nuke'?60:42)) w.trail.shift();
          
          if(w.type === 'missile') {
             ectx.globalCompositeOperation = 'lighter';
             if(w.stage !== 'drop'){
               w.trail.forEach((t,idx)=>{const a=idx/w.trail.length;ectx.fillStyle=`rgba(255,112,72,${a*.55})`;ectx.beginPath();ectx.arc(t.x,t.y,1+a*4,0,Math.PI*2);ectx.fill();});
               ectx.strokeStyle = w.stage === 'ignite' ? 'rgba(255,210,120,0.55)' : 'rgba(255,170,80,0.78)'; ectx.lineWidth = 3.5;
               ectx.beginPath(); w.trail.forEach((t, idx) => { if(idx===0) ectx.moveTo(t.x, t.y); else ectx.lineTo(t.x, t.y); }); ectx.stroke();
             }
             ectx.save();
             ectx.globalCompositeOperation='source-over';
             ectx.translate(w.x,w.y);
             ectx.rotate(Math.atan2(w.vy,w.vx));
             drawAIM120Model(ectx,w.stage==='drop'?30:38,w.stage);
             ectx.restore();
          } else {
             ectx.globalCompositeOperation = 'lighter';
             if(w.stage !== 'drop') w.trail.forEach((t,idx)=>{const a=idx/w.trail.length;ectx.fillStyle=`rgba(255,80,60,${a*.34})`;ectx.beginPath();ectx.arc(t.x,t.y,3+a*8,0,Math.PI*2);ectx.fill();});
             ectx.fillStyle = '#fff'; ectx.shadowBlur=28; ectx.shadowColor='#ff5050';
             ectx.beginPath(); ectx.arc(w.x, w.y, (w.stage === 'drop' ? 5 : 10) + Math.random()*3, 0, Math.PI*2); ectx.fill();
             ectx.shadowBlur=0;
          }

          const missDist = halley && !halley.destroyed ? Math.hypot(w.x - halley.curX, w.y - halley.curY) : Infinity;
          w.minDist = Math.min(w.minDist ?? Infinity, missDist);
          if (w.type === 'nuke' && !w.nempAnnounced && missDist < 280) {
              w.nempAnnounced = true;
              setPilotView('nemp', w, 2300);
              pushBattleToast('NEMP incoming', 'critical');
          }
          if (halley && !halley.destroyed && missDist < (w.type==='nuke'?120:82)) {
              if(w.type==='nuke') { halley.nuked=true; startWeaponCooldown('nuke',weaponCooldownMs.nuke); }
              halley.hp -= w.type==='nuke' ? 260 : 18;
              if(w.type==='missile') setPilotView('mosaic',null,1600);
              weapons.splice(i, 1); continue;
          }
          if(w.stage==='locked' && ((w.minDist < (w.type==='nuke'?180:125) && missDist > w.minDist + 90) || w.life<=0 || !halley || halley.destroyed)){
              if(w.type==='missile' && pilotView.weapon===w) setPilotView('mosaic',null,1200);
              createExplosion(w.x,w.y,false,w.type==='nuke');
              weapons.splice(i, 1); continue;
          }
      }
      
      if(w.type !== 'laser' && (w.y < -100 || w.y > innerHeight+200 || w.x < -100 || w.x > innerWidth + 100)) weapons.splice(i, 1);
  }
  ectx.restore();

  // Halley Destruction trigger
  if(halley && !halley.destroyed && halley.hp <= 0) {
      halley.destroyed = true;
      escorts.forEach(e => e.state = 'return'); // 下达返航指令
      killCount += 1;
      if(halley.isGiant){ giantKillCount += 1; showCaptainWatermark(); }
      logBattle(`${HC('logDestroyed')}${killCount}`);
      pushBattleToast(`${HC('logDestroyed')}${killCount}`);
      if(halley.phalanxSequence || pilotView.mode==='ciws') setPilotView('offline',null,5600);
      if(halley.phalanxSequence) startWeaponCooldown('cannon',weaponCooldownMs.cannon);
      if(halley.mainCannoned){
        startWeaponCooldown('enforcer',weaponCooldownMs.enforcer);
        weaponWarning.innerHTML=`<b>${HC('cooling')}</b><span>${HC('reload')} · 90s</span>`;
        weaponWarning.classList.add('on');
        setTimeout(()=>weaponWarning.classList.remove('on'), 1800);
      }
      createExplosion(halley.curX, halley.curY, halley.isGiant, !!halley.nuked);
  }
}

function drawExplosions(dt) {
  ectx.save(); ectx.scale(DPR, DPR); ectx.globalCompositeOperation = 'lighter';
  for(let i=explosions.length-1; i>=0; i--) {
    let ex = explosions[i]; ex.age += 1;
    let progress = ex.age / ex.maxAge;
    if(progress >= 1) { explosions.splice(i,1); continue; }
    
    // 高能冲击波 Shockwaves
    ectx.strokeStyle = ex.isGiant ? `rgba(255,150,100,${1-progress})` : `rgba(154,229,255,${1-progress})`;
    ectx.lineWidth = ex.isGiant ? 16*(1-progress) : 8*(1-progress);
    ectx.beginPath(); ectx.arc(ex.x, ex.y, progress*(ex.isGiant?600:250), 0, Math.PI*2); ectx.stroke();
    const bloom=ectx.createRadialGradient(ex.x,ex.y,0,ex.x,ex.y,progress*(ex.isGiant?520:240));
    bloom.addColorStop(0,`rgba(255,255,255,${(1-progress)*.25})`);
    bloom.addColorStop(.32,`rgba(255,58,70,${(1-progress)*.16})`);
    bloom.addColorStop(1,'rgba(255,58,70,0)');
    ectx.fillStyle=bloom;ectx.beginPath();ectx.arc(ex.x,ex.y,progress*(ex.isGiant?520:240),0,Math.PI*2);ectx.fill();
    
    // 爆炸碎片 Debris
    ex.particles.forEach(p => {
       p.x += p.vx; p.y += p.vy; p.life -= p.decay;
       if(p.life>0) {
         ectx.fillStyle = p.col; ectx.globalAlpha = p.life;
         ectx.beginPath(); ectx.arc(p.x, p.y, p.size||2, 0, Math.PI*2); ectx.fill();
       }
    });
  }
  ectx.restore();
}
function pilotSubjectCraft(){
  if(pilotView.craft && escorts.includes(pilotView.craft)) return pilotView.craft;
  return escorts.find(e=>e.type==='f47' && e.state==='intercept') ||
         escorts.find(e=>e.type==='f47' && e.state==='shadow') ||
         escorts.find(e=>e.type==='f47' && String(e.state||'').startsWith('return')) ||
         escorts.find(e=>e.type==='f47') || null;
}
function pilotModeFor(craft){
  if(['missile','mosaic','ciws','offline','nukeAuth','nemp','mainGun'].includes(pilotView.mode)) return pilotView.mode;
  if(Date.now()<pilotView.until && pilotView.mode!=='standby') return pilotView.mode;
  if(!craft) return 'standby';
  if(craft.state==='intercept') return 'launch';
  if(String(craft.state||'').startsWith('return')) return 'landing';
  return 'combat';
}
function pilotTrackedPoint(w,h,mode='combat'){
  const targetLive=halley&&!halley.destroyed;
  const targetVisible=targetLive &&
    halley.curX>innerWidth*.08 && halley.curX<innerWidth*.92 &&
    halley.curY>innerHeight*.02 && halley.curY<innerHeight*.82;
  const duration=mode==='missile'?2200:mode==='nukeAuth'?2600:mode==='launch'||mode==='landing'?1900:1500;
  const elapsed=clamp((Date.now()-(pilotView.started||Date.now()))/duration,0,1);
  const lock=easeOut(elapsed);
  const chase=elapsed*elapsed*(3-2*elapsed);
  const seed=pilotView.trackSeed||0;
  const baseX=targetVisible?clamp(w*.5+(halley.curX-innerWidth/2)/innerWidth*w*.82,w*.20,w*.80):w*.5;
  const baseY=targetVisible?clamp(h*.47+(halley.curY-innerHeight*.34)/innerHeight*h*.66,h*.24,h*.70):h*.47;
  const settleX=targetVisible?lerp(w*.5,baseX,chase):baseX;
  const settleY=targetVisible?lerp(h*.48,baseY,chase):baseY;
  const shakeBase=mode==='launch'?28:mode==='landing'?24:mode==='missile'?26:mode==='nukeAuth'?18:(mode==='ciws'||mode==='mainGun'?0:10);
  const jitter=targetVisible?shakeBase*(1-lock):0;
  const cx=clamp(settleX+Math.sin(Date.now()/88+seed)*jitter+Math.sin(Date.now()/143+seed*1.7)*jitter*.55,w*.13,w*.87);
  const cy=clamp(settleY+Math.cos(Date.now()/103+seed)*jitter+Math.sin(Date.now()/171+seed*.8)*jitter*.45,h*.16,h*.78);
  return {cx,cy,locked:targetVisible&&lock>.92,lock:targetVisible?lock:0,approach:targetVisible?chase:0,baseX,baseY,visible:targetVisible,targetLive};
}
function drawPilotSpace(ctx,w,h,now,boost=1){
  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'rgba(16,31,50,.92)');
  bg.addColorStop(.48,'rgba(4,10,19,.94)');
  bg.addColorStop(1,'rgba(1,3,7,.98)');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<42;i++){
    const seed=i*97.13;
    const sx=(Math.sin(seed)*43758.5453%1+1)%1;
    const sy=(Math.sin(seed*1.71)*23145.913%1+1)%1;
    const x=(sx*w + Math.sin(now/1200+i)*8)%w;
    const y=(sy*h + (now/70*boost+i*13)%h)%h;
    const a=.2+.5*((Math.sin(now/900+i)+1)/2);
    ctx.fillStyle=`rgba(210,230,255,${a})`;
    ctx.fillRect(x,y,1.1,1.1);
    if(boost>1.2){ctx.strokeStyle=`rgba(154,229,255,${a*.32})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+8*boost);ctx.stroke();}
  }
  ctx.restore();
}
function pilotOpLabel(mode){
  if(mode==='ciws') return currentLang==='zh'?'CURRENT OP: 密集阵近防':'CURRENT OP: CLOSE DEFENSE';
  if(mode==='missile') return currentLang==='zh'?'CURRENT OP: 导弹制导链路':'CURRENT OP: MISSILE DATA LINK';
  if(mode==='nukeAuth') return currentLang==='zh'?'CURRENT OP: 自动化核钥授权':'CURRENT OP: KEY CARD AUTHORISATION';
  if(mode==='mainGun') return currentLang==='zh'?'CURRENT OP: 主炮高能束校准':'CURRENT OP: MAIN GUN ALIGNMENT';
  const active=halley&&!halley.destroyed?chooseWeapon(halley.isGiant):'missile';
  return {
    cannon:currentLang==='zh'?'CURRENT OP: 近防拦截':'CURRENT OP: POINT DEFENSE',
    missile:currentLang==='zh'?'CURRENT OP: 空空导弹':'CURRENT OP: MISSILE SALVO',
    nuke:currentLang==='zh'?'CURRENT OP: 战术核授权':'CURRENT OP: NUCLEAR AUTHORISATION',
    enforcer:currentLang==='zh'?'CURRENT OP: 执法者主炮':'CURRENT OP: ENFORCER CANNON'
  }[active] || 'CURRENT OP: OPERATION CHIMERA';
}
// Combat HMD v3 (flight-path marker, power pips, target health bars, lead
// indicator, threat edge arrows) lives in ./ui/combatHmdV3.js — extracted
// from main.js (ROADMAP §2 Phase 4 / §0 P1-4). Instantiated here with getters
// into this module's own mutable combat state, since main.js remains the
// single owner of halley/warpIntensity/shipRecoil.
const combatHmdV3=createCombatHmdV3({
  getHalley:()=>halley,
  getWarpIntensity:()=>warpIntensity,
  getShipRecoil:()=>shipRecoil,
  pilotTrackedPoint,
  getKillCount:()=>killCount,
  getGiantKillCount:()=>giantKillCount,
});
function drawPilotHmd(ctx,w,h,now,label,mode){
  const missileLike=mode==='missile'||mode==='nukeAuth'||mode==='nemp';
  drawPilotSpace(ctx,w,h,now,missileLike?1.55:1.05);
  combatHmdV3.drawCleanCombatHmd(ctx,w,h,now,label,mode);
}
// U14c (2026-07-12): snapshot passed into drawCockpitFrame's PWR/WPN/THR
// pip readouts — WPN's colour + fill come from the same chooseWeapon()/
// weaponCooldownRatio() the Defense Module buttons already use (no second
// notion of "current weapon"), warpIntensity is the existing throttle
// value, warpHover mirrors the real `body.warp-hover` class the "以中文
//入梦" button already drives (see its mouseenter/mouseleave below).
function cockpitDash(){
  const weapon=chooseWeapon(!!halley?.isGiant);
  return {
    weapon,
    cdRatio: combatRuntime.weaponCooldownRatio(weapon),
    warpIntensity,
    warpHover: document.body.classList.contains('warp-hover'),
    // U28 28f: real values for the PWR/SHLD vertical telemetry bars —
    // ammoLevel (0-100, drains on weapon use / recovers over time) is the
    // closest existing tracked resource to "mothership remaining energy";
    // deckReadiness (0-100, real fluctuating systems-readiness pool) stands
    // in for shield status, same honesty tier as this file's other derived
    // (not invented) cockpit readouts.
    pwr: combatRuntime.getAmmoLevel()/100,
    shield: combatRuntime.getDeckReadiness()/100,
  };
}
function drawPilotDeck(ctx,w,h,phase,landing=false){
  const horizon=h*(landing ? .48 : .42), center=w*.5;
  ctx.save();
  ctx.fillStyle='rgba(8,12,18,.94)';ctx.fillRect(0,horizon,w,h-horizon);
  ctx.strokeStyle='rgba(154,229,255,.18)';ctx.lineWidth=1;
  for(let i=0;i<9;i++){
    const t=i/8, y=lerp(horizon,h*1.08,t), half=lerp(w*.05,w*.56,t);
    ctx.beginPath();ctx.moveTo(center-half,y);ctx.lineTo(center+half,y);ctx.stroke();
  }
  for(let i=-4;i<=4;i++){
    const x0=center+i*w*.035, x1=center+i*w*.135;
    ctx.beginPath();ctx.moveTo(x0,horizon);ctx.lineTo(x1,h*1.06);ctx.stroke();
  }
  const travel=((phase*9)%1);
  ctx.strokeStyle=landing?'rgba(93,255,157,.62)':'rgba(255,210,120,.56)';
  for(let i=0;i<7;i++){
    const t=((i/7)+travel)%1, y=lerp(horizon,h*.98,t), half=lerp(w*.04,w*.38,t);
    ctx.beginPath();ctx.moveTo(center-half*.18,y);ctx.lineTo(center+half*.18,y);ctx.stroke();
  }
  if(!landing){
    ctx.globalCompositeOperation='lighter';
    for(let rail=-1;rail<=1;rail+=2){
      const x=center+rail*w*.045;
      const railGlow=ctx.createLinearGradient(x,horizon,x,h);
      railGlow.addColorStop(0,'rgba(112,226,255,.04)');
      railGlow.addColorStop(.65,'rgba(112,226,255,.44)');
      railGlow.addColorStop(1,'rgba(255,255,255,.08)');
      ctx.strokeStyle=railGlow;
      ctx.lineWidth=2.2+Math.sin(phase*9+rail)*.5;
      ctx.beginPath();ctx.moveTo(x,horizon-3);ctx.lineTo(center+rail*w*.18,h*.98);ctx.stroke();
    }
    for(let i=0;i<18;i++){
      const t=(phase+i/18)%1;
      const y=lerp(horizon,h*.97,t);
      const x=center+Math.sin(i*1.7+phase*11)*w*.17*t;
      ctx.fillStyle=`rgba(180,235,255,${(1-t)*.14})`;
      ctx.beginPath();ctx.ellipse(x,y,2+t*8,.8+t*3,0,0,Math.PI*2);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
  }else{
    ctx.globalCompositeOperation='lighter';
    const pad=ctx.createRadialGradient(center,h*.66,0,center,h*.66,w*.28);
    pad.addColorStop(0,'rgba(93,255,157,.10)');
    pad.addColorStop(.55,'rgba(93,255,157,.045)');
    pad.addColorStop(1,'rgba(93,255,157,0)');
    ctx.fillStyle=pad;ctx.beginPath();ctx.arc(center,h*.66,w*.28,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
  }
  ctx.fillStyle=landing?'rgba(93,255,157,.22)':'rgba(154,229,255,.18)';
  ctx.beginPath();ctx.moveTo(center,horizon-8);ctx.lineTo(center+w*.28,h*.93);ctx.lineTo(center-w*.28,h*.93);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawPilotF47Nose(ctx,w,h,phase,landing=false){
  const y=landing?lerp(h*.36,h*.62,phase):h*.86+Math.sin(phase*8)*3;
  const scale=landing?lerp(1.48,.72,phase):lerp(.82,1.02,phase);
  ctx.save();ctx.translate(w*.5,y);ctx.scale(scale,scale);ctx.globalAlpha=.94;
  const g=ctx.createLinearGradient(-w*.22,-28,w*.22,30);
  g.addColorStop(0,'rgba(94,106,120,.42)');g.addColorStop(.5,'rgba(200,214,228,.36)');g.addColorStop(1,'rgba(25,34,44,.5)');
  ctx.fillStyle=g;ctx.strokeStyle='rgba(230,240,250,.28)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,-42);ctx.lineTo(w*.19,16);ctx.lineTo(w*.06,28);ctx.lineTo(0,15);ctx.lineTo(-w*.06,28);ctx.lineTo(-w*.19,16);ctx.closePath();ctx.fill();ctx.stroke();
  const canopy=ctx.createLinearGradient(0,-38,0,-8);
  canopy.addColorStop(0,'rgba(80,32,42,.76)');
  canopy.addColorStop(1,'rgba(18,28,40,.84)');
  ctx.fillStyle=canopy;
  ctx.beginPath();ctx.moveTo(0,-34);ctx.bezierCurveTo(9,-24,8,-14,2,-8);ctx.lineTo(-8,-8);ctx.bezierCurveTo(-10,-20,-7,-29,0,-34);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.12)';
  for(let i=-2;i<=2;i++){
    ctx.beginPath();ctx.moveTo(i*8,-1);ctx.lineTo(i*15,18);ctx.stroke();
  }
  ctx.globalCompositeOperation='lighter';
  // Layered afterburner: outer violet halo cone + cyan mid plume + white-hot
  // core + shock diamonds + nozzle glow, with idle flicker. Much richer than
  // the old single radial blob.
  const fp=landing ? .55+Math.sin(phase*13)*.10 : .98+Math.sin(phase*22)*.16;
  const ny=30, len=66*fp;
  const cone=ctx.createLinearGradient(0,ny,0,ny+len);
  cone.addColorStop(0,'rgba(170,140,255,.30)');
  cone.addColorStop(.45,'rgba(112,170,255,.20)');
  cone.addColorStop(1,'rgba(80,60,200,0)');
  ctx.fillStyle=cone;
  ctx.beginPath();ctx.moveTo(-13*fp,ny);
  ctx.quadraticCurveTo(-7*fp,ny+len*.7,0,ny+len);
  ctx.quadraticCurveTo(7*fp,ny+len*.7,13*fp,ny);ctx.closePath();ctx.fill();
  const mid=ctx.createLinearGradient(0,ny,0,ny+len*.72);
  mid.addColorStop(0,'rgba(255,255,255,.88)');
  mid.addColorStop(.3,'rgba(120,235,255,.60)');
  mid.addColorStop(1,'rgba(90,150,255,0)');
  ctx.fillStyle=mid;
  ctx.beginPath();ctx.moveTo(-7*fp,ny);
  ctx.quadraticCurveTo(-3*fp,ny+len*.55,0,ny+len*.72);
  ctx.quadraticCurveTo(3*fp,ny+len*.55,7*fp,ny);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.92)';
  ctx.beginPath();ctx.ellipse(0,ny+6,4.5*fp,12*fp,0,0,Math.PI*2);ctx.fill();
  if(!landing){
    for(let i=1;i<=3;i++){
      const dy=ny+len*.16*i+Math.sin(phase*30+i)*1.5, dw=(3.6-i*.7)*fp;
      ctx.fillStyle=`rgba(255,255,255,${.5-i*.12})`;
      ctx.beginPath();ctx.ellipse(0,dy,dw,dw*1.7,0,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.fillStyle='rgba(255,228,196,.5)';
  ctx.beginPath();ctx.ellipse(0,ny,9*fp,3,0,0,Math.PI*2);ctx.fill();
  ctx.globalCompositeOperation='source-over';
  ctx.restore();
}
/* First-person cockpit frame for the pilot feed — canopy struts + a console
   dashboard with two glowing MFD panels, in the language of the Star Citizen
   reference shots. Drawn on top of the scene so the centre glass stays clear
   for the HMD/target; the dashboard also masks any stray bottom-edge HUD line. */
function drawPilotSystemSequence(ctx,w,h,phase,landing=false){
  ctx.save();
  const cyan='rgba(116,240,255,.82)';
  const green='rgba(93,255,157,.82)';
  const amber='rgba(255,210,120,.86)';
  const alpha=landing?clamp(phase*1.4,0,1):clamp(1-phase*1.65,.18,1);
  ctx.globalAlpha=alpha;
  const x=w*.09,y=h*.12,pw=w*.34,ph=h*.23;
  ctx.fillStyle='rgba(3,8,14,.66)';
  ctx.strokeStyle=landing?green:cyan;
  ctx.lineWidth=1;
  ctx.fillRect(x,y,pw,ph);
  ctx.strokeRect(x,y,pw,ph);
  ctx.font=`${Math.max(6,w*.018)}px 'JetBrains Mono',monospace`;
  ctx.textAlign='left';
  ctx.textBaseline='top';
  ctx.fillStyle=landing?green:cyan;
  ctx.fillText(landing?'RECOVERY SEQUENCE':'F-47 FLIGHT BUS POST',x+9,y+8);
  const rows=landing
    ? ['VECTOR CAPTURE','GEAR LOCK','THERMAL COOL','MISSION CLOSE']
    : ['AVIONICS ONLINE','MAG CATAPULT ARMED','GUIDANCE LINK','WEAPON BUS SAFE'];
  rows.forEach((row,i)=>{
    const p=clamp((phase*1.35-i*.12)*1.7,0,1);
    const yy=y+25+i*12;
    ctx.fillStyle=p>.94?green:(i===1&&!landing?amber:cyan);
    ctx.fillText(row,x+9,yy);
    ctx.strokeStyle='rgba(116,240,255,.16)';
    ctx.beginPath();ctx.moveTo(x+pw*.56,yy+4);ctx.lineTo(x+pw-10,yy+4);ctx.stroke();
    ctx.strokeStyle=p>.94?green:amber;
    ctx.beginPath();ctx.moveTo(x+pw*.56,yy+4);ctx.lineTo(x+pw*.56+(pw*.38)*p,yy+4);ctx.stroke();
  });
  if(landing&&phase>.72){
    ctx.globalAlpha=clamp((phase-.72)/.28,0,1);
    ctx.fillStyle='rgba(220,255,235,.92)';
    ctx.font=`${Math.max(8,w*.026)}px 'Orbitron',sans-serif`;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText('COMBAT FEED CLOSED',w*.5,h*.36);
  }
  ctx.restore();
}
function drawPilotMissilePOV(ctx,w,h,now,wpn){
  const age=performance.now()-(wpn?.born||performance.now());
  const stage=wpn?.stage || (age<700?'drop':age<1500?'ignite':'locked');
  drawPilotSpace(ctx,w,h,now,stage==='locked'?2.4:1.1);
  if(stage==='drop'){
    ctx.fillStyle='rgba(5,8,12,.74)';ctx.fillRect(0,0,w,h*.28);
    ctx.strokeStyle='rgba(154,229,255,.22)';
    ctx.strokeRect(w*.18,6,w*.26,h*.22);ctx.strokeRect(w*.56,6,w*.26,h*.22);
    ctx.save();ctx.translate(w*.5,h*.36+Math.sin(now/110)*2);ctx.rotate(Math.PI/2+.05*Math.sin(now/180));drawAIM120Model(ctx,Math.min(70,w*.18),'drop');ctx.restore();
    ctx.fillStyle='rgba(220,232,245,.7)';ctx.font="8px 'JetBrains Mono',monospace";ctx.textAlign='center';
    ctx.fillText(currentLang==='zh'?'弹仓释放 · 未点火':'BAY DROP · MOTOR SAFE',w*.5,h*.2);
  }else if(stage==='ignite'){
    const flame=ctx.createRadialGradient(w*.5,h*1.08,0,w*.5,h*1.08,w*.52);
    flame.addColorStop(0,'rgba(255,255,255,.78)');flame.addColorStop(.28,'rgba(255,168,72,.46)');flame.addColorStop(1,'rgba(255,80,40,0)');
    ctx.fillStyle=flame;ctx.beginPath();ctx.arc(w*.5,h*1.08,w*.52,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(w*.5,h*.62);ctx.rotate(-Math.PI/2);drawAIM120Model(ctx,Math.min(82,w*.22),'ignite');ctx.restore();
    ctx.fillStyle='rgba(255,210,120,.84)';ctx.font="8px 'JetBrains Mono',monospace";ctx.textAlign='center';
    ctx.fillText(currentLang==='zh'?'固体火箭点火':'BOOSTER IGNITION',w*.5,h*.78);
  }
  if(halley&&!halley.destroyed){
    const dx=(halley.curX-(wpn?.x||innerWidth/2))/innerWidth;
    const dy=(halley.curY-(wpn?.y||innerHeight/2))/innerHeight;
    const tx=clamp(w*.5+dx*w*1.8,26,w-26), ty=clamp(h*.48+dy*h*1.8,28,h-24);
    const dist=clamp(Math.hypot(dx,dy)*1.9,.08,1);
    const r=lerp(34,9,dist);
    ctx.strokeStyle='rgba(255,77,91,.86)';ctx.lineWidth=1.4;ctx.setLineDash([6,4]);
    ctx.beginPath();ctx.arc(tx,ty,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,77,91,.74)';ctx.font="8px 'JetBrains Mono',monospace";ctx.textAlign='left';
    ctx.fillText(`${currentLang==='zh'?'终端制导':'TERMINAL'} ${(100-dist*100).toFixed(0)}%`,tx+12,ty-12);
  }
  drawPilotHmd(ctx,w,h,now,stage==='drop'?'MISSILE DROP':stage==='ignite'?'MISSILE IGNITION':'MISSILE POV','missile');
}

/* Phalanx CIWS mount in the foreground (ref: Mk-15 close-in weapon system) —
   white radome dome, boxy ammo-drum body, and a 6-barrel gatling cluster that
   traverses onto the contact and spins while firing. Returns the muzzle point
   so tracers originate from the barrels. */
function drawPhalanxMount(ctx,w,h,now,tx,ty,firing){
  const T=Math.PI*2, S=Math.min(w,h)/300;
  const baseX=w*.5, baseY=h*1.03;
  const gax=w*.5, gay=h-94*S;                 // gatling rotation axis
  const dx=tx-gax, dy=ty-gay, dl=Math.hypot(dx,dy)||1;
  const ux=dx/dl, uy=dy/dl, px=-uy, py=ux;    // aim + perpendicular
  const recoil=firing?Math.sin(now/24)*2.4*S:0;
  ctx.save();
  // pedestal
  ctx.fillStyle='#31363b';
  ctx.beginPath();ctx.moveTo(baseX-80*S,baseY);ctx.lineTo(baseX+80*S,baseY);
  ctx.lineTo(baseX+50*S,baseY-56*S);ctx.lineTo(baseX-50*S,baseY-56*S);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(14,18,22,.85)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='#c19a45';ctx.fillRect(baseX-50*S,baseY-56*S,100*S,4*S);   // hazard ring
  // ammo-drum body (recoil shudder)
  ctx.save();ctx.translate(0,recoil);
  const body=ctx.createLinearGradient(0,baseY-104*S,0,baseY-56*S);
  body.addColorStop(0,'#5a6066');body.addColorStop(.5,'#3d434a');body.addColorStop(1,'#22272c');
  ctx.fillStyle=body;
  ctx.beginPath();ctx.moveTo(baseX-46*S,baseY-56*S);ctx.lineTo(baseX+46*S,baseY-56*S);
  ctx.lineTo(baseX+40*S,baseY-104*S);ctx.lineTo(baseX-40*S,baseY-104*S);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(150,168,184,.22)';ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(baseX-38*S,baseY-98*S,15*S,34*S);ctx.fillRect(baseX+23*S,baseY-98*S,15*S,34*S);
  // white radome dome (iconic), tilted back
  ctx.save();ctx.translate(baseX+6*S,baseY-104*S);ctx.rotate(-.16);
  const dome=ctx.createLinearGradient(-30*S,-66*S,30*S,0);
  dome.addColorStop(0,'#f6f8f9');dome.addColorStop(.55,'#d7dde1');dome.addColorStop(1,'#9aa3a9');
  ctx.fillStyle=dome;
  ctx.beginPath();ctx.moveTo(-28*S,0);ctx.lineTo(-28*S,-42*S);ctx.arc(0,-42*S,28*S,Math.PI,0);ctx.lineTo(28*S,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(120,140,156,.5)';ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-22*S,-42*S);ctx.lineTo(22*S,-42*S);ctx.stroke();
  ctx.restore();
  ctx.restore();
  // gatling cluster aimed along (ux,uy)
  ctx.save();ctx.translate(recoil*.4,recoil);
  ctx.fillStyle='#4c5258';ctx.beginPath();ctx.arc(gax,gay,13*S,0,T);ctx.fill();
  ctx.strokeStyle='rgba(18,24,30,.8)';ctx.stroke();
  const L=Math.min(w,h)*.20, spin=firing?now/14:now/700;
  for(let i=0;i<6;i++){
    const a=spin+i*Math.PI/3, off=Math.cos(a)*4.6*S;
    ctx.strokeStyle=Math.sin(a)>0?'#272d33':'#454d54';ctx.lineWidth=3*S;
    ctx.beginPath();ctx.moveTo(gax+px*off+ux*8*S,gay+py*off+uy*8*S);
    ctx.lineTo(gax+px*off+ux*L,gay+py*off+uy*L);ctx.stroke();
  }
  const mx=gax+ux*L, my=gay+uy*L;
  ctx.fillStyle='#1b2126';ctx.beginPath();ctx.arc(mx,my,7*S,0,T);ctx.fill();
  if(firing){
    ctx.save();ctx.globalCompositeOperation='lighter';
    const fl=.62+.38*Math.sin(now/20);
    const fg=ctx.createRadialGradient(mx,my,0,mx,my,22*S*fl);
    fg.addColorStop(0,'rgba(255,250,220,.95)');fg.addColorStop(.4,'rgba(255,180,90,.5)');fg.addColorStop(1,'rgba(255,120,60,0)');
    ctx.fillStyle=fg;ctx.beginPath();ctx.arc(mx,my,22*S*fl,0,T);ctx.fill();
    ctx.strokeStyle='rgba(255,230,170,.7)';ctx.lineWidth=1.5;
    for(let i=0;i<5;i++){const a2=now/38+i*1.26;ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx+Math.cos(a2)*15*S*fl,my+Math.sin(a2)*15*S*fl);ctx.stroke();}
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
  return {mx,my};
}
function drawCiwsCamera(ctx,w,h,now,mode,elapsed){
  // CIWS gun-camera v3 — foreground Phalanx mount (white radome + spinning
  // gatling) firing on the real comet target.
  drawPilotSpace(ctx,w,h,now,1.2);
  const active=mode==='ciws' && halley && !halley.destroyed;
  const tracked=pilotTrackedPoint(w,h,'ciws');
  const rawTx=active?clamp(tracked.cx,44,w-44):w*.56;
  const rawTy=active?clamp(tracked.cy,36,h*.62):h*.36;
  // Smooth the aim point so the reticle glides onto target instead of
  // jittering frame-to-frame on the fast-moving comet (no crosshair shake).
  drawCiwsCamera.sx = drawCiwsCamera.sx==null ? rawTx : lerp(drawCiwsCamera.sx, rawTx, .12);
  drawCiwsCamera.sy = drawCiwsCamera.sy==null ? rawTy : lerp(drawCiwsCamera.sy, rawTy, .12);
  const tx=drawCiwsCamera.sx, ty=drawCiwsCamera.sy;
  const firing=active&&elapsed>.12;   // ~reaction time, then continuous tracking fire
  ctx.save();

  const frame=ctx.createLinearGradient(0,0,0,h);
  frame.addColorStop(0,'rgba(4,10,16,.32)');
  frame.addColorStop(.5,'rgba(0,0,0,0)');
  frame.addColorStop(1,'rgba(4,8,13,.46)');
  ctx.fillStyle=frame;ctx.fillRect(0,0,w,h);
  hmdCornerFrame(ctx,w,h);

  if(active){
    const sizeScale={small:1,medium:1.2,large:1.4,giant:1.6}[halley?.sizeClass]||1.2;
    hmdComet(ctx,tx,ty,4.2*sizeScale,now,halley?.vx??-1,halley?.vy??.3);
    hmdBracket(ctx,tx,ty,Math.min(w,h)*.09*sizeScale,tracked.lock||0,firing,now,
      `${Math.round(Math.hypot((halley?.curX??0)-innerWidth/2,(halley?.curY??0)-innerHeight/2))} M`,'1P/HALLEY',HMD.red);
  }

  // Phalanx mount in the foreground, aimed at the contact; tracers from muzzle
  const muzzle=drawPhalanxMount(ctx,w,h,now,tx,ty,firing);
  if(firing){
    // single bottom-centre gatling: one dense continuous tracer stream (M61-style)
    hmdTracer(ctx,muzzle.mx,muzzle.my,tx,ty,now,0,24);
    hmdSparks(ctx,tx,ty,now,1.35);
  }else if(mode==='ciws'&&active){
    // laser designation from the muzzle to the contact
    ctx.save();ctx.strokeStyle='rgba(255,92,98,.45)';ctx.lineWidth=1;ctx.setLineDash([2,8]);
    ctx.beginPath();ctx.moveTo(muzzle.mx,muzzle.my);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }

  hmdStatusChip(ctx,w,h,
    firing?'CIWS FIRING · BURST':(mode==='offline'?'CLOSE DEFENSE OFFLINE':'CIWS ARRAY · LASER MARK'),
    firing?HMD.red:HMD.amber,mode==='ciws',now);
  ctx.fillStyle=HMD.cyanSoft;
  ctx.font=HMD.font(Math.max(7,Math.min(9,w*.019)));
  ctx.textAlign='right';ctx.textBaseline='top';
  ctx.fillText(`AMMO ${Math.max(0,Math.round(88-elapsed*44))}%`,w-12,12);
  hmdTelemetry(ctx,w,h,
    `AZ ${Math.round(112+Math.sin(now/1200)*8)} · LEAD ${active?Math.round(Math.atan2(halley.vy||0,halley.vx||1)*180/Math.PI):0}`,
    active?'AUTO ENGAGE':'TARGET ELIMINATED');

  if(mode==='offline'){
    const p=clamp(elapsed,0,1);
    ctx.fillStyle='rgba(1,5,9,.80)';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(220,245,255,.88)';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`${Math.max(10,w*.038)}px 'Orbitron',sans-serif`;
    ctx.fillText(p<.42?'TARGET ELIMINATED':p<.78?'AMMO RELOADING':'AFFLATUS OFFLINE',w*.5,h*.46);
    ctx.font=HMD.font(Math.max(6,w*.017));
    ctx.fillStyle=HMD.cyanSoft;
    ctx.fillText(p<.78?'close defense system cycling':'avionics camera shutdown',w*.5,h*.56);
    for(let y=0;y<h;y+=4){
      if(Math.random()<.16){ctx.fillStyle=`rgba(113,226,255,${Math.random()*.10})`;ctx.fillRect(0,y,w,1);}
    }
  }
  ctx.restore();
}

function drawNukeAuthCamera(ctx,w,h,now,elapsed){
  drawPilotSpace(ctx,w,h,now,1.0);
  ctx.save();
  const cyan='rgba(116,240,255,.78)', red='rgba(255,77,91,.88)', gold='rgba(255,212,93,.86)';
  ctx.strokeStyle='rgba(255,77,91,.36)';ctx.fillStyle='rgba(26,5,9,.54)';
  ctx.strokeRect(w*.12,h*.16,w*.76,h*.60);ctx.fillRect(w*.12,h*.16,w*.76,h*.60);
  ctx.fillStyle=red;ctx.font=`${Math.max(10,w*.032)}px 'Orbitron',sans-serif`;ctx.textAlign='center';
  ctx.fillText(currentLang==='zh'?'AUTOMATION KEY CARD AUTHORISATION':'AUTOMATION KEY CARD AUTHORISATION',w*.5,h*.25);
  ctx.font=`${Math.max(7,w*.019)}px 'JetBrains Mono',monospace`;ctx.fillStyle=gold;
  ctx.fillText(currentLang==='zh'?'警报，侦测到在途的核聚变打击':'NUCLEAR FUSION STRIKE INBOUND',w*.5,h*.34);
  const cardW=w*.48, cardH=h*.16, cardX=w*.26, cardY=h*.44;
  ctx.strokeStyle='rgba(255,212,93,.54)';ctx.fillStyle='rgba(3,8,12,.84)';
  ctx.strokeRect(cardX,cardY,cardW,cardH);ctx.fillRect(cardX,cardY,cardW,cardH);
  const sweep=clamp(elapsed*1.25,0,1);
  ctx.fillStyle='rgba(255,212,93,.22)';ctx.fillRect(cardX+4,cardY+4,(cardW-8)*sweep,cardH-8);
  ctx.fillStyle=cyan;ctx.textAlign='left';
  ctx.fillText('KEYCARD: AFFLATUS-CMD',cardX+12,cardY+cardH*.42);
  ctx.fillText(`AUTH HASH ${(Math.sin(now/43)*99999|0).toString(16).replace('-','').padStart(5,'0').toUpperCase()}`,cardX+12,cardY+cardH*.68);
  ctx.fillStyle='rgba(255,77,91,.90)';ctx.font=`${Math.max(22,w*.07)}px 'Orbitron',sans-serif`;
  ctx.fillText('☢',w*.46,h*.68);
  ctx.fillStyle=red;ctx.font=`${Math.max(8,w*.022)}px 'JetBrains Mono',monospace`;ctx.textAlign='center';
  ctx.fillText(`T-${Math.max(0,(1-elapsed)*5).toFixed(2)}`,w*.55,h*.68);
  drawPilotHmd(ctx,w,h,now,'NUCLEAR KEYCARD','nukeAuth');
  ctx.restore();
}

function drawNempIncomingCamera(ctx,w,h,now,elapsed){
  drawPilotSpace(ctx,w,h,now,2.0);
  ctx.save();
  const pulse=.55+.45*Math.sin(now/90);
  ctx.fillStyle=`rgba(255,255,255,${.07+.13*pulse})`;
  for(let i=0;i<36;i++){
    const y=(i/36*h+now/18)%h;
    ctx.fillRect(0,y,w,1+Math.random()*3);
  }
  ctx.strokeStyle='rgba(255,77,91,.78)';
  ctx.fillStyle='rgba(48,5,10,.62)';
  ctx.lineWidth=1.4;
  ctx.strokeRect(w*.20,h*.32,w*.60,h*.24);
  ctx.fillRect(w*.20,h*.32,w*.60,h*.24);
  ctx.fillStyle='rgba(255,220,220,.94)';
  ctx.font=`${Math.max(14,w*.052)}px 'Orbitron',sans-serif`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText('NEMP INCOMING',w*.5,h*.42);
  ctx.font=`${Math.max(7,w*.022)}px 'JetBrains Mono',monospace`;
  ctx.fillStyle='rgba(255,212,93,.9)';
  ctx.fillText(currentLang==='zh'?'全舰屏蔽 · 准备白噪音冲击':'HARDENING BUS · WHITE-NOISE IMPACT',w*.5,h*.51);
  drawPilotHmd(ctx,w,h,now,'NUCLEAR IMPACT WINDOW','nukeAuth');
  ctx.restore();
}

function drawMainGunCamera(ctx,w,h,now,elapsed,firing=false,fx=null){
  drawPilotSpace(ctx,w,h,now,1.4);
  ctx.save();
  const cyan='rgba(116,240,255,.82)', mag='rgba(255,80,188,.84)', red='rgba(255,30,70,.90)';
  const fireT=fx&&fx.mode==='fire'?fx.t:0;
  if(firing){
    const recoil=Math.sin(clamp(fireT/.3,0,1)*Math.PI)*22+Math.max(0,1-fireT)*4;
    ctx.translate(Math.sin(now/35)*recoil*.34,recoil);
    ctx.rotate(Math.sin(now/51)*recoil*.0007);
  }
  const tracked=pilotTrackedPoint(w,h,'mainGun');
  const hasGunTarget=tracked.visible;
  const targetX=hasGunTarget?clamp(tracked.cx,28,w-28):w*.58;
  const targetY=hasGunTarget?clamp(tracked.cy,28,h*.72):h*.42;
  if(!firing){
    // SC zoom scope during charge phase — large tightening ring
    const range=hasGunTarget?Math.max(88,Math.round(720-(tracked.lock||0)*560)):620;
    drawSCZoomScope(ctx,w,h,targetX,targetY,tracked.lock||0,range,now);
  } else {
    // keep the gun indicator triangle during actual fire
    ctx.fillStyle='rgba(2,6,12,.72)';
    ctx.beginPath();ctx.moveTo(w*.50,h*.95);ctx.lineTo(w*.40,h*.70);ctx.lineTo(w*.60,h*.70);ctx.closePath();ctx.fill();
    ctx.strokeStyle=cyan;ctx.stroke();
    ctx.fillStyle=cyan;ctx.font=`${Math.max(7,w*.02)}px 'JetBrains Mono',monospace`;ctx.textAlign='center';
    ctx.fillText('MAIN GUN FIRING',w*.5,24);
  }
  if(firing){
    // The mothership main gun fires from below-frame centre — the same origin as
    // the homepage beam (innerWidth*.5, innerHeight+420) — straight THROUGH the
    // contact and out of frame: one extremely thick lance that pierces the view.
    const ox=w*.5, oy=h*1.12;                 // muzzle / mothership centre, below frame
    const dx=targetX-ox, dy=targetY-oy, len=Math.max(1,Math.hypot(dx,dy));
    const ux=dx/len, uy=dy/len, span=Math.max(w,h)*2.8;
    const sx=ox, sy=oy, ex=ox+ux*span, ey=oy+uy*span;   // from muzzle, through target, far beyond
    const grow=clamp(fireT/.16,0,1);   // beam slams to full width fast
    const beam=ctx.createLinearGradient(sx,sy,ex,ey);
    beam.addColorStop(0,'rgba(255,255,255,.92)');
    beam.addColorStop(.28,mag);
    beam.addColorStop(.55,red);
    beam.addColorStop(1,'rgba(255,255,255,.80)');
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round';
    ctx.strokeStyle='rgba(120,235,255,.22)';ctx.lineWidth=w*.26*grow;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
    ctx.strokeStyle=beam;ctx.lineWidth=w*.15*grow;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.96)';ctx.lineWidth=w*.032*grow;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
    for(let wave=0;wave<4;wave++){
      ctx.strokeStyle=wave%2?'rgba(255,255,255,.30)':'rgba(255,40,90,.34)';
      ctx.lineWidth=w*(.07+wave*.032)*grow;
      ctx.setLineDash([18+wave*5,14+wave*4]);
      ctx.lineDashOffset=-now/(18+wave*5);
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalCompositeOperation='source-over';
  }
  drawPilotHmd(ctx,w,h,now,'MOTHERSHIP MAIN GUN VIEW','mainGun');
  ctx.restore();
}

// V17 cockpit boot sequence: the console powers on staged (drawCockpitFrame's
// `boot` param). Full sequence on the first standby/combat frame ever (page
// load), and re-armed from 65% whenever a launch hands over to TARGET LINK —
// during the launch itself the console is already staging up with `elapsed`.
let cockpitBootAt=0, cockpitBootFrom=0, lastPilotFeedMode='';
function cockpitBootT(nowMs,mode){
  if(mode!=='combat'&&mode!=='standby') return 1;
  if(lastPilotFeedMode==='launch'){ cockpitBootAt=nowMs; cockpitBootFrom=.65; }
  else if(!cockpitBootAt){ cockpitBootAt=nowMs; cockpitBootFrom=0; }
  const dur=cockpitBootFrom>0?1500:2600;
  return clamp(cockpitBootFrom+(1-cockpitBootFrom)*((nowMs-cockpitBootAt)/dur),0,1);
}
function drawPilotFeed(now){
  const feed=setupFeedCanvas(document.getElementById('pilotFeed'));
  if(!feed) return;
  const {ctx,w,h}=feed, craft=pilotSubjectCraft();
  const nowMs=Date.now();
  if(pilotView.until<nowMs && pilotView.mode!=='mosaic') pilotView.mode='standby';
  let mode=pilotModeFor(craft);
  if(mode==='mosaic' && pilotView.until<nowMs){pilotView.mode='standby';mode='standby';}
  const cockpitBoot=cockpitBootT(nowMs,mode);
  lastPilotFeedMode=mode;
  // Phase 2 → U24 (24c): top-down WebGL feed for combat/standby AND, since
  // U24, launch/landing — entering those modes fires the scene's flight
  // lifecycle (deckCam/chaseLaunch/towerCam/flybyCam cuts happen inside the
  // scene, driven by the flightPath phase table). The flight timeline is
  // scene-autonomous: it runs to completion even if pilotView's shorter
  // mode window (2200ms) ends first — U24 风险小节的既定裁决。
  // ?combatview=2d still restores the whole legacy 2D path in one flag.
  if((mode==='combat'||mode==='standby'||mode==='launch'||mode==='landing') && combatViewTopdown()){
    const td=getTopdownCV();
    if(td){
      if((mode==='launch'||mode==='landing') && pilotView.started!==tdFlightStamp){
        tdFlightStamp=pilotView.started;
        td.requestFlightEvent(mode); // ignored if a lifecycle is already live (24d)
      }
      td.resize(w,h);
      td.renderOnce(now,getBattleSnapshot());
      ctx.save();
      const j=mode==='combat'?0.6:0;
      if(j) ctx.translate(rand(-j,j),rand(-j,j));
      ctx.drawImage(topdownCanvas,0,0,w,h);
      ctx.restore();
      const hmdLabel=mode==='launch'?(currentLang==='zh'?'弹射起飞 · 甲板机位':'LAUNCH · DECK CAM')
        :mode==='landing'?(currentLang==='zh'?'进近回收 · 塔台机位':'RECOVERY · TOWER CAM')
        :(currentLang==='zh'?'上帝视角 · 战术网格':'TOP-DOWN · TACTICAL');
      if(combatViewScPanel()){ drawCombatHudSC(ctx,w,h,now,combatHudState(mode)); }
      else { drawPilotHmd(ctx,w,h,now,hmdLabel,'combat'); drawCockpitFrame(ctx,w,h,now,false,1,cockpitDash()); /* V17: console after the HMD pass, same draw-order fix */ }
      return;
    }
  }
  const elapsed=clamp((nowMs-(pilotView.started||nowMs))/Math.max(1,(pilotView.until||nowMs+1)-(pilotView.started||nowMs)),0,1);
  const shake=(
    mode==='launch' ? 4.8*(1-elapsed)+Math.sin(now/42)*1.1 :
    mode==='missile' ? (pilotView.weapon?.stage==='ignite'?4.6:1.2) :
    mode==='landing' ? 3.2*elapsed :
    mode==='nukeAuth' ? 2.6*(1-Math.min(1,elapsed*.8))+Math.sin(now/58)*.8 :
    mode==='combat' ? .75 :
    0
  );
  ctx.save();ctx.translate(rand(-shake,shake),rand(-shake,shake));
  if(mode==='missile' && pilotView.weapon){
    // V18 Phase 1 item 2: 3D chase-cam narrative, opt-in via BOTH
    // ?combatview=topdown and ?combatcam=director. td3d is null (falls
    // through to the existing legacy/cine branch below) whenever either
    // flag is off, the module hasn't finished its async import yet, or
    // WebGL is unavailable — same fallback shape as the combat/standby
    // topdown branch above.
    const td3d=(combatViewTopdown() && combatCamDirector()) ? getTopdownCV() : null;
    if(td3d){
      td3d.resize(w,h);
      if(typeof td3d.driveMissileTimeline==='function') td3d.driveMissileTimeline(pilotView.weapon.timeline, nowMs);
      td3d.renderOnce(now,getBattleSnapshot());
      ctx.drawImage(topdownCanvas,0,0,w,h);
      const phase=pilotView.weapon.timeline ? activePhase(pilotView.weapon.timeline, nowMs) : null;
      const label=currentLang==='zh'
        ? (phase==='ignite'?'导弹点火':phase==='terminal'?'终末追踪':phase==='impact'?'即将命中':'导弹投放')
        : (phase==='ignite'?'MISSILE IGNITION':phase==='terminal'?'TERMINAL TRACK':phase==='impact'?'IMPACT IMMINENT':'MISSILE DROP');
      drawPilotHmd(ctx,w,h,now,label,'missile');
      drawCockpitFrame(ctx,w,h,now,false,1,cockpitDash());
    }else if(combatViewLegacy()) drawPilotMissilePOV(ctx,w,h,now,pilotView.weapon);
    else drawMissileCine(ctx,w,h,now,elapsed,{lang:currentLang,halley,killed:(!halley||halley.destroyed),locked:!!(halley&&halley.hover)});
  }else if(mode==='ciws'||mode==='offline'){
    drawCiwsCamera(ctx,w,h,now,mode,elapsed);
  }else if(mode==='nukeAuth'){
    if(combatViewLegacy()) drawNukeAuthCamera(ctx,w,h,now,elapsed);
    else drawNukeCine(ctx,w,h,now,elapsed,{lang:currentLang,halley,killed:(!halley||halley.destroyed)});
  }else if(mode==='nemp'){
    drawNempIncomingCamera(ctx,w,h,now,elapsed);
  }else if(mode==='mainGun'){
    // Sync the cam to the real cannon timeline: a slow capital-ship flyby that
    // pans from the thrusters across the main-gun spine while it charges, then
    // cut to the gun cam the instant the cannon fires.
    const fx=getCannonFx();
    const firing=!!(fx && fx.mode==='fire');
    const chargeT=fx ? (fx.mode==='charge'?fx.t:1) : clamp(elapsed/.5,0,1);
    if(!firing && chargeT<1){
      const s3=getShip3D();
      if(s3) s3.draw(ctx,w,h,now,chargeT,currentLang);
      else capitalFlyby.draw(ctx,w,h,now,chargeT,currentLang);
    }else{
      drawMainGunCamera(ctx,w,h,now,elapsed,firing,fx);
    }
  }else{
    drawPilotSpace(ctx,w,h,now,mode==='combat'?1.45:1);
    const extCam=cameraDirector.available() && pilotView.trackSeed>Math.PI;
    if(mode==='launch'){
      if(extCam){
        cameraDirector.drawExternalLaunch(ctx,w,h,now,elapsed,currentLang,pilotView.craft?.type==='b2'?'b2':'f47');
      }else{
        drawPilotDeck(ctx,w,h,easeOut(elapsed),false);
        drawPilotF47Nose(ctx,w,h,elapsed);
        drawPilotHmd(ctx,w,h,now,currentLang==='zh'?'甲板起飞 · 12点方向':'DECK LAUNCH · 12 O CLOCK','launch');
        // V17: console + boot checklist AFTER the HMD pass (drawPilotHmd's
        // space repaint buried anything drawn earlier). The console stages up
        // THROUGH the takeoff roll, finishing at 65% — TARGET LINK sync + the
        // ESTABLISHED flash land after handover to standby.
        drawCockpitFrame(ctx,w,h,now,false,.05+easeOut(elapsed)*.60,cockpitDash());
        drawPilotSystemSequence(ctx,w,h,elapsed,false);
      }
    }else if(mode==='landing'){
      if(extCam){
        cameraDirector.drawExternalLanding(ctx,w,h,now,elapsed,currentLang,pilotView.craft?.type==='b2'?'b2':'f47');
      }else{
        drawPilotDeck(ctx,w,h,elapsed,true);
        drawPilotF47Nose(ctx,w,h,elapsed,true);
        drawPilotHmd(ctx,w,h,now,currentLang==='zh'?'返航着舰 · 捕获航线':'RETURN LANDING · GLIDE SLOPE','landing');
        // V17: console after the HMD pass (same draw-order fix as launch);
        // landing keeps a fully-lit console (boot=1 default), green accent.
        drawCockpitFrame(ctx,w,h,now,true,1,cockpitDash());
        drawPilotSystemSequence(ctx,w,h,elapsed,true);
      }
    }else{
      // combat / standby: HMD v3 cockpit view is default; ?combatview=sc opts
      // into the alternate SC-cockpit-panel HUD (combatHudSC.js).
      if(combatViewScPanel()){
        drawCombatHudSC(ctx,w,h,now,combatHudState(mode));
      }else{
        // V17 draw order fix: drawPilotSpace's near-opaque repaint used to sit
        // ON TOP of the cockpit frame — that's why the old canopy struts read
        // as a ghost "triangle in the background". Space (acts as the frame
        // clear) → console → HMD, with the HMD fading in as the console boots.
        drawPilotSpace(ctx,w,h,now,1.05);
        drawCockpitFrame(ctx,w,h,now,false,cockpitBoot,cockpitDash());
        ctx.save();ctx.globalAlpha=clamp(cockpitBoot*1.6-.3,0,1);
        combatHmdV3.drawCleanCombatHmd(ctx,w,h,now,currentLang==='zh'?'目标链路':'TARGET LINK','combat');
        ctx.restore();
      }
    }
  }
  if(mode==='mosaic'){
    const cell=Math.max(5,Math.floor(Math.min(w,h)/16));
    for(let y=0;y<h;y+=cell) for(let x=0;x<w;x+=cell){
      const v=80+Math.random()*170|0;
      ctx.fillStyle=`rgba(${v},${v+rand(-18,18)|0},${v+rand(-24,24)|0},${.38+Math.random()*.55})`;
      ctx.fillRect(x,y,cell,cell);
    }
    ctx.fillStyle='rgba(255,255,255,.82)';ctx.font="10px 'JetBrains Mono',monospace";ctx.textAlign='center';ctx.fillText('TARGET IMAGE LOST',w*.5,h*.52);
  }
  ctx.restore();
}

/* ===== MAIN LOOP ===== */
let lastT=performance.now();

function frame(now){
  if(document.hidden){lastT=now;requestAnimationFrame(frame);return;}
  try {
    const dt=Math.min(64,now-lastT);lastT=now;
    if(!window.__mouseReady){mx=innerWidth/2;my=innerHeight/2;}
    
    cursorCtl.setPosition(mx,my);
    
    // U28 28g: ramp-in speed 0.05→0.16 — the old rate took the better part
    // of a second to visibly arrive, reading as sluggish rather than a
    // stargate-jump snap. Still lerped (not instant) so it doesn't pop.
    warpIntensity=lerp(warpIntensity,warpTarget,.16);
    backgroundScene.draw(now);
    saturnRenderer?.draw(now*.001,warpIntensity);
    
    ectx.clearRect(0,0,evtCanvas.width,evtCanvas.height);
    const cruise=cruiseModeActive();
    document.body.classList.toggle('combat-mode', !cruise && !!halley && !halley.destroyed);
    updateHalley(dt);
    drawHalley();
    if(!cruise){
      updateEscorts(dt, now);
      updateWeapons(dt);
      drawExplosions(dt);
      drawRadar();
      drawAttitude(now);
      drawShipLiveFeeds(now);
      drawPilotFeed(now);
      updateCombatModule();
    }
    updateTopTelemetry();
    shipRecoil*=.9;
    updateCursorTarget();
    
    // Nuke Full Screen Flash (极致白光致盲特效)
    if(nukeFlash > 0) {
      ectx.fillStyle = `rgba(255,255,255,${nukeFlash})`;
      ectx.fillRect(0,0,evtCanvas.width,evtCanvas.height);
      nukeFlash -= 0.005;
    }
    
    pcx=mx;pcy=my;
  } catch (err) {}
  requestAnimationFrame(frame);
}

resize();resizeEvt();
window.__launchTime = Date.now();
requestAnimationFrame(frame);
// motion-sensitive visitors: no auto-spawned combat; battles stay opt-in via the Command button
if(!REDUCED_MOTION){
  setTimeout(spawnHalley,7000);
  setInterval(()=>{if(!halley&&Math.random()<.6)spawnHalley();}, 30000);
}

/* ===== MARKET DECK ===== */
const marketDeck=initMarketDeck({
  getLang:()=>currentLang,
  getDpr:()=>DPR,
  onPickHotChange:on=>cursorCtl.setHot(on)
});
function updateSignalDeckHud(){
  const deck=document.getElementById('signalDeck');
  if(deck?.querySelector('.private-notebook')) return;
  const lang=currentLang || 'en';
  const zh=lang==='zh';
  const set=(id,text)=>{const el=document.getElementById(id); if(el) el.textContent=text;};
  set('commanderTerminalTitle',zh?'舰长终端':'COMMANDER TERMINAL');
  set('commanderTerminalSeal',zh?'隔离链路':'AIR-GAPPED');
  set('commanderTerminalKicker',zh?'资产甲板':'ASSET DECK');
  set('commanderTerminalStatus',zh?'AFFLATUS 马拉松节点':'AFFLATUS MARATHON NODE');
  set('commanderTerminalHint',zh?'可滚动资产甲板 · 隔离预览':'scrollable asset deck · isolated preview');
  set('commanderTerminalPortA',zh?'授权封存':'AUTH SEALED');
  set('commanderTerminalPortB',zh?'输入总线待命':'INPUT BUS READY');
  set('commanderTerminalPortC',zh?'本地记忆':'LOCAL MEMORY');
}

/* ===== LANGUAGE SWITCH (修复动画重置 Bug) ===== */
function setLang(lang){
  currentLang=lang; try{localStorage.setItem('afflatus-lang',lang);}catch(e){}
  const langMini=document.getElementById('langMiniToggle'); if(langMini) langMini.dataset.active=lang;
  const c=COPY[lang]; document.title=c.title; document.documentElement.lang=c.lang; document.getElementById('langBtn').textContent=c.langBtn;
  updateCommandButton(); updateJumpButton();
  document.getElementById('heroNum').innerHTML=c.heroNum; document.getElementById('heroTitle').innerHTML=c.heroTitle; document.getElementById('heroDesc').textContent=c.heroDesc; document.getElementById('coord').textContent=c.coord; document.getElementById('scrollHint').textContent=c.scrollHint;
  c.sl.forEach((t,i)=>document.getElementById('sl'+i).textContent=t); c.sf.forEach((t,i)=>document.getElementById('sf'+i).textContent=t);
  document.getElementById('s2num').innerHTML=c.s2num; document.getElementById('s2title').innerHTML=c.s2title; document.getElementById('s2desc').textContent=c.s2desc; document.getElementById('chartSub').textContent=c.chartSub;
  marketDeck.updatePeriodUI();
  document.getElementById('s3num').innerHTML=c.s3num; document.getElementById('s3title').innerHTML=c.s3title; document.getElementById('s3desc').textContent=c.s3desc; document.getElementById('footnoteEl').textContent=c.footnote;
  document.getElementById('f1').textContent=c.f1; document.getElementById('f2').textContent=c.f2; document.getElementById('f3').textContent=c.f3;
  applyHudLanguage();
  updateSignalDeckHud();
  const starDistance=document.getElementById('starmapDistance');
  if(starDistance) starDistance.textContent = lang==='zh' ? '离开地球 2738 天' : '2738 days from Earth';
  const terminalLoginBtn=document.getElementById('terminalLoginBtn');
  if(terminalLoginBtn) terminalLoginBtn.textContent = lang==='zh' ? '登录' : 'LOGIN';
  const starmapToggle=document.getElementById('starmapToggle');
  const starmapPanel=document.getElementById('terminalStarMapPanel');
  if(starmapToggle){
    const mapActive=starmapPanel?.classList.contains('active');
    starmapToggle.textContent = mapActive ? (lang==='zh' ? '登录' : 'LOGIN') : (lang==='zh' ? '星图' : 'STAR MAP');
  }
  const terminalTitle=document.querySelector('.notebook-status b');
  if(terminalTitle) terminalTitle.textContent = lang==='zh' ? '舰长终端' : 'Commander Terminal';
  const feed=document.getElementById('battleFeed');
  if(feed){feed.dataset.seeded='';feed.innerHTML='';seedBattleFeed();}
  marketDeck.renderPicks(c.picks);
}
const langBtn=document.getElementById('langBtn');
langBtn.addEventListener('mouseenter',()=>{
  warpTarget=.82;
  cursorCtl.setWarp(true);
  document.body.classList.add('warp-hover');
  // U28 28g: one-shot screen-wide ripple pulse on jump entry (≤400ms, not
  // persistent) — reinforces the "wave" sensation the station master asked
  // for, on top of the faster ramp/stretch above. Same add-then-timeout-
  // remove idiom as the existing body.shake hit-flash elsewhere in this file.
  document.body.classList.remove('warp-pulse'); void document.body.offsetWidth;
  document.body.classList.add('warp-pulse');
  setTimeout(()=>document.body.classList.remove('warp-pulse'),400);
  const hudThrusters=document.getElementById('hudThrusters'); if(hudThrusters) hudThrusters.textContent=HC('ready');
});
langBtn.addEventListener('mouseleave',()=>{
  warpTarget=.18;
  cursorCtl.setWarp(false);
  document.body.classList.remove('warp-hover');
  const hudThrusters=document.getElementById('hudThrusters'); if(hudThrusters) hudThrusters.textContent=HC('armed');
});
let langSetTimer=null;
let langFoldTimer=null;
langBtn.addEventListener('click',event=>{
  event.preventDefault();
  event.stopPropagation();
  clearTimeout(langSetTimer);
  clearTimeout(langFoldTimer);
  document.body.classList.remove('folding');
  void document.body.offsetWidth;
  document.body.classList.add('folding');
  warpTarget=1;
  const nextLang=currentLang==='zh'?'en':'zh';
  langSetTimer=setTimeout(()=>setLang(nextLang),140);
  langFoldTimer=setTimeout(()=>{document.body.classList.remove('folding'); if(!langBtn.matches(':hover')) warpTarget=.18;},540);
});
// U12c (2026-07-11): mobile top-bar EN/CN mini toggle — no separate language
// state, just forwards to the same langBtn click handler above so setLang()
// stays the single source of truth (storage key, full-page text swap, warp
// fold transition all reused as-is).
document.getElementById('langMiniToggle')?.addEventListener('click',event=>{
  event.preventDefault();
  langBtn.click();
});
setLang(currentLang);
const terminalStarMapCtl=initTerminalStarMap({getLang:()=>currentLang});
// U12d (2026-07-11): mobile drops the star-map "upper layer" entirely (perf —
// its rAF draw loop only runs while .terminal-starmap has the 'active' class,
// see terminalStarMap.js) and folds the Private Voyage Log into the Defense
// Module behind a single toggle instead. Deactivating the map on boot (mobile
// only; desktop keeps its default star-map-first behaviour untouched) stops
// that draw loop before it ever starts, not just hides it visually.
if(matchMedia('(max-width:860px)').matches) terminalStarMapCtl?.setMode(false);
const voyageLogToggle=document.getElementById('voyageLogToggle');
voyageLogToggle?.addEventListener('click',(e)=>{
  e.preventDefault();
  e.stopPropagation();
  const opening=!document.body.classList.contains('mobile-log-open');
  document.body.classList.toggle('mobile-log-open',opening);
  const boot=document.getElementById('voyageLogBoot');
  if(opening && boot){
    boot.classList.remove('play');
    void boot.offsetWidth;
    boot.classList.add('play');
  }
});
function pulseVoyageIndicator(){
  const el=document.getElementById('voyagePulse');
  if(!el) return;
  const bearing=Math.round(128 + Math.sin(Date.now()/58000)*4);
  const drift=(1.28 + Math.cos(Date.now()/69000)*0.05).toFixed(2);
  const span=el.querySelector('span');
  if(span) span.textContent = currentLang==='zh'
    ? `离开地球 2738 天 · 航向 ${bearing}° · 航迹 ${drift}G`
    : `2738 DAYS FROM EARTH · BEARING ${bearing}° · COURSE ${drift}G`;
  el.classList.remove('active');
  void el.offsetWidth;
  el.classList.add('active');
}
setTimeout(pulseVoyageIndicator,1800);
setInterval(pulseVoyageIndicator,60000);
