/**
 * Alphard Forge — Baily's beads resolving into the diamond-ring effect.
 *
 * One camera-locked shader owns the complete eclipse sequence: irregular
 * lunar topography breaks the chromosphere into beads, scroll progress closes
 * those apertures one by one, and the final aperture blooms into a white-hot
 * diamond over a layered corona. Keeping the phenomenon in a single draw
 * avoids the alignment drift and particle cost of the previous disc/jet
 * systems. Reduced-motion visitors receive the final, fully resolved frame.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import {
  canAcquireWebGLContext,
  createWebGLContextLifecycle,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ── total-eclipse sequence (camera-locked fullscreen plane) ───────────── */
const NEB_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const ECLIPSE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uForge, uGain, uPulse, uScroll; uniform vec2 uRes;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=mat2(1.62,-1.18,1.18,1.62)*p; a*=0.5; } return v; }
float gaussian(float d,float width){ float q=d/max(width,0.0001); return exp(-q*q); }
void main(){
  float aspect=max(uRes.x/uRes.y,0.01);
  vec2 uv=vUv-0.5;
  uv.x*=aspect;
  float portrait=1.0-smoothstep(0.78,1.25,aspect);
  float moonRadius=mix(0.67,0.48,portrait);
  vec2 moonCenter=vec2(mix(-0.025,0.0,uForge),mix(-0.555,-0.47,portrait));
  vec2 lunar=uv-moonCenter;
  float radius=length(lunar);
  float theta=atan(lunar.y,lunar.x);

  // Irregular lunar relief is strongest at the limb. It opens the narrow
  // valleys through which the photosphere becomes Baily's beads.
  float relief=(noise(vec2(theta*31.0,7.0))-0.5)*0.0065;
  relief+=(noise(vec2(theta*83.0,19.0))-0.5)*0.0025;
  float lunarDistance=radius-(moonRadius+relief);
  float outside=smoothstep(-0.0025,0.0045,lunarDistance);
  float upperLimb=smoothstep(-0.2,0.48,lunar.y/moonRadius);

  // A cold, optically deep sky with fine grain and restrained stellar depth.
  float skyCloud=fbm(uv*1.42+vec2(uTime*0.006,-uTime*0.004));
  vec3 col=mix(vec3(0.0015,0.003,0.009),vec3(0.008,0.028,0.057),skyCloud*0.72);
  vec2 starCell=floor((uv+vec2(3.7,1.9))*185.0);
  float star=step(0.9968,hash(starCell))*pow(hash(starCell+8.3),9.0);
  col+=vec3(0.34,0.48,0.72)*star*outside*0.7;

  float bailyPhase=1.0-smoothstep(0.38,0.72,uForge);
  float diamondPhase=smoothstep(0.42,0.9,uForge);
  float coronaPhase=smoothstep(0.48,0.96,uForge);

  // Structured corona: a tight white inner ring, blue radial streamers and
  // large faint lobes. Scroll reveals it only after the beads begin to close.
  float exterior=max(lunarDistance,0.0);
  float coronaRing=gaussian(lunarDistance,0.0065)*outside;
  float rayNoise=0.34+0.66*pow(0.5+0.5*sin(theta*13.0+fbm(vec2(theta*5.0,uTime*0.018))*5.4),3.0);
  float longRays=exp(-exterior*(7.0+9.0*rayNoise))*outside*upperLimb;
  float polarRays=pow(abs(sin(theta*2.0+0.35)),10.0)*exp(-exterior*3.2)*outside;
  vec3 coronaColor=mix(vec3(0.25,0.48,0.92),vec3(0.92,0.97,1.0),exp(-exterior*18.0));
  col+=coronaColor*(coronaRing*0.88+longRays*(0.08+0.18*rayNoise)+polarRays*0.075)*coronaPhase;

  // Magenta chromosphere and prominences survive around the upper limb while
  // the bead sequence is active, echoing the photographic reference palette.
  float chromosphere=gaussian(lunarDistance,0.0042)*upperLimb;
  float chromaTexture=0.5+0.5*sin(theta*61.0+noise(vec2(theta*27.0,2.0))*5.0);
  float prominence=gaussian(lunarDistance-0.009*(0.35+chromaTexture),0.0055)
    *pow(chromaTexture,5.0)*upperLimb;
  vec3 magenta=vec3(1.0,0.045,0.48);
  col+=magenta*(chromosphere*(0.34+0.6*bailyPhase)+prominence*0.62)*(0.72+0.28*uPulse);

  // Moon silhouette is composited after the atmosphere so no background
  // light leaks through it. Very low-amplitude blue texture keeps the disc
  // from reading as a flat CSS circle on calibrated displays.
  float moonMask=1.0-outside;
  float moonTexture=fbm(lunar*5.8+vec2(14.0,-3.0));
  vec3 moonColor=mix(vec3(0.0002,0.0007,0.002),vec3(0.003,0.009,0.019),moonTexture*0.46);
  col=mix(col,moonColor,moonMask);

  // Nine discrete photospheric apertures close at different scroll thresholds
  // to form the characteristic Baily's-beads cadence rather than a dotted arc.
  float bailyBeads=0.0;
  float bailyHalo=0.0;
  for(int i=0;i<9;i++){
    float fi=float(i);
    float angle=0.42+fi*0.285;
    vec2 radial=vec2(cos(angle),sin(angle));
    vec2 tangent=vec2(-radial.y,radial.x);
    float beadRelief=(noise(vec2(angle*31.0,7.0))-0.5)*0.0065;
    beadRelief+=(noise(vec2(angle*83.0,19.0))-0.5)*0.0025;
    vec2 beadPoint=moonCenter+radial*(moonRadius+beadRelief);
    vec2 q=uv-beadPoint;
    float seed=hash(vec2(fi,4.7));
    float width=mix(0.008,0.025,seed);
    float aperture=exp(-pow(dot(q,tangent)/width,2.0)-pow(dot(q,radial)/0.0062,2.0));
    float fadeAt=0.16+hash(vec2(fi,9.1))*0.37;
    float survives=1.0-smoothstep(fadeAt,fadeAt+0.19,uForge);
    bailyBeads+=aperture*survives;
    bailyHalo+=gaussian(length(q),width*3.6)*survives*(0.22+seed*0.2);
  }
  vec3 photosphere=vec3(1.0,0.965,0.88);
  col+=photosphere*bailyBeads*bailyPhase*(1.4+0.35*uPulse+0.5*uScroll);
  col+=mix(magenta,photosphere,0.72)*bailyHalo*bailyPhase*0.38;

  // The last aperture becomes the diamond: a clipped white core, warm halo
  // and diffraction spikes on four axes. Scroll velocity gives a brief flash
  // without allowing idle animation to pulse aggressively.
  float diamondAngle=1.18;
  vec2 diamondPoint=moonCenter+vec2(cos(diamondAngle),sin(diamondAngle))*moonRadius;
  vec2 dq=uv-diamondPoint;
  float diamondCore=gaussian(length(dq),mix(0.017,0.011,diamondPhase));
  float diamondHalo=gaussian(length(dq),0.068)+0.34*gaussian(length(dq),0.17);
  float spikeH=gaussian(abs(dq.y),0.0028)*exp(-abs(dq.x)*12.0);
  float spikeV=gaussian(abs(dq.x),0.0026)*exp(-abs(dq.y)*10.0);
  vec2 diag=vec2((dq.x+dq.y)*0.7071,(dq.x-dq.y)*0.7071);
  float spikeD=(gaussian(abs(diag.x),0.0032)*exp(-abs(diag.y)*14.0)
    +gaussian(abs(diag.y),0.0032)*exp(-abs(diag.x)*14.0))*0.45;
  float flash=1.0+uScroll*0.72+uPulse*0.12;
  col+=photosphere*diamondCore*diamondPhase*3.1*flash;
  col+=mix(vec3(1.0,0.48,0.22),vec3(0.64,0.82,1.0),diamondPhase)
    *diamondHalo*diamondPhase*0.62*flash;
  col+=vec3(0.82,0.92,1.0)*(spikeH+spikeV+spikeD)*diamondPhase*(0.82+uScroll*0.7);

  // Photographic shoulder, vignette and exposure curve. The fade never drops
  // the focal limb below readable contrast behind the page typography.
  float vignette=1.0-smoothstep(0.35,1.35,length(uv*vec2(0.72,1.0)));
  col*=mix(0.74,1.0,vignette)*(0.82+0.18*uForge)*uGain;
  col=1.0-exp(-col*1.14);
  gl_FragColor=vec4(col,1.0);
}`;

/* ── final pass: subtle chromatic aberration + film grain ───────────────── */
const FINAL = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: 0.0016 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime, uAmt;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 d = (vUv-0.5);
  vec3 c;
  c.r = texture2D(tDiffuse, vUv + d*uAmt).r;
  c.g = texture2D(tDiffuse, vUv).g;
  c.b = texture2D(tDiffuse, vUv - d*uAmt).b;
  c += (h(vUv*uTime*0.0007) - 0.5) * 0.035;     // minimal film grain
  gl_FragColor = vec4(c, 1.0);
}`
};

export function initAlphardForge() {
  const section = document.getElementById('stardrive');
  const canvas = document.getElementById('alphardForge');
  if (!section || !canvas) return null;
  const stageEl = section.querySelector('.stardrive-stage');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderCoordinator = getRenderBudgetCoordinator();
  let renderPolicy = renderCoordinator.getPolicy({ cost: 'high', targetFps: 60 });
  let budgetActive = false;
  let contextReady = true;
  let stopForContext = () => {};
  let resumeAfterContext = () => {};
  // U30 R2, default off (R3 WIP exception — flag-gated visual work doesn't
  // count against the real-device review backlog): ?fx=stage turns on the
  // sticky-scale "stargate" wrapper (styles.css .stardrive.fx-stage rules).
  try { if (/[?&]fx=stage\b/.test(location.search)) section.classList.add('fx-stage'); } catch (e) {}

  // ── bilingual tagline typed out by the scroll ──
  const tagEl = document.getElementById('forgeTagline');
  const CLAUSES = { en: ['Every return', 'is a jump', 'through the dark.'], zh: ['每一份回报，', '都是一次', '穿越深空的跃迁。'] };
  function detectZh() { return (document.documentElement.lang || '').toLowerCase().startsWith('zh'); }
  let curZh = detectZh(), lastTagKey = '';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function renderTagline(p) {
    if (!tagEl) return;
    const lines = CLAUSES[curZh ? 'zh' : 'en'], total = lines.reduce((s, l) => s + l.length, 0);
    const tp = reduce ? 1 : clamp((p - 0.04) / 0.9, 0, 1), shown = Math.round(tp * total);
    const key = (curZh ? 'z' : 'e') + ':' + shown; if (key === lastTagKey) return; lastTagKey = key;
    let remaining = shown, html = '', caretDone = false;
    for (const line of lines) {
      const take = clamp(remaining, 0, line.length); remaining -= take;
      const caret = (!caretDone && take < line.length && tp > 0 && tp < 1) ? '<i class="tw-cur"></i>' : ''; if (caret) caretDone = true;
      html += '<span class="tw-line">' + esc(line.slice(0, take)) + caret + '</span>';
    }
    tagEl.innerHTML = html;
  }
  const languageObserver = new MutationObserver(() => { curZh = detectZh(); lastTagKey = ''; });
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  const sv0 = document.getElementById('sv0');
  const retPct = Math.abs(parseFloat(sv0?.dataset.counter || '38.66')) || 38.66;
  const uGain = clamp(0.9 + retPct / 300, 0.85, 1.3);

  // ── renderer ──
  let renderer;
  if (!canAcquireWebGLContext('home:alphard-forge')) return null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  const webglLifecycle = createWebGLContextLifecycle({
    id: 'home:alphard-forge',
    canvas,
    onLost() {
      contextReady = false;
      stopForContext();
    },
    onRestore() {
      renderer.resetState?.();
      contextReady = true;
      size();
      render(performance.now());
      resumeAfterContext();
    },
    onFallback() {
      contextReady = false;
      stopForContext();
    },
  });
  if (!webglLifecycle.canInitialize) {
    languageObserver.disconnect();
    renderer.dispose();
    renderer.forceContextLoss?.();
    return null;
  }
  renderer.setClearColor(0x010309, 1);

  const scene = new THREE.Scene();
  const FOV = 45, Z0 = 150;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);
  camera.position.set(0, 0, Z0);
  scene.add(camera);

  // A single fullscreen surface keeps the lunar edge, corona and diamonds in
  // perfect registration at every aspect ratio and costs one scene draw call.
  const eclipseUniforms = { uTime: { value: 0 }, uForge: { value: 0 }, uGain: { value: uGain }, uPulse: { value: 0 }, uScroll: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
  const eclipsePlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({ vertexShader: NEB_VERT, fragmentShader: ECLIPSE_FRAG, uniforms: eclipseUniforms, depthTest: false, depthWrite: false, fog: false }));
  eclipsePlane.position.z = -1200;
  camera.add(eclipsePlane);

  // ── post-processing ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Thresholded bloom is reserved for the photospheric apertures and final
  // diamond; the dark lunar surface and fine chromosphere stay structured.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.04, 0.82, 0.46);
  composer.addPass(bloom);
  const finalPass = new ShaderPass(FINAL); finalPass.renderToScreen = true; composer.addPass(finalPass);

  let W = 1, H = 1;
  function size() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    const dpr = renderPolicy.computeDpr(W, H, { minDpr: 0.6, maxDpr: 2 });
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    bloom.setSize(W * dpr, H * dpr);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    eclipseUniforms.uRes.value.set(W, H);
    // size the camera-locked eclipse plane to fill the frustum at its depth
    const dist = Z0 - eclipsePlane.position.z; // camera local z = -1200 → dist 1350
    const fh = 2 * Math.tan((FOV * Math.PI / 180) / 2) * dist, fw = fh * camera.aspect;
    eclipsePlane.scale.set(fw, fh, 1);
  }

  // parallax
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  function onMove(e) { tmx = (e.clientX / innerWidth - 0.5); tmy = (e.clientY / innerHeight - 0.5); }

  // Scroll-linked energy ramp is sampled inside the rAF loop; the scroll
  // handler never performs WebGL work.
  let lastScrollY = window.scrollY || 0, scrollVel = 0;

  // scroll progress + pin. The pin itself (keeping the stage visually fixed
  // while its 200vh wrapper scrolls past) is handled by a CSS scroll-driven
  // animation (see styles.css "@supports (animation-timeline: view())") on
  // browsers that support it — classList toggling + the scroll listener below
  // are skipped there entirely. `p` (0..1) is still computed here either way:
  // it feeds the WebGL uniforms (dolly/brightness) and tagline typing, which
  // CSS can't drive on its own.
  // Keep a single pin implementation. The former CSS view-timeline animation
  // translated the stage by 100svh and created a full blank viewport before
  // the jump point. This rAF loop already samples the section geometry for
  // --forge, so the existing fixed/end class fallback adds no extra listener.
  const cssPin = false;
  // 2026-07-16 (station-master, live-inspected via devtools): the stage is
  // exactly 100vh tall, same as the viewport, so it starts appearing at the
  // very first pixel of scroll (its top is always vh below the wrapper's
  // top) and is ALREADY ~95%+ on-screen by the time the wrapper's own top
  // reaches the viewport top -- which is the old `-rect.top` zero point.
  // Forge stayed clamped at 0 for that whole entrance (a full hero-height
  // of scroll, since hero and the wrapper are the same height here), so the
  // user was looking at an almost-fully-visible but still fully-dim stage
  // for a stretch that reads as "empty background, nothing happening" --
  // exactly the reported gap. Old formula only counted the post-entrance
  // dwell (rect.top: 0 -> -100vh). New formula counts the whole journey a
  // 100vh-tall stage makes through a 100vh viewport (rect.top: vh -> -vh,
  // a 200vh span that equals the wrapper's own full height), so forge
  // starts leaving 0 as soon as the stage is visible at all, not once
  // it's already nearly filled the screen.
  function progress() {
    if (reduce) return 1;
    const rect = section.getBoundingClientRect(), vh = window.innerHeight;
    if (stageEl && !cssPin) { const ended = rect.bottom < vh; stageEl.classList.toggle('pin-fixed', rect.top <= 0 && rect.bottom >= vh && !ended); stageEl.classList.toggle('pin-end', ended); }
    if (rect.height <= 0) return 0; return clamp((vh - rect.top) / rect.height, 0, 1);
  }

  function render(t) {
    const p = progress();
    section.style.setProperty('--forge', p.toFixed(4));
    renderTagline(p);
    const tm = t * 0.001;
    // scroll speed (rAF-sampled delta, lerped) → flare intensity; decays back
    // to the resting uPulse breathing cycle when scrolling stops.
    const sy = window.scrollY || window.pageYOffset || 0;
    const rawVel = Math.min(Math.abs(sy - lastScrollY), 80); lastScrollY = sy;
    scrollVel += (rawVel - scrollVel) * 0.15;
    const uScroll = clamp(scrollVel / 26, 0, 1);
    eclipseUniforms.uTime.value = tm; eclipseUniforms.uForge.value = p; eclipseUniforms.uScroll.value = uScroll;
    eclipseUniforms.uPulse.value = 0.5 + 0.5 * Math.sin(tm * (Math.PI * 2 / 7)); // slow atmospheric shimmer
    finalPass.uniforms.uTime.value = t;
    // parallax + scroll dolly
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    camera.position.x = mx * 6; camera.position.y = -my * 6;
    camera.position.z = lerp(Z0, Z0 * 0.62, p);
    camera.lookAt(0, 0, 0);
    composer.render();
  }

  size();
  if (reduce) {
    eclipseUniforms.uForge.value = 1; renderTagline(1); render(0);
    const reducedSurface = renderCoordinator.register({
      id: 'home:alphard-forge',
      element: section,
      cost: 'high',
      targetFps: 60,
      onResize() { size(); render(0); },
      onQualityChange(nextPolicy) { renderPolicy = nextPolicy; },
      onDispose() {
        webglLifecycle.dispose();
        composer.dispose?.();
        disposeThreeScene(scene, renderer);
      },
    });
    return {
      destroy() {
        languageObserver.disconnect();
        reducedSurface.dispose();
      },
    };
  }

  section.classList.add('is-live'); size();
  let running = false, raf = 0, loopLastT = 0, renderSurface = null;
  function loop(t) {
    const frameMs = loopLastT ? t - loopLastT : 0;
    loopLastT = t;
    render(t);
    renderSurface?.reportFrame(frameMs);
    if (running) raf = requestAnimationFrame(loop);
  }
  function start() {
    if (!running && contextReady) {
      running = true;
      loopLastT = 0;
      raf = requestAnimationFrame(loop);
    }
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
  stopForContext = stop;
  resumeAfterContext = () => { if (budgetActive) start(); };
  // only needed to keep .pin-fixed/.pin-end in sync while the rAF loop isn't
  // running — moot when cssPin is true, since progress() no longer touches
  // those classes at all in that branch.
  const onScroll = () => { if (!running) progress(); };
  if (!cssPin) addEventListener('scroll', onScroll, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
  render(performance.now());
  renderSurface = renderCoordinator.register({
    id: 'home:alphard-forge',
    element: section,
    cost: 'high',
    targetFps: 60,
    onResume() {
      budgetActive = true;
      start();
    },
    onPause() {
      budgetActive = false;
      stop();
    },
    onResize() {
      size();
      if (!running) render(performance.now());
    },
    onQualityChange(nextPolicy) {
      renderPolicy = nextPolicy;
    },
    onDispose() {
      webglLifecycle.dispose();
      composer.dispose?.();
      disposeThreeScene(scene, renderer);
    },
  });

  return {
    destroy() {
      stop();
      if (!cssPin) removeEventListener('scroll', onScroll);
      removeEventListener('pointermove', onMove);
      languageObserver.disconnect();
      renderSurface.dispose();
    },
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAlphardForge, { once: true });
else initAlphardForge();
