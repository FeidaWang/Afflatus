/**
 * WebGL holographic "Blade Unit" — an armoured figure assembled from box
 * segments, slowly rotating, rendered as a translucent cyan hologram (fresnel
 * rim + scanlines + flicker, additive blending). It holds an energy blade whose
 * core is emissive and whose tip flares fluorescent.
 *
 * Raw WebGL (no Three.js): one unit-cube VBO drawn once per body part with a
 * per-part model matrix + colour/emissive uniforms.
 */

// ---- minimal mat4 helpers (column-major) ----
const M = {
  ident: () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
    }
    return o;
  },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  },
  translate(x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; },
  scale(x, y, z) { return [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]; },
  rotX(a){const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];},
  rotY(a){const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];},
  rotZ(a){const c=Math.cos(a),s=Math.sin(a);return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];},
};

// unit cube centred at origin, half-extent 1, with per-face normals
function cube() {
  const p = [], n = [], idx = [];
  const faces = [
    [[ 1,-1,-1],[ 1, 1,-1],[ 1, 1, 1],[ 1,-1, 1],[ 1,0,0]],
    [[-1,-1, 1],[-1, 1, 1],[-1, 1,-1],[-1,-1,-1],[-1,0,0]],
    [[-1, 1,-1],[-1, 1, 1],[ 1, 1, 1],[ 1, 1,-1],[0, 1,0]],
    [[-1,-1, 1],[-1,-1,-1],[ 1,-1,-1],[ 1,-1, 1],[0,-1,0]],
    [[-1,-1, 1],[ 1,-1, 1],[ 1, 1, 1],[-1, 1, 1],[0,0, 1]],
    [[ 1,-1,-1],[-1,-1,-1],[-1, 1,-1],[ 1, 1,-1],[0,0,-1]],
  ];
  faces.forEach((f, i) => {
    const nrm = f[4];
    for (let k = 0; k < 4; k++) { p.push(...f[k]); n.push(...nrm); }
    const b = i*4; idx.push(b,b+1,b+2, b,b+2,b+3);
  });
  return { p, n, idx };
}

const C_BODY = [0.45, 0.82, 1.0];
const C_BLADE = [0.78, 1.0, 1.0];
// part = { t:[x,y,z], s:[hx,hy,hz], r:[rx,ry,rz], color, emissive }
const r0 = [0,0,0];
const PARTS = [
  { t:[0,-0.18,0],  s:[0.26,0.16,0.18], r:r0, c:C_BODY, e:0 },   // pelvis
  { t:[0, 0.28,0],  s:[0.30,0.34,0.20], r:r0, c:C_BODY, e:0 },   // torso
  { t:[0, 0.30,0.17], s:[0.20,0.22,0.05], r:r0, c:C_BLADE, e:0.5 }, // chest plate (lit)
  { t:[0, 0.34,-0.20], s:[0.18,0.22,0.10], r:r0, c:C_BODY, e:0 }, // jetpack
  { t:[-0.16,0.56,-0.24], s:[0.05,0.16,0.05], r:[-0.2,0,0], c:C_BODY, e:0 }, // thruster L
  { t:[ 0.16,0.56,-0.24], s:[0.05,0.16,0.05], r:[-0.2,0,0], c:C_BODY, e:0 }, // thruster R
  { t:[0, 0.74,0],  s:[0.16,0.17,0.16], r:r0, c:C_BODY, e:0 },   // head
  { t:[0, 0.75,0.15], s:[0.12,0.045,0.05], r:r0, c:C_BLADE, e:1 }, // visor (glow)
  { t:[-0.40,0.52,0], s:[0.15,0.15,0.17], r:r0, c:C_BODY, e:0 },  // shoulder L
  { t:[ 0.40,0.52,0], s:[0.15,0.15,0.17], r:r0, c:C_BODY, e:0 },  // shoulder R
  { t:[-0.41,0.28,0.10], s:[0.10,0.20,0.11], r:[-0.85,0,0.18], c:C_BODY, e:0 }, // upper arm L
  { t:[ 0.41,0.28,0.10], s:[0.10,0.20,0.11], r:[-0.85,0,-0.18], c:C_BODY, e:0 }, // upper arm R
  { t:[-0.30,0.12,0.36], s:[0.085,0.18,0.10], r:[-1.25,0,0], c:C_BODY, e:0 }, // forearm L
  { t:[ 0.30,0.12,0.36], s:[0.085,0.18,0.10], r:[-1.25,0,0], c:C_BODY, e:0 }, // forearm R
  { t:[0,0.20,0.50], s:[0.07,0.12,0.07], r:[0.2,0,0], c:C_BODY, e:0 },  // hilt grip
  { t:[-0.15,-0.52,0.03], s:[0.115,0.22,0.13], r:[0.16,0,0.05], c:C_BODY, e:0 }, // thigh L
  { t:[ 0.15,-0.52,0.03], s:[0.115,0.22,0.13], r:[0.16,0,-0.05], c:C_BODY, e:0 }, // thigh R
  { t:[-0.19,-0.94,0.07], s:[0.095,0.22,0.12], r:[0.05,0,0], c:C_BODY, e:0 }, // shin L
  { t:[ 0.19,-0.94,0.07], s:[0.095,0.22,0.12], r:[0.05,0,0], c:C_BODY, e:0 }, // shin R
  { t:[-0.20,-1.18,0.14], s:[0.10,0.05,0.16], r:r0, c:C_BODY, e:0 }, // foot L
  { t:[ 0.20,-1.18,0.14], s:[0.10,0.05,0.16], r:r0, c:C_BODY, e:0 }, // foot R
];
// energy blade (up-front, slight diagonal). Drawn as halo + core + tip.
const BLADE_R = [0.22, 0, 0.16];
const BLADE = [
  { t:[0.03,0.95,0.44], s:[0.06,0.62,0.06], r:BLADE_R, c:C_BLADE, e:0.85, blend:true }, // halo
  { t:[0.03,0.95,0.44], s:[0.022,0.62,0.022], r:BLADE_R, c:[0.92,1,1], e:1, blend:true }, // core
  { t:[0.18,1.53,0.34], s:[0.06,0.10,0.06], r:BLADE_R, c:[1,1,1], e:1, blend:true }, // tip flare
];

export function createBladeHologram(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return null;

  const vsSrc = `
    attribute vec3 aPos; attribute vec3 aNormal;
    uniform mat4 uProj, uView, uModel;
    varying vec3 vN; varying vec3 vW;
    void main(){
      vec4 w = uModel * vec4(aPos,1.0);
      vW = w.xyz; vN = normalize(mat3(uModel) * aNormal);
      gl_Position = uProj * uView * w;
    }`;
  const fsSrc = `
    precision highp float;
    varying vec3 vN; varying vec3 vW;
    uniform float uTime, uEmissive; uniform vec3 uColor;
    void main(){
      vec3 V = normalize(vec3(0.0,0.2,5.2) - vW);
      float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
      float scan = 0.5 + 0.5*sin(vW.y*42.0 - uTime*3.2);
      float flick = 0.86 + 0.14*sin(uTime*8.0 + vW.y*4.0);
      vec3 base = uColor * (0.16 + 0.6*fres) * flick + uColor * scan * 0.09;
      vec3 col = mix(base, uColor*1.7, uEmissive);
      float a = mix(0.14 + 0.72*fres, 0.92, uEmissive);
      gl_FragColor = vec4(col, a);
    }`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsSrc));
  gl.bindAttribLocation(prog, 0, 'aPos'); gl.bindAttribLocation(prog, 1, 'aNormal');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const geo = cube();
  const posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.p), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const nBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.n), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  const idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), gl.STATIC_DRAW);

  const U = n => gl.getUniformLocation(prog, n);
  const uProj = U('uProj'), uView = U('uView'), uModel = U('uModel'),
        uTime = U('uTime'), uColor = U('uColor'), uEmissive = U('uEmissive');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // additive → glowy hologram
  gl.enable(gl.DEPTH_TEST); gl.depthMask(false);

  const view = M.translate(0, -0.2, -5.2);   // pulled back so blade tip + feet fit
  let raf = 0, active = false, start = performance.now();

  function partModel(p, spin) {
    let m = M.mul(M.rotX(p.r[0]), M.scale(p.s[0], p.s[1], p.s[2]));
    m = M.mul(M.rotZ(p.r[2]), m);
    m = M.mul(M.rotY(p.r[1]), m);
    m = M.mul(M.translate(p.t[0], p.t[1], p.t[2]), m);
    return M.mul(spin, m);   // world spin applied last
  }

  function draw(now) {
    const w = canvas.clientWidth || 120, h = canvas.clientHeight || 160;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const ww = Math.max(2, Math.floor(w * dpr)), hh = Math.max(2, Math.floor(h * dpr));
    if (canvas.width !== ww || canvas.height !== hh) { canvas.width = ww; canvas.height = hh; }
    gl.viewport(0, 0, ww, hh);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const t = (now - start) / 1000;
    gl.uniformMatrix4fv(uProj, false, new Float32Array(M.perspective(0.62, ww / hh, 0.1, 50)));
    gl.uniformMatrix4fv(uView, false, new Float32Array(view));
    gl.uniform1f(uTime, t);
    const spin = M.rotY(Math.sin(t * 0.5) * 0.6 + 0.2);   // gentle left-right turn

    for (const p of [...PARTS, ...BLADE]) {
      gl.uniformMatrix4fv(uModel, false, new Float32Array(partModel(p, spin)));
      gl.uniform3fv(uColor, p.c);
      gl.uniform1f(uEmissive, p.e);
      gl.drawElements(gl.TRIANGLES, geo.idx.length, gl.UNSIGNED_SHORT, 0);
    }
  }

  function loop() { if (active) { draw(performance.now()); raf = requestAnimationFrame(loop); } }
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) { start = performance.now(); raf = requestAnimationFrame(loop); }
    else cancelAnimationFrame(raf);
  }
  return { setActive };
}
