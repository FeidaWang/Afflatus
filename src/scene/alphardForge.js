/**
 * Alphard Forge — Baily's beads resolving into the diamond-ring effect.
 *
 * One camera-locked shader owns the complete eclipse sequence: analytically
 * anti-aliased lunar geometry keeps the silhouette perfectly circular while
 * independent photospheric apertures resolve into Baily's beads and a final
 * white-hot diamond over a layered corona. Keeping everything in a single draw
 * avoids the alignment drift and particle cost of the previous disc/jet
 * systems. Reduced-motion visitors receive the final, fully resolved frame.
 */
import * as THREE from 'three';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import {
  canAcquireWebGLContext,
  createWebGLContextLifecycle,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / Math.max(b - a, 0.0001), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ── total-eclipse sequence (camera-locked fullscreen plane) ───────────── */
const NEB_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const ECLIPSE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uForge, uGain, uPulse, uScroll; uniform vec2 uRes;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=mat2(1.62,-1.18,1.18,1.62)*p; a*=0.5; } return v; }
float gaussian(float d,float width){ float q=d/max(width,0.0001); return exp(-q*q); }
float angleDistance(float a,float b){ return abs(atan(sin(a-b),cos(a-b))); }
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

  float pixel=1.0/max(uRes.y,1.0);

  // Exact analytic circle: no angular noise is allowed to displace the lunar
  // silhouette. Resolution-aware smoothstep gives a stable, sub-pixel limb.
  float lunarDistance=radius-moonRadius;
  float limbAA=max(pixel*1.35,0.00042);
  float outside=smoothstep(-limbAA,limbAA,lunarDistance);
  float upperLimb=smoothstep(-0.12,0.34,lunar.y/moonRadius);

  // This surface deliberately has no private sky. Transparent pixels expose
  // the fixed homepage starfield, shared with the relativistic black hole.
  vec3 col=vec3(0.0);

  float bailyPhase=1.0-smoothstep(0.36,0.72,uForge);
  float diamondPhase=smoothstep(0.2,0.74,uForge);
  float coronaPhase=smoothstep(0.16,0.76,uForge);

  // Physically calm corona: a sub-pixel white limb, diffuse electron-scattering
  // halo and a few broad, fixed streamers. There are deliberately no repeating
  // sine spikes or animated angular warps that could read as vines or a HUD arc.
  float exterior=max(lunarDistance,0.0);
  float coronaRing=gaussian(lunarDistance,max(pixel*1.45,0.0011))*outside;
  float innerCorona=exp(-exterior*26.0)*outside;
  float outerCorona=exp(-exterior*5.4)*outside;
  float equatorialFans=pow(abs(cos(theta-0.035)),8.0)*exp(-exterior*3.8)*outside;
  float polarFans=pow(abs(sin(theta+0.08)),16.0)*exp(-exterior*6.8)*outside;
  float sidePlumes=(gaussian(angleDistance(theta,0.2),0.13)
    +gaussian(angleDistance(theta,2.92),0.16))*exp(-exterior*4.4)*outside;
  float crownPlume=gaussian(angleDistance(theta,1.58),0.24)*exp(-exterior*3.5)*outside;
  float coronaSignal=coronaPhase*(coronaRing*1.12+innerCorona*0.27
    +outerCorona*0.072+equatorialFans*0.15+polarFans*0.06
    +sidePlumes*0.075+crownPlume*0.055);
  vec3 coronaColor=mix(vec3(0.34,0.52,0.9),vec3(0.97,0.985,1.0),exp(-exterior*31.0));
  col+=coronaColor*coronaSignal;

  // A restrained, continuous H-alpha chromosphere sits on the exact limb.
  // It never modulates silhouette geometry, so the visible edge stays smooth.
  float chromosphere=gaussian(lunarDistance,max(pixel*1.2,0.00072))*upperLimb;
  float chromaSignal=chromosphere*(0.09+0.15*bailyPhase)*(0.98+0.02*uPulse);
  vec3 magenta=vec3(1.0,0.035,0.28);
  col+=magenta*chromaSignal;

  // Moon silhouette is composited after the atmosphere so no background
  // light leaks through it. Very low-amplitude blue texture keeps the disc
  // from reading as a flat CSS circle on calibrated displays.
  float moonMask=1.0-outside;
  float moonTexture=fbm(lunar*8.4+vec2(14.0,-3.0));
  float earthshine=(0.22+0.78*smoothstep(-0.45,0.78,lunar.y/moonRadius))*moonTexture;
  vec3 moonColor=mix(vec3(0.00008,0.0003,0.0009),vec3(0.0022,0.0065,0.014),earthshine*0.34);
  col=mix(col,moonColor,moonMask);

  // Seven independent photospheric apertures cluster around final contact.
  // They sit on the perfect circle and never perturb the lunar silhouette.
  float bailyBeads=0.0;
  float bailyHalo=0.0;
  for(int i=0;i<7;i++){
    float fi=float(i);
    float seed=hash(vec2(fi,4.7));
    float angle=0.78+fi*0.2+(seed-0.5)*0.036;
    vec2 radial=vec2(cos(angle),sin(angle));
    vec2 tangent=vec2(-radial.y,radial.x);
    vec2 beadPoint=moonCenter+radial*moonRadius;
    vec2 q=uv-beadPoint;
    float width=mix(0.0038,0.0092,seed);
    float aperture=exp(-pow(dot(q,tangent)/width,2.0)
      -pow(dot(q,radial)/max(0.00145,pixel*1.45),2.0));
    float fadeAt=0.12+hash(vec2(fi,9.1))*0.4;
    float survives=1.0-smoothstep(fadeAt,fadeAt+0.15,uForge);
    bailyBeads+=aperture*survives;
    bailyHalo+=gaussian(length(q),width*2.8)*survives*(0.12+seed*0.11);
  }
  vec3 photosphere=vec3(1.0,0.965,0.88);
  float beadSignal=bailyBeads*bailyPhase;
  float beadGlow=bailyHalo*bailyPhase;
  col+=photosphere*beadSignal*(2.15+0.12*uPulse+0.34*uScroll);
  col+=mix(vec3(1.0,0.42,0.2),photosphere,0.72)*beadGlow*0.3;

  // The last aperture becomes the diamond: a clipped white core, warm halo
  // and diffraction spikes on four axes. Scroll velocity gives a brief flash
  // without allowing idle animation to pulse aggressively.
  float diamondAngle=1.32;
  vec2 diamondPoint=moonCenter+vec2(cos(diamondAngle),sin(diamondAngle))*moonRadius;
  vec2 dq=uv-diamondPoint;
  float diamondCore=gaussian(length(dq),mix(0.0105,0.0066,diamondPhase));
  float diamondHot=gaussian(length(dq),0.023);
  float diamondHalo=gaussian(length(dq),0.06)+0.2*gaussian(length(dq),0.16);
  float spikeH=gaussian(abs(dq.y),max(pixel*0.88,0.00056))*exp(-abs(dq.x)*7.6);
  float spikeV=gaussian(abs(dq.x),max(pixel*0.88,0.00056))*exp(-abs(dq.y)*6.3);
  vec2 diag=vec2((dq.x+dq.y)*0.7071,(dq.x-dq.y)*0.7071);
  float spikeD=(gaussian(abs(diag.x),max(pixel*1.25,0.00085))*exp(-abs(diag.y)*10.5)
    +gaussian(abs(diag.y),max(pixel*1.25,0.00085))*exp(-abs(diag.x)*10.5))*0.22;
  float flash=1.0+uScroll*0.46+uPulse*0.045;
  col+=photosphere*(diamondCore*4.5+diamondHot*0.9)*diamondPhase*flash;
  col+=mix(vec3(1.0,0.56,0.28),vec3(0.62,0.8,1.0),diamondPhase)
    *diamondHalo*diamondPhase*0.62*flash;
  col+=vec3(0.84,0.93,1.0)*(spikeH+spikeV+spikeD)*diamondPhase*(0.62+uScroll*0.42);

  // Analytic glow replaces the former multi-resolution bloom chain, preserving
  // a sharp one-pixel lunar edge while keeping the diamond photographically hot.
  col*=(0.88+0.12*uForge)*uGain;
  col=1.0-exp(-col*1.14);
  float lightAlpha=clamp(coronaSignal*2.45+chromaSignal*1.7+beadSignal*2.3
    +beadGlow*0.62+diamondPhase*(diamondCore*4.5+diamondHot*1.25+diamondHalo*1.05
    +spikeH*0.42+spikeV*0.42+spikeD*0.3),0.0,0.98);
  float celestialAlpha=max(moonMask*0.985,lightAlpha);
  gl_FragColor=vec4(col,celestialAlpha);
}`;

export function initAlphardForge() {
  const section = document.getElementById('stardrive');
  const canvas = document.getElementById('alphardForge');
  if (!section || !canvas) return null;
  const stageEl = section.querySelector('.stardrive-stage');
  const blackHoleStage = document.getElementById('blackhole-stage');
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
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' }); }
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
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const FOV = 45, Z0 = 150;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);
  camera.position.set(0, 0, Z0);
  scene.add(camera);

  // A single fullscreen surface keeps the lunar edge, corona and diamonds in
  // perfect registration at every aspect ratio and costs one scene draw call.
  const eclipseUniforms = { uForge: { value: 0 }, uGain: { value: uGain }, uPulse: { value: 0 }, uScroll: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
  const eclipsePlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    // Blending stays disabled because this is the only draw: writing straight
    // RGBA into a non-premultiplied transparent canvas avoids a second alpha
    // multiplication when the browser composites it over #starfield.
    new THREE.ShaderMaterial({ vertexShader: NEB_VERT, fragmentShader: ECLIPSE_FRAG, uniforms: eclipseUniforms, depthTest: false, depthWrite: false, fog: false }));
  eclipsePlane.position.z = -1200;
  camera.add(eclipsePlane);

  let W = 1, H = 1;
  function size() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    // A one-draw analytic eclipse can afford full Retina density on the high
    // tier. Balanced/low tiers still honor the shared thermal pixel budget.
    const nativeDpr = Math.max(1, window.devicePixelRatio || 1);
    const dpr = renderPolicy.qualityTier === 'high'
      ? Math.min(nativeDpr, 2)
      : renderPolicy.computeDpr(W, H, {
        minDpr: 1,
        maxDpr: renderPolicy.qualityTier === 'low' ? 1.35 : 1.7,
      });
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    eclipseUniforms.uRes.value.set(W * dpr, H * dpr);
    // size the camera-locked eclipse plane to fill the frustum at its depth
    const dist = Z0 - eclipsePlane.position.z; // camera local z = -1200 → dist 1350
    const fh = 2 * Math.tan((FOV * Math.PI / 180) / 2) * dist, fw = fh * camera.aspect;
    eclipsePlane.scale.set(fw, fh, 1);
  }

  // Scroll-linked energy ramp is sampled inside the rAF loop; the scroll
  // handler never performs WebGL work.
  let lastScrollY = window.scrollY || 0, scrollVel = 0;
  let lastBlackHoleOpacity = -1;
  function blendSharedUniverse(p) {
    if (!blackHoleStage) return;
    // The black hole and eclipse both sit over #starfield. Cross-fading only
    // the celestial plates preserves one continuous universe without letting
    // the two high-energy phenomena bleach each other out.
    const opacity = 1 - smoothstep(0.08, 0.46, p);
    if (Math.abs(opacity - lastBlackHoleOpacity) < 0.004) return;
    blackHoleStage.style.opacity = opacity.toFixed(3);
    lastBlackHoleOpacity = opacity;
  }

  // The stage is pinned with position:sticky and never escapes its section.
  // Earlier fixed-position class toggles could survive a first-load lifecycle
  // pause and cover later content. JS now owns only visual progress; CSS owns
  // layout, so a suspended render loop cannot leave an overlay behind.
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
    if (rect.height <= 0) return 0; return clamp((vh - rect.top) / rect.height, 0, 1);
  }

  function render(t) {
    const p = progress();
    section.style.setProperty('--forge', p.toFixed(4));
    blendSharedUniverse(p);
    renderTagline(p);
    const tm = t * 0.001;
    // scroll speed (rAF-sampled delta, lerped) → flare intensity; decays back
    // to the resting uPulse breathing cycle when scrolling stops.
    const sy = window.scrollY || window.pageYOffset || 0;
    const rawVel = Math.min(Math.abs(sy - lastScrollY), 80); lastScrollY = sy;
    scrollVel += (rawVel - scrollVel) * 0.15;
    const uScroll = clamp(scrollVel / 26, 0, 1);
    eclipseUniforms.uForge.value = p; eclipseUniforms.uScroll.value = uScroll;
    eclipseUniforms.uPulse.value = 0.5 + 0.5 * Math.sin(tm * (Math.PI * 2 / 7)); // slow atmospheric shimmer
    renderer.render(scene, camera);
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
        disposeThreeScene(scene, renderer);
      },
    });
    return {
      destroy() {
        languageObserver.disconnect();
        blackHoleStage?.style.removeProperty('opacity');
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
      disposeThreeScene(scene, renderer);
    },
  });

  return {
    destroy() {
      stop();
      languageObserver.disconnect();
      blackHoleStage?.style.removeProperty('opacity');
      section.classList.remove('is-live', 'has-motion-shell');
      stageEl?.classList.remove('pin-fixed', 'pin-end');
      section.style.removeProperty('--forge');
      renderSurface.dispose();
    },
  };
}
