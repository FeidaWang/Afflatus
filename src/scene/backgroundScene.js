import * as THREE from 'three';
import { prepareStarfieldIntro } from './starfieldIntro.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import { canAcquireWebGLContext, createWebGLContextLifecycle, disposeThreeScene } from '../lib/webglLifecycle.js';
import { STARFIELD_LIMITS, clampRotation, dampRotation, createStarfieldGeometry, starfieldBudget } from './starfieldModel.js';

const SURFACE_ID = 'home:orbital-starfield';
const PAUSE_KEY = 'afflatus:starfield-paused:v1';
let instance;

// Replaces the old backgroundScene Canvas2D / Worker renderer. Exactly one
// instance owns #starfield; the combat master no longer drives a background.
export function createBackgroundScene() {
  if (instance) return instance;
  const canvas = document.getElementById('starfield');
  const host = document.getElementById('starfieldViewport');
  const reset = document.getElementById('starfieldReset');
  const pause = document.getElementById('starfieldPause');
  const status = document.getElementById('starfieldStatus');
  const replay = document.getElementById('starfieldReplay');
  if (!canvas || !host) return null;
  const intro = prepareStarfieldIntro(host);
  const coordinator = getRenderBudgetCoordinator();
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const compact = matchMedia('(max-width: 860px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const listen = (target, event, callback, options = {}) => target?.addEventListener(event, callback, { ...options, signal: abort.signal });
  let policy = coordinator.getPolicy({ cost: 'medium', targetFps: 60 });
  let renderer, lifecycle, surface, scene, camera, points, material;
  let raf = 0, lastTime = 0, elapsed = 0, active = false, contextReady = false, disposed = false, failed = false;
  let paused = false;
  try { paused = localStorage.getItem(PAUSE_KEY) === 'true'; } catch {}
  let drag = null;
  let forgeActive = coordinator.getTelemetry().surfaces.some(surface => surface.id === 'home:alphard-forge' && surface.active);
  const rotation = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, hoverYaw: 0, hoverPitch: 0 };
  const staticMode = () => motion.matches || !fine.matches || compact.matches || Boolean(navigator.connection?.saveData);
  const commandMode = () => !document.body.classList.contains('hud-off');
  const zh = () => document.documentElement.lang.toLowerCase().startsWith('zh');
  const canDraw = () => active && contextReady && !staticMode() && !commandMode() && !forgeActive;

  function updateStatus() {
    host.dataset.state = failed ? 'fallback' : staticMode() ? 'static' : commandMode() || !active || forgeActive ? 'offscreen' : paused ? 'paused' : drag?.captured ? 'dragging' : 'idle';
    host.tabIndex = staticMode() || failed ? -1 : 0;
    reset.disabled = pause.disabled = staticMode() || failed || !contextReady;
    replay.disabled = reset.disabled || paused || !canDraw();
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? (zh() ? '继续动态' : 'Resume motion') : (zh() ? '暂停动态' : 'Pause motion');
    const text = failed ? ['Static view · graphics unavailable', '静态视图 · 图形暂不可用']
      : staticMode() ? ['Static view · scrolling stays available', '静态视图 · 可正常纵向滚动']
      : paused ? ['Motion paused · view controls still available', '动态已暂停 · 仍可调整视角']
      : ['Drag to rotate · arrows move · Home resets · Esc exits', '拖拽旋转 · 方向键调整 · Home 重置 · Esc 退出'];
    status.textContent = text[zh() ? 1 : 0];
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; lastTime = 0;
  }
  function finishDrag() {
    const previous = drag;
    drag = null;
    if (previous && host.hasPointerCapture(previous.id)) host.releasePointerCapture(previous.id);
    host.classList.remove('is-dragging');
    updateStatus();
  }
  function fallback() {
    failed = true; contextReady = false; intro.cancel('failure'); stop(); finishDrag();
    document.body.classList.remove('starfield-ready');
    updateStatus();
  }
  function draw() {
    if (!canDraw() || !renderer) return;
    points.rotation.set(rotation.pitch, rotation.yaw, 0);
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uIntro.value = intro.progress();
    try { renderer.render(scene, camera); } catch { fallback(); }
  }
  function tick(now) {
    raf = 0;
    if (!canDraw() || paused) { lastTime = 0; return; }
    const frameMs = lastTime ? now - lastTime : 0;
    // Honour the existing coordinator's target even on high-refresh displays.
    if (lastTime && frameMs < 1000 / policy.targetFps - .75) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(.05, frameMs / 1000);
    lastTime = now; elapsed += dt;
    rotation.yaw = dampRotation(rotation.yaw, clampRotation(rotation.targetYaw + rotation.hoverYaw, 'yaw'), dt);
    rotation.pitch = dampRotation(rotation.pitch, clampRotation(rotation.targetPitch + rotation.hoverPitch, 'pitch'), dt);
    draw();
    if (frameMs) surface.reportFrame(frameMs, { drawCalls: renderer.info.render.calls, triangles: 0 });
    if (canDraw() && !paused) raf = requestAnimationFrame(tick);
  }
  function start() {
    if (raf || !canDraw() || paused) return;
    lastTime = 0; raf = requestAnimationFrame(tick);
  }
  function sync() {
    stop();
    if (paused || staticMode() || commandMode() || !active || forgeActive) intro.cancel('inactive');
    if (staticMode() || commandMode() || !active || forgeActive) {
      finishDrag();
      document.body.classList.remove('starfield-ready');
    } else if (contextReady) {
      if (!paused) intro.begin();
      draw();
      if (contextReady) document.body.classList.add('starfield-ready');
      start();
    }
    updateStatus();
  }
  function resize() {
    if (!renderer || !contextReady) return;
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    const budget = starfieldBudget(policy.qualityTier);
    const dpr = policy.computeDpr(width, height, { minDpr: .75, maxDpr: budget.dpr });
    renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    points.geometry.setDrawRange(0, budget.count);
    material.uniforms.uDpr.value = dpr;
    host.dataset.particles = String(budget.count);
    host.dataset.dpr = dpr.toFixed(2);
    draw();
  }
  function initialize() {
    if (renderer || failed || staticMode() || disposed) return;
    if (!canAcquireWebGLContext(SURFACE_ID)) { fallback(); return; }
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1, .1, 30);
      camera.position.z = 5.8;
      const data = createStarfieldGeometry(4000);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
      geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1));
      geometry.setAttribute('aPhase', new THREE.BufferAttribute(data.phases, 1));
      material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uDpr: { value: 1 }, uIntro: { value: 1 } },
        vertexShader: `attribute float aSize; attribute float aPhase; uniform float uTime; uniform float uDpr; uniform float uIntro;
          varying vec3 vColor; varying float vLight;
          void main(){vColor=color; vLight=.86+.14*sin(uTime*.45+aPhase);
            vec3 p=position*(1.+.45*(1.-uIntro));
            p+=vec3(sin(aPhase),cos(aPhase*1.7),sin(aPhase*2.3))*.3*(1.-uIntro); p.y+=.018*sin(uTime*.22+aPhase);
            vec4 view=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*view;
            gl_PointSize=clamp(aSize*uDpr*8.0/max(1.,-view.z),1.,7.*uDpr);}`,
        fragmentShader: `varying vec3 vColor; varying float vLight;
          void main(){float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard;
            float a=pow(1.-r,1.2)*vLight; gl_FragColor=vec4(vColor,a);}`,
      });
      points = new THREE.Points(geometry, material); scene.add(points);
      contextReady = true;
      lifecycle = createWebGLContextLifecycle({ id: SURFACE_ID, canvas, showFallback: false,
        onLost(){ contextReady=false; intro.cancel('context-loss'); stop(); finishDrag(); document.body.classList.remove('starfield-ready'); status.textContent=zh()?'静态视图 · 正在恢复图形':'Static view · restoring graphics'; },
        onRestore(){ contextReady=true; renderer.resetState(); resize(); sync(); },
        onFallback:fallback,
      });
      if (!lifecycle.canInitialize) { fallback(); return; }
      resize();
    } catch { fallback(); renderer?.dispose(); }
  }
  function moveView(yaw, pitch, immediate = paused) {
    rotation.targetYaw = clampRotation(yaw, 'yaw'); rotation.targetPitch = clampRotation(pitch, 'pitch');
    if (immediate) { rotation.yaw=rotation.targetYaw; rotation.pitch=rotation.targetPitch; draw(); }
    else start();
  }
  listen(host, 'pointerdown', event => {
    if (!canDraw() || event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('a,button,input,select,textarea')) return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:rotation.targetYaw,pitch:rotation.targetPitch,captured:false};
  });
  listen(host, 'pointermove', event => {
    if (!canDraw() || event.pointerType !== 'mouse') return;
    if (drag && drag.id === event.pointerId) {
      const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
      if (!drag.captured && Math.hypot(dx,dy)<STARFIELD_LIMITS.dragThreshold) return;
      if (!drag.captured) { drag.captured=true; host.setPointerCapture(event.pointerId); host.focus({preventScroll:true}); host.classList.add('is-dragging'); updateStatus(); }
      rotation.hoverYaw=rotation.hoverPitch=0;
      moveView(drag.yaw+dx*.004,drag.pitch+dy*.003);
      event.preventDefault();
    } else if (!paused) {
      const r=host.getBoundingClientRect();
      rotation.hoverYaw=((event.clientX-r.left)/r.width-.5)*.06;
      rotation.hoverPitch=((event.clientY-r.top)/r.height-.5)*.04;
    }
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) listen(host,type,finishDrag);
  listen(host,'pointerleave',()=>{rotation.hoverYaw=rotation.hoverPitch=0; if(drag&&!drag.captured) finishDrag();});
  listen(host,'keydown',event=>{
    if (!canDraw()) return;
    const direction={ArrowLeft:[-.09,0],ArrowRight:[.09,0],ArrowUp:[0,-.07],ArrowDown:[0,.07]}[event.key];
    if(direction){event.preventDefault(); rotation.hoverYaw=rotation.hoverPitch=0; moveView(rotation.targetYaw+direction[0],rotation.targetPitch+direction[1]);}
    if(event.key==='Home'){event.preventDefault(); rotation.hoverYaw=rotation.hoverPitch=0; moveView(0,0,true);}
    if(event.key==='Escape'){event.preventDefault(); finishDrag(); rotation.hoverYaw=rotation.hoverPitch=0; moveView(rotation.yaw,rotation.pitch,true); reset.focus({preventScroll:true});}
  });
  listen(host,'afflatus:intro-end',draw);
  listen(replay,'click',()=>{if (canDraw() && !paused) { intro.begin(true); draw(); start(); }});
  listen(reset,'click',()=>{finishDrag(); rotation.hoverYaw=rotation.hoverPitch=0; moveView(0,0,true);});
  listen(pause,'click',()=>{paused=!paused; try{localStorage.setItem(PAUSE_KEY,String(paused));}catch{} sync();});
  listen(window,'afflatus:command-mode',sync);
  listen(window,'afflatus:forge-active',event=>{forgeActive=event.detail.active; sync();});
  for(const query of [fine,compact,motion]) listen(query,'change',()=>{initialize(); resize(); sync();});
  const languageObserver = new MutationObserver(updateStatus);
  languageObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  surface = coordinator.register({ id:SURFACE_ID, element:host, cost:'medium', targetFps:60,
    onResume(){active=true; initialize(); sync();},
    onPause(){active=false; sync();},
    onResize:resize,
    onQualityChange(next){
      const budgetChanged = next.qualityTier !== policy.qualityTier || next.pixelBudget !== policy.pixelBudget;
      policy=next;
      if (budgetChanged) resize();
    },
    onDispose(){disposed=true; stop(); finishDrag(); abort.abort(); languageObserver.disconnect(); lifecycle?.dispose(); if(scene) disposeThreeScene(scene,renderer); document.body.classList.remove('starfield-ready'); instance=null;},
  });
  updateStatus();
  instance={destroy:()=>surface.dispose()};
  listen(window,'pagehide',event=>{if(!event.persisted) instance?.destroy();});
  return instance;
}
