/**
 * Alphard Jump Point — a WebGL fluid/nebula vortex (Star Citizen "Forge" homage).
 *
 * A 2D fragment-shader cosmic storm rendered into #alphardForge: a brilliant
 * cyan-white singularity core wrapped in a crackling electric ring, expanding
 * into a clockwise-rotating, domain-warped fractal-noise nebula (deep-ocean
 * whirlpool meets celestial cloud), with drifting luminescent stardust, an
 * in-shader bloom on the bright centre and an edge vignette to navy.
 *
 * Scroll progress is written to CSS var --forge (0..1) on #stardrive and fed to
 * the shader as uForge — it dollies the camera in (core grows) and ramps
 * brightness as the visitor approaches. The bilingual tagline (DOM) types out
 * across the pin. The stage is pinned with a JS position:fixed (sticky is broken
 * here by html/body{overflow-x:hidden}). Degrades to a single static frame under
 * prefers-reduced-motion.
 */
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uForge;
uniform float uGain;
uniform vec2  uRes;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
mat2 rot(float a){ float s = sin(a), c = cos(a); return mat2(c,-s,s,c); }

void main(){
  vec2 uv = (vUv - 0.5);
  uv.x *= uRes.x / uRes.y;                       // aspect-correct
  float zoom = mix(1.70, 0.75, uForge);          // dolly in as we approach
  uv *= zoom;
  float r = length(uv);

  // clockwise whirlpool: stronger angular twist toward the centre
  float tw = uTime*0.05 + 1.4/(r+0.25);
  vec2 wuv = rot(tw) * uv;
  float warp = fbm(wuv*1.5);
  float n = fbm(wuv*2.5 + warp + vec2(uTime*0.02, 0.0));   // domain-warped clouds
  float clouds = smoothstep(0.15, 1.05, n);

  float vig = smoothstep(1.5, 0.2, r);

  // aquatic blue gradient by radius
  vec3 cCore  = vec3(0.941,0.973,1.0);   // #F0F8FF
  vec3 cCyan  = vec3(0.05,0.95,1.0);
  vec3 cAzure = vec3(0.0,0.42,0.85);
  vec3 cNavy  = vec3(0.02,0.08,0.20);
  vec3 col = mix(cCyan, cAzure, smoothstep(0.12,0.55,r));
  col = mix(col, cNavy, smoothstep(0.55,1.25,r));
  col *= (0.30 + 0.95*clouds);

  // faint green wisp tint in the mid field
  col += vec3(0.0,0.26,0.17) * clouds * smoothstep(0.95,0.3,r) * 0.16;

  // brilliant singularity core + soft in-shader bloom
  float core = smoothstep(0.24, 0.0, r);
  float glow = pow(smoothstep(0.95, 0.0, r), 2.2);
  col += cCore * core * 1.5;
  col += cCyan * glow * (0.45 + 0.5*uForge);

  // crackling electric ring at the core edge (continuous around the circle)
  float ang = atan(uv.y, uv.x);
  float rn = fbm(vec2(cos(ang), sin(ang))*4.0 + uTime*0.6);
  float arc = fbm(vec2(cos(ang), sin(ang))*12.0 - uTime*1.1);
  float ring = smoothstep(0.05, 0.0, abs(r - 0.24 - (rn-0.5)*0.05 - (arc-0.5)*0.02));
  col += vec3(0.85,0.97,1.0) * ring * (1.0 + 0.4*arc);

  // luminescent stardust drifting along the clockwise current
  vec2 sUv = rot(uTime*0.04) * uv;
  vec2 cell = sUv * 9.0;
  float sp = hash(floor(cell));
  float spark = step(0.95, sp) * smoothstep(0.5, 0.0, length(fract(cell)-0.5));
  col += vec3(0.9,1.0,1.0) * spark * (0.5 + 0.5*sin(uTime*3.0 + sp*30.0)) * 0.7 * vig;

  col *= vig;                                   // vignette to navy at the edges
  col *= (0.7 + 0.5*uForge) * uGain;            // ramp brightness on approach
  gl_FragColor = vec4(col, 1.0);
}
`;

export function initAlphardForge() {
  const section = document.getElementById('stardrive');
  const canvas = document.getElementById('alphardForge');
  if (!section || !canvas) return null;
  const stageEl = section.querySelector('.stardrive-stage');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── bilingual tagline typed out by the scroll (types down / deletes up) ──
  const tagEl = document.getElementById('forgeTagline');
  const CLAUSES = {
    en: ['Every return', 'is a jump', 'through the dark.'],
    zh: ['每一份回报，', '都是一次', '穿越深空的跃迁。']
  };
  function detectZh() {
    const l = (document.documentElement.lang || '').toLowerCase();
    if (l) return l.startsWith('zh');
    try { return localStorage.getItem('afflatus-lang') === 'zh'; } catch (e) { return false; }
  }
  let curZh = detectZh(), lastTagKey = '';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function renderTagline(p) {
    if (!tagEl) return;
    const lines = CLAUSES[curZh ? 'zh' : 'en'];
    const total = lines.reduce((s, l) => s + l.length, 0);
    const tp = reduce ? 1 : clamp((p - 0.04) / 0.9, 0, 1);
    const shown = Math.round(tp * total);
    const key = (curZh ? 'z' : 'e') + ':' + shown;
    if (key === lastTagKey) return;
    lastTagKey = key;
    let remaining = shown, html = '', caretDone = false;
    for (const line of lines) {
      const take = clamp(remaining, 0, line.length);
      remaining -= take;
      const caret = (!caretDone && take < line.length && tp > 0 && tp < 1) ? '<i class="tw-cur"></i>' : '';
      if (caret) caretDone = true;
      html += '<span class="tw-line">' + esc(line.slice(0, take)) + caret + '</span>';
    }
    tagEl.innerHTML = html;
  }
  new MutationObserver(() => { curZh = detectZh(); lastTagKey = ''; })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // luminosity gain from the real annualised-return figure
  const sv0 = document.getElementById('sv0');
  const retPct = Math.abs(parseFloat(sv0?.dataset.counter || '38.66')) || 38.66;
  const uGain = clamp(0.9 + retPct / 300, 0.85, 1.3);

  // ── WebGL renderer + fullscreen nebula shader ──
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setClearColor(0x04060a, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uTime: { value: 0 }, uForge: { value: 0 }, uGain: { value: uGain },
    uRes: { value: new THREE.Vector2(1, 1) }
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms }));
  scene.add(quad);

  function size() {
    const r = canvas.getBoundingClientRect();
    const W = Math.max(1, r.width), H = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    uniforms.uRes.value.set(W, H);
  }

  // scroll progress + JS-driven pin (sticky is broken by overflow-x:hidden)
  function progress() {
    if (reduce) return 1;
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight;
    if (stageEl) {
      const ended = rect.bottom < vh;
      stageEl.classList.toggle('pin-fixed', rect.top <= 0 && rect.bottom >= vh && !ended);
      stageEl.classList.toggle('pin-end', ended);
    }
    const travel = rect.height - vh;
    if (travel <= 0) return 0;
    return clamp(-rect.top / travel, 0, 1);
  }

  function render(t) {
    const p = progress();
    section.style.setProperty('--forge', p.toFixed(4));
    renderTagline(p);
    uniforms.uTime.value = t * 0.001;
    uniforms.uForge.value = p;
    renderer.render(scene, camera);
  }

  size();

  if (reduce) {
    uniforms.uForge.value = 1; renderTagline(1);
    render(0);
    addEventListener('resize', () => { size(); render(0); }, { passive: true });
    return { destroy() { renderer.dispose(); } };
  }

  section.classList.add('is-live');
  size();

  let running = false, raf = 0;
  function loop(t) { render(t); if (running) raf = requestAnimationFrame(loop); }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }

  const io = new IntersectionObserver(es => {
    es.forEach(e => { e.isIntersecting ? start() : stop(); });
  }, { threshold: 0 });
  io.observe(section);

  const onScroll = () => { if (!running) progress(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { size(); if (!running) render(performance.now()); }, { passive: true });
  render(performance.now());

  return { destroy() { stop(); io.disconnect(); removeEventListener('scroll', onScroll); renderer.dispose(); } };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAlphardForge, { once: true });
} else {
  initAlphardForge();
}
