/**
 * Alphard Forge — a black-hole-adjacent celestial engine (Three.js).
 *
 * A camera-locked shader combines three related phenomena: a differentially
 * rotating accretion disc, gravitational redshift from white-hot emission to
 * amber/red escape light, and bipolar relativistic jets with a collimated core
 * and magnetic sheath. GPU point clouds add volumetric disc matter and jet
 * knots; a sparse lensed star field supplies depth. UnrealBloomPass and the
 * restrained final pass preserve the site's cinematic treatment. Scroll
 * progress (--forge / uForge) dollies the observer inward and increases the
 * energy state. Reduced-motion visitors receive one fully resolved frame.
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

/* ── black-hole phenomena (camera-locked fullscreen plane) ─────────────── */
const NEB_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const CELESTIAL_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uForge, uGain, uPulse, uScroll; uniform vec2 uRes;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
mat2 rot(float a){ float s=sin(a),c=cos(a); return mat2(c,-s,s,c); }
void main(){
  vec2 uv=vUv-0.5;
  uv.x*=uRes.x/uRes.y;
  float zoom=mix(1.72,0.82,uForge);
  uv*=zoom;
  float r=length(uv);

  // Lensed background: starlight bends more strongly near the photon sphere.
  vec2 lensUv=uv*(1.0+0.07/(r*r+0.025));
  vec2 starCell=floor(lensUv*210.0);
  float starSeed=hash(starCell);
  float stars=step(0.9955,starSeed)*pow(hash(starCell+9.4),7.0);
  float dust=fbm(rot(uTime*0.012)*lensUv*1.5+vec2(7.0,2.0));
  vec3 col=vec3(0.002,0.003,0.007);
  col+=vec3(0.18,0.24,0.34)*stars*(1.0-smoothstep(0.18,1.55,r));
  col+=mix(vec3(0.025,0.012,0.018),vec3(0.018,0.035,0.055),dust)*dust*0.34;

  // Accretion disc: a thin tilted annulus with faster inner differential
  // rotation. Spiral compression lanes and turbulence provide hot matter.
  float discWarp=0.012*sin(uv.x*12.0-uTime*0.45)*(1.0-smoothstep(0.2,1.2,abs(uv.x)));
  vec2 discUv=vec2(uv.x,(uv.y+discWarp)/0.225);
  float rho=length(discUv);
  float phi=atan(discUv.y,discUv.x);
  float omega=0.32+1.45/(rho+0.13);
  float spiral=0.5+0.5*sin(phi*7.0-log(rho+0.035)*12.0-uTime*omega*1.8);
  float fine=0.5+0.5*sin(phi*23.0-log(rho+0.03)*34.0-uTime*omega*3.2);
  float turbulence=fbm(vec2(phi*2.8-uTime*omega,rho*15.0+uTime*0.08));
  float annulus=smoothstep(0.155,0.205,rho)*(1.0-smoothstep(0.28,1.34,rho));
  float accretion=annulus*(0.34+0.38*spiral+0.18*fine+0.28*turbulence);

  // Gravitational redshift: white-hot light starts near the inner edge and
  // loses energy along the escape path, grading through amber into deep red.
  float escapeShift=smoothstep(0.2,1.25,rho);
  vec3 whiteHot=vec3(1.0,0.97,0.86);
  vec3 amber=vec3(1.0,0.39,0.075);
  vec3 redshift=vec3(0.72,0.025,0.018);
  vec3 discColor=mix(whiteHot,amber,smoothstep(0.18,0.55,rho));
  discColor=mix(discColor,redshift,escapeShift*0.9);

  // Relativistic beaming: approaching material is brighter and slightly
  // bluer; the receding side reinforces the observed red wing.
  float velocitySide=cos(phi);
  float approaching=smoothstep(-0.05,0.92,velocitySide);
  float receding=smoothstep(-0.05,0.92,-velocitySide);
  discColor=mix(discColor,vec3(0.82,0.94,1.0),approaching*(1.0-escapeShift)*0.72);
  discColor=mix(discColor,vec3(0.48,0.008,0.014),receding*0.42);
  float beaming=0.48+1.18*approaching+0.18*uScroll;
  col+=discColor*accretion*beaming*(1.0+0.22*uPulse);

  // Gravitational lensing folds the far side of the disc above and below the
  // event horizon instead of leaving a simple flat ellipse.
  float lensRadius=length(vec2(uv.x,uv.y/0.62));
  float upperArc=exp(-pow((lensRadius-0.225)/0.022,2.0))*smoothstep(-0.04,0.18,uv.y);
  float lowerArc=exp(-pow((lensRadius-0.218)/0.027,2.0))*(1.0-smoothstep(-0.16,0.08,uv.y))*0.62;
  col+=mix(whiteHot,amber,smoothstep(0.0,0.22,abs(uv.y)))*(upperArc+lowerArc)*(0.82+0.28*uPulse);

  // Bipolar relativistic jets: a white-hot spine, cyan magnetic collimation
  // and a red-shifted outer sheath along the black hole's rotation axis.
  float polar=abs(uv.y);
  float jetGate=smoothstep(0.17,0.23,polar)*(1.0-smoothstep(0.3,1.5,polar));
  float cone=0.012+polar*0.052;
  float axisOffset=abs(uv.x+sin(uv.y*21.0-uTime*2.0)*0.006);
  float jetCore=exp(-pow(axisOffset/max(0.006,cone*0.34),2.0)*2.8);
  float jetSheath=exp(-pow(axisOffset/max(0.012,cone*1.9),2.0)*1.7);
  float jetKnots=0.58+0.42*sin(polar*37.0-uTime*(5.2+uScroll*2.5)+dust*5.0);
  float jetEscape=smoothstep(0.18,1.3,polar);
  vec3 jetColor=mix(vec3(0.82,0.98,1.0),vec3(0.08,0.58,1.0),0.48);
  jetColor=mix(jetColor,vec3(0.72,0.035,0.18),jetEscape*0.7);
  col+=whiteHot*jetCore*jetGate*(1.15+uScroll*0.65)*jetKnots;
  col+=jetColor*jetSheath*jetGate*(0.5+0.38*uForge)*(0.72+0.28*jetKnots);

  // Photon ring and true dark event horizon are composited last so neither
  // disc nor jet light can leak through the singularity silhouette.
  float photonRing=exp(-pow((r-0.158)/0.012,2.0));
  float nearShadow=1.0-smoothstep(0.145,0.235,r);
  float horizon=1.0-smoothstep(0.132,0.151,r);
  col*=1.0-nearShadow*0.7;
  col+=mix(whiteHot,amber,0.38)*photonRing*(1.05+0.24*uPulse);
  col=mix(col,vec3(0.00015,0.0002,0.00035),horizon);

  float vignette=1.0-smoothstep(0.2,1.58,r);
  col*=vignette*(0.72+0.48*uForge)*uGain;
  gl_FragColor=vec4(col,1.0);
}`;

/* ── accretion matter (GPU-animated points) ─────────────────────────────── */
const PT_VERT = `
attribute float aSpeed; attribute float aSize; attribute float aSeed;
uniform float uTime; varying float vRadius; varying float vDoppler;
void main(){
  float ang = -uTime * aSpeed;
  float c=cos(ang), s=sin(ang);
  vec3 p = position;
  p.xy = mat2(c,-s,s,c) * p.xy;
  p.z += sin(uTime*1.7*aSpeed+aSeed)*1.4;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_PointSize = aSize * (260.0 / max(1.0,-mv.z));
  gl_Position = projectionMatrix * mv;
  vRadius=clamp((length(position.xy)-18.0)/142.0,0.0,1.0);
  vDoppler=0.5+0.5*p.x/max(1.0,length(p.xy));
}`;
const PT_FRAG = `
precision mediump float; varying float vRadius; varying float vDoppler;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0-smoothstep(0.0,0.5,d);
  vec3 c=mix(vec3(1.0,0.95,0.8),vec3(1.0,0.24,0.035),smoothstep(0.08,0.62,vRadius));
  c=mix(c,vec3(0.56,0.012,0.018),smoothstep(0.54,1.0,vRadius));
  c=mix(c,vec3(0.76,0.94,1.0),smoothstep(0.62,1.0,vDoppler)*(1.0-vRadius)*0.72);
  gl_FragColor = vec4(c,a*(0.22+0.24*(1.0-vRadius)));
}`;

/* ── bipolar relativistic jet knots ────────────────────────────────────── */
const JET_VERT = `
attribute float aSpeed; attribute float aSize; attribute float aSeed; attribute float aSide;
uniform float uTime; varying float vLife; varying float vCore;
void main(){
  float travel=mod(position.y+uTime*aSpeed,210.0);
  vec3 p=position;
  p.y=aSide*(20.0+travel);
  float spread=1.0+travel*0.028;
  p.x=position.x*spread+sin(uTime*2.1+aSeed)*spread*0.34;
  p.z=position.z*spread+cos(uTime*1.7+aSeed*1.3)*spread*0.34;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_PointSize=aSize*(250.0/max(1.0,-mv.z));
  gl_Position=projectionMatrix*mv;
  vLife=travel/210.0;
  vCore=1.0-clamp(length(position.xz)/3.6,0.0,1.0);
}`;
const JET_FRAG = `
precision mediump float; varying float vLife; varying float vCore;
void main(){
  float d=length(gl_PointCoord-0.5);
  float a=(1.0-smoothstep(0.0,0.5,d))*(1.0-smoothstep(0.82,1.0,vLife));
  vec3 cyan=vec3(0.28,0.86,1.0), hot=vec3(0.98,0.99,1.0), shifted=vec3(0.78,0.035,0.22);
  vec3 c=mix(cyan,hot,vCore);
  c=mix(c,shifted,smoothstep(0.48,1.0,vLife)*0.72);
  gl_FragColor=vec4(c,a*(0.28+0.46*vCore));
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
  renderer.setClearColor(0x04060a, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x061018, 0.0016);
  const FOV = 45, Z0 = 150;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);
  camera.position.set(0, 0, Z0);
  scene.add(camera);

  // Celestial plate locked to the camera (far background, always fills the view).
  const nebUniforms = { uTime: { value: 0 }, uForge: { value: 0 }, uGain: { value: uGain }, uPulse: { value: 0 }, uScroll: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
  const nebPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({ vertexShader: NEB_VERT, fragmentShader: CELESTIAL_FRAG, uniforms: nebUniforms, depthTest: false, depthWrite: false, fog: false }));
  nebPlane.position.z = -1200; nebPlane.renderOrder = -10; camera.add(nebPlane);

  // ── volumetric accretion matter ──
  const PN = 4200;
  const pos = new Float32Array(PN * 3), spd = new Float32Array(PN), siz = new Float32Array(PN), sed = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const rr = 18 + Math.pow(Math.random(), 0.72) * 142;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = Math.sin(a) * rr;
    pos[i * 3 + 2] = (Math.random() - 0.5) * (1.2 + rr * 0.035);
    spd[i] = 0.11 + 12 / (rr + 10); // Kepler-like differential rotation.
    siz[i] = 1.1 + Math.random() * 3.2;
    sed[i] = Math.random() * 100;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pgeo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
  pgeo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  pgeo.setAttribute('aSeed', new THREE.BufferAttribute(sed, 1));
  const ptUniforms = { uTime: { value: 0 } };
  const particles = new THREE.Points(pgeo, new THREE.ShaderMaterial({
    vertexShader: PT_VERT, fragmentShader: PT_FRAG, uniforms: ptUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  }));
  particles.rotation.x = 1.04;
  scene.add(particles);

  // ── volumetric bipolar jet knots ──
  const JN = 1200;
  const jPos = new Float32Array(JN * 3), jSpd = new Float32Array(JN), jSiz = new Float32Array(JN), jSeed = new Float32Array(JN), jSide = new Float32Array(JN);
  for (let i = 0; i < JN; i++) {
    const radius = Math.pow(Math.random(), 2.2) * 3.6;
    const azimuth = Math.random() * Math.PI * 2;
    jPos[i * 3] = Math.cos(azimuth) * radius;
    jPos[i * 3 + 1] = Math.random() * 210;
    jPos[i * 3 + 2] = Math.sin(azimuth) * radius;
    jSpd[i] = 24 + Math.random() * 42;
    jSiz[i] = 1.2 + Math.random() * 3.8;
    jSeed[i] = Math.random() * 100;
    jSide[i] = Math.random() < 0.5 ? -1 : 1;
  }
  const jetGeo = new THREE.BufferGeometry();
  jetGeo.setAttribute('position', new THREE.BufferAttribute(jPos, 3));
  jetGeo.setAttribute('aSpeed', new THREE.BufferAttribute(jSpd, 1));
  jetGeo.setAttribute('aSize', new THREE.BufferAttribute(jSiz, 1));
  jetGeo.setAttribute('aSeed', new THREE.BufferAttribute(jSeed, 1));
  jetGeo.setAttribute('aSide', new THREE.BufferAttribute(jSide, 1));
  const jetUniforms = { uTime: { value: 0 } };
  const jetParticles = new THREE.Points(jetGeo, new THREE.ShaderMaterial({
    vertexShader: JET_VERT, fragmentShader: JET_FRAG, uniforms: jetUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  }));
  jetParticles.position.z = -80;
  scene.add(jetParticles);

  // sparse deep-space stars (far, behind the action)
  {
    const SN = 320, sp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) { sp[i * 3] = (Math.random() - 0.5) * 900; sp[i * 3 + 1] = (Math.random() - 0.5) * 600; sp[i * 3 + 2] = -300 - Math.random() * 500; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.7, fog: false })));
  }

  // ── post-processing ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Bloom is restricted to the X-ray-hot inner disc, photon ring and jet
  // spine; the cooler red-shifted material keeps its structure.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.86, 0.76, 0.38);
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
    nebUniforms.uRes.value.set(W, H);
    // size the camera-locked nebula plane to fill the frustum at its depth
    const dist = Z0 - nebPlane.position.z; // camera local z = -1200 → dist 1350
    const fh = 2 * Math.tan((FOV * Math.PI / 180) / 2) * dist, fw = fh * camera.aspect;
    nebPlane.scale.set(fw, fh, 1);
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
    nebUniforms.uTime.value = tm; nebUniforms.uForge.value = p; nebUniforms.uScroll.value = uScroll;
    nebUniforms.uPulse.value = 0.5 + 0.5 * Math.sin(tm * (Math.PI * 2 / 5)); // ~5s pulse
    ptUniforms.uTime.value = tm;
    jetUniforms.uTime.value = tm;
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
    nebUniforms.uForge.value = 1; renderTagline(1); render(0);
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
