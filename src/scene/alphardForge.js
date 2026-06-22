/**
 * Alphard Jump Point — a full WebGL cosmic-storm scene (Three.js).
 *
 * A camera-locked fragment-shader nebula vortex (clockwise whirlpool fbm +
 * brilliant cyan-white pulsing core + crackling electric ring + vignette) backs
 * a 3D scene of ~6000 GPU-animated nebula particles, sparse deep-space stars,
 * and futuristic orbital stations flanking both edges (dark silhouettes with
 * blinking nav lights + lit strips) plus tiny drifting spacecraft for scale.
 * Composited through UnrealBloomPass + a subtle chromatic-aberration / film-grain
 * pass. Subtle mouse parallax. Scroll progress (--forge / uForge) dollies the
 * camera in and ramps brightness; the bilingual tagline types out across the
 * pin (JS position:fixed, since sticky is broken by body{overflow-x:hidden}).
 * Degrades to a single static frame under prefers-reduced-motion.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ── nebula vortex (camera-locked fullscreen plane) ─────────────────────── */
const NEB_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const NEB_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uForge, uGain, uPulse; uniform vec2 uRes;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
mat2 rot(float a){ float s=sin(a),c=cos(a); return mat2(c,-s,s,c); }
void main(){
  vec2 uv=(vUv-0.5); uv.x*=uRes.x/uRes.y;
  float zoom=mix(1.7,0.8,uForge); uv*=zoom;
  float r=length(uv);
  // four independently-rotating layers (clockwise), inner faster
  float tw = uTime*0.05 + 1.4/(r+0.25);
  vec2 w2 = rot(tw)*uv;
  float warp = fbm(w2*1.5);
  float n2 = fbm(w2*2.6 + warp + vec2(uTime*0.02,0.));        // dense spiral
  vec2 w3 = rot(uTime*0.032)*uv;  float n3 = fbm(w3*1.5 + 4.0); // diffuse clouds
  vec2 w4 = rot(uTime*0.018)*uv;  float n4 = fbm(w4*0.9 + 9.0); // outer fog
  float clouds = smoothstep(0.15,1.05,n2)*0.6 + smoothstep(0.2,1.0,n3)*0.3 + smoothstep(0.1,1.0,n4)*0.25;
  float vig = smoothstep(1.5,0.2,r);
  vec3 cCore=vec3(0.941,0.973,1.0), cCyan=vec3(0.05,0.95,1.0), cAzure=vec3(0.0,0.42,0.85), cNavy=vec3(0.02,0.07,0.18), cViolet=vec3(0.10,0.07,0.24);
  vec3 col=mix(cCyan,cAzure,smoothstep(0.12,0.55,r));
  col=mix(col,cNavy,smoothstep(0.55,1.1,r));
  col=mix(col,cViolet,smoothstep(1.0,1.5,r)*0.5);
  col*=(0.30+0.95*clouds);
  col += vec3(0.0,0.26,0.17)*clouds*smoothstep(0.95,0.3,r)*0.14;     // green wisp
  // pulsing core + bloom seed
  float pulse = 1.0 + 0.18*uPulse;
  float core=smoothstep(0.24*pulse,0.0,r);
  float glow=pow(smoothstep(0.95,0.0,r),2.2);
  col += cCore*core*1.6*pulse;
  col += cCyan*glow*(0.45+0.5*uForge);
  // electric ring (continuous around the circle)
  float ang=atan(uv.y,uv.x);
  float rn=fbm(vec2(cos(ang),sin(ang))*4.0+uTime*0.6);
  float arc=fbm(vec2(cos(ang),sin(ang))*12.0-uTime*1.1);
  float ring=smoothstep(0.05,0.0,abs(r-0.24*pulse-(rn-0.5)*0.05-(arc-0.5)*0.02));
  col += vec3(0.85,0.97,1.0)*ring*(1.0+0.4*arc);
  col*=vig;
  col*=(0.7+0.5*uForge)*uGain;
  gl_FragColor=vec4(col,1.0);
}`;

/* ── nebula particles (GPU-animated points) ─────────────────────────────── */
const PT_VERT = `
attribute float aSpeed; attribute float aSize; attribute float aSeed;
uniform float uTime; varying float vMix;
void main(){
  float ang = -uTime * aSpeed;                 // clockwise orbital motion
  float c=cos(ang), s=sin(ang);
  vec3 p = position;
  p.xy = mat2(c,-s,s,c) * p.xy;
  p.x += sin(uTime*0.3 + aSeed)*2.2;           // slow turbulence / drift
  p.y += cos(uTime*0.27 + aSeed*1.3)*2.2;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_PointSize = aSize * (260.0 / max(1.0,-mv.z));
  gl_Position = projectionMatrix * mv;
  vMix = fract(aSeed);
}`;
const PT_FRAG = `
precision mediump float; varying float vMix;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  vec3 c = mix(vec3(0.55,0.92,1.0), vec3(0.9,0.99,1.0), vMix);
  gl_FragColor = vec4(c, a*0.30);
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

  // ── bilingual tagline typed out by the scroll ──
  const tagEl = document.getElementById('forgeTagline');
  const CLAUSES = { en: ['Every return', 'is a jump', 'through the dark.'], zh: ['每一份回报，', '都是一次', '穿越深空的跃迁。'] };
  function detectZh() { const l = (document.documentElement.lang || '').toLowerCase(); if (l) return l.startsWith('zh'); try { return localStorage.getItem('afflatus-lang') === 'zh'; } catch (e) { return false; } }
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
  new MutationObserver(() => { curZh = detectZh(); lastTagKey = ''; }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  const sv0 = document.getElementById('sv0');
  const retPct = Math.abs(parseFloat(sv0?.dataset.counter || '38.66')) || 38.66;
  const uGain = clamp(0.9 + retPct / 300, 0.85, 1.3);

  // ── renderer ──
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  renderer.setClearColor(0x04060a, 1);
  // context-loss resilience (home runs many WebGL contexts; recover, don't black-screen)
  renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
  renderer.domElement.addEventListener('webglcontextrestored', () => { try { size(); render(performance.now()); } catch (e) {} }, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x061018, 0.0016);
  const FOV = 45, Z0 = 150;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);
  camera.position.set(0, 0, Z0);
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0x35506e, 1.1));
  const keyL = new THREE.DirectionalLight(0x9fd8ff, 1.0); keyL.position.set(0, 0, 200); scene.add(keyL);

  // nebula plane locked to the camera (far background, always fills the view)
  const nebUniforms = { uTime: { value: 0 }, uForge: { value: 0 }, uGain: { value: uGain }, uPulse: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
  const nebPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({ vertexShader: NEB_VERT, fragmentShader: NEB_FRAG, uniforms: nebUniforms, depthTest: false, depthWrite: false, fog: false }));
  nebPlane.position.z = -1200; nebPlane.renderOrder = -10; camera.add(nebPlane);

  // ── nebula particles ──
  const PN = 6000;
  const pos = new Float32Array(PN * 3), spd = new Float32Array(PN), siz = new Float32Array(PN), sed = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const rr = 26 + Math.pow(Math.random(), 0.7) * 150;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = Math.sin(a) * rr * 0.92;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    spd[i] = (0.05 + 0.35 / (rr * 0.02));        // inner orbits faster
    siz[i] = 1.2 + Math.random() * 3.6;
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
  scene.add(particles);

  // sparse deep-space stars (far, behind the action)
  {
    const SN = 320, sp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) { sp[i * 3] = (Math.random() - 0.5) * 900; sp[i * 3 + 1] = (Math.random() - 0.5) * 600; sp[i * 3 + 2] = -300 - Math.random() * 500; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.7, fog: false })));
  }

  // ── orbital stations (dark silhouettes) flanking both edges ──
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c1018, metalness: 0.8, roughness: 0.5 });
  const strip = new THREE.MeshBasicMaterial({ color: 0x2fd0ff });
  const blinkers = [];
  function buildStation(scale) {
    const g = new THREE.Group();
    const H = 70 * scale;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.4 * scale, 1.8 * scale, H, 10), dark));      // mast
    const node = new THREE.Mesh(new THREE.SphereGeometry(4.5 * scale, 12, 10), dark); node.position.y = H * 0.1; g.add(node);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 30 * scale, 6), dark)).position.y = H * 0.6; // antenna spire
    for (let k = 0; k < 5; k++) {                                                                  // cross struts
      const y = -H * 0.4 + k * H * 0.18, half = (7 - k) * scale;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.7 * scale, 0.7 * scale), dark); arm.position.y = y; g.add(arm);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(16 * scale, 5 * scale, 10 * scale), dark); base.position.y = -H * 0.5; g.add(base);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, H * 0.7, 0.5 * scale), strip); st.position.set(1.7 * scale, 0, 0); g.add(st); // lit strip
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x8af0ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    lamp.scale.setScalar(6 * scale); lamp.position.y = H * 0.55; g.add(lamp); blinkers.push({ s: lamp, ph: Math.random() * 6 });
    return g;
  }
  const halfW0 = Z0 * Math.tan((FOV * Math.PI / 180) / 2);  // ×aspect added at resize
  const stationGroup = new THREE.Group(); scene.add(stationGroup);
  function placeStations(aspect) {
    stationGroup.clear(); blinkers.length = 0;
    const edge = halfW0 * aspect * 0.96;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const sc = 0.7 + Math.random() * 0.7;
        const st = buildStation(sc);
        st.position.set(side * (edge - i * 9 - Math.random() * 4), (Math.random() - 0.5) * 80, -40 - i * 26 - Math.random() * 30);
        st.rotation.y = side < 0 ? 0.3 : -0.3;
        stationGroup.add(st);
      }
    }
  }

  // tiny spacecraft for scale
  const ships = [];
  {
    const sm = new THREE.MeshStandardMaterial({ color: 0x10161f, metalness: 0.7, roughness: 0.6 });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 5), sm); b.rotation.x = Math.PI / 2; g.add(b);
      const nav = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      nav.scale.setScalar(3); nav.position.z = -3; g.add(nav); blinkers.push({ s: nav, ph: Math.random() * 6 });
      g.position.set((Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 30), (Math.random() - 0.5) * 70, -20 - Math.random() * 60);
      g.userData = { vx: (Math.random() - 0.5) * 0.04, vy: (Math.random() - 0.5) * 0.03, seed: Math.random() * 10 };
      ships.push(g); scene.add(g);
    }
  }

  // ── post-processing ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.7, 0.2); // strength, radius, threshold
  composer.addPass(bloom);
  const finalPass = new ShaderPass(FINAL); finalPass.renderToScreen = true; composer.addPass(finalPass);

  let W = 1, H = 1;
  function size() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    bloom.setSize(W * dpr, H * dpr);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    nebUniforms.uRes.value.set(W, H);
    // size the camera-locked nebula plane to fill the frustum at its depth
    const dist = Z0 - nebPlane.position.z; // camera local z = -1200 → dist 1350
    const fh = 2 * Math.tan((FOV * Math.PI / 180) / 2) * dist, fw = fh * camera.aspect;
    nebPlane.scale.set(fw, fh, 1);
    placeStations(camera.aspect);
  }

  // parallax
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  function onMove(e) { tmx = (e.clientX / innerWidth - 0.5); tmy = (e.clientY / innerHeight - 0.5); }

  // scroll progress + JS pin
  function progress() {
    if (reduce) return 1;
    const rect = section.getBoundingClientRect(), vh = window.innerHeight;
    if (stageEl) { const ended = rect.bottom < vh; stageEl.classList.toggle('pin-fixed', rect.top <= 0 && rect.bottom >= vh && !ended); stageEl.classList.toggle('pin-end', ended); }
    const travel = rect.height - vh; if (travel <= 0) return 0; return clamp(-rect.top / travel, 0, 1);
  }

  function render(t) {
    const p = progress();
    section.style.setProperty('--forge', p.toFixed(4));
    renderTagline(p);
    const tm = t * 0.001;
    nebUniforms.uTime.value = tm; nebUniforms.uForge.value = p;
    nebUniforms.uPulse.value = 0.5 + 0.5 * Math.sin(tm * (Math.PI * 2 / 5)); // ~5s pulse
    ptUniforms.uTime.value = tm; finalPass.uniforms.uTime.value = t;
    // layered rotation (particles slower than inner shader layers → depth)
    particles.rotation.z = tm * 0.06;
    stationGroup.rotation.z = 0; // stations fixed at edges
    // ships drift + blink
    for (const sh of ships) { sh.position.x += sh.userData.vx; sh.position.y += sh.userData.vy; if (Math.abs(sh.position.x) > 120) sh.userData.vx *= -1; if (Math.abs(sh.position.y) > 90) sh.userData.vy *= -1; }
    for (const b of blinkers) b.s.material.opacity = 0.35 + 0.65 * Math.abs(Math.sin(tm * 1.8 + b.ph));
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
    addEventListener('resize', () => { size(); render(0); }, { passive: true });
    return { destroy() { renderer.dispose(); composer.dispose?.(); } };
  }

  section.classList.add('is-live'); size();
  let running = false, raf = 0;
  function loop(t) { render(t); if (running) raf = requestAnimationFrame(loop); }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
  const io = new IntersectionObserver(es => { es.forEach(e => { e.isIntersecting ? start() : stop(); }); }, { threshold: 0 });
  io.observe(section);
  const onScroll = () => { if (!running) progress(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { size(); if (!running) render(performance.now()); }, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
  render(performance.now());

  return { destroy() { stop(); io.disconnect(); removeEventListener('scroll', onScroll); removeEventListener('pointermove', onMove); renderer.dispose(); } };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAlphardForge, { once: true });
else initAlphardForge();
