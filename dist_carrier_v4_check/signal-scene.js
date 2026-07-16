(() => {
  'use strict';

  const canvas = document.getElementById('signalScene');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance'
  }) || canvas.getContext('experimental-webgl');

  if (!gl) {
    canvas.style.background = 'linear-gradient(#061414,#143d35 58%,#17100d 58%)';
    return;
  }

  const W = 320;
  const H = 180;
  const TWO_PI = Math.PI * 2;
  const reduceMotion = (() => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  })();

  const vertSrc = `
    attribute vec2 a_pos;
    attribute vec4 a_color;
    uniform vec2 u_resolution;
    varying vec4 v_color;
    void main() {
      vec2 zeroToOne = a_pos / u_resolution;
      vec2 clip = zeroToOne * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_color = a_color;
    }
  `;

  const fragSrc = `
    precision mediump float;
    varying vec4 v_color;
    void main() {
      gl_FragColor = v_color;
    }
  `;

  function shader(type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    return sh;
  }

  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(program);
  gl.useProgram(program);

  const posLoc = gl.getAttribLocation(program, 'a_pos');
  const colorLoc = gl.getAttribLocation(program, 'a_color');
  const resLoc = gl.getUniformLocation(program, 'u_resolution');
  const buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(posLoc);
  gl.enableVertexAttribArray(colorLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 24, 8);
  gl.uniform2f(resLoc, W, H);
  gl.viewport(0, 0, W, H);
  gl.clearColor(0.02, 0.06, 0.06, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  canvas.width = W;
  canvas.height = H;

  const colorCache = new Map();
  function col(hex, alpha = 1) {
    const key = `${hex}/${alpha}`;
    if (colorCache.has(key)) return colorCache.get(key);
    const n = Number.parseInt(hex.slice(1), 16);
    const out = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
    colorCache.set(key, out);
    return out;
  }

  function mix(a, b, f) {
    return [
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
      a[3] + (b[3] - a[3]) * f
    ];
  }

  function rng(seed) {
    let v = seed >>> 0;
    return () => {
      v += 0x6D2B79F5;
      let t = v;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rnd = rng(932615);
  const stars = Array.from({ length: 78 }, () => ({
    x: Math.floor(rnd() * W),
    y: Math.floor(5 + rnd() * 70),
    s: rnd() > 0.82 ? 2 : 1,
    a: 0.45 + rnd() * 0.5,
    p: rnd() * TWO_PI
  }));

  const smoke = Array.from({ length: 12 }, () => ({
    x: 148 + rnd() * 24,
    y: 94 + rnd() * 28,
    w: 4 + rnd() * 10,
    p: rnd(),
    d: rnd() > 0.5 ? 1 : -1
  }));

  const embers = Array.from({ length: 22 }, () => ({
    x: 151 + rnd() * 20,
    p: rnd(),
    speed: 0.08 + rnd() * 0.18,
    drift: -7 + rnd() * 14,
    warm: rnd() > 0.45
  }));

  const farPines = Array.from({ length: 38 }, (_, i) => ({
    x: -10 + i * 9 + Math.floor(rnd() * 6),
    h: 14 + rnd() * 23,
    base: 107 + rnd() * 12
  }));

  const frontPines = Array.from({ length: 30 }, (_, i) => ({
    x: -15 + i * 12 + Math.floor(rnd() * 8),
    h: 20 + rnd() * 38,
    base: 137 + rnd() * 7
  }));

  const grass = Array.from({ length: 130 }, () => ({
    x: Math.floor(rnd() * W),
    y: 131 + Math.floor(rnd() * 6),
    w: 1 + Math.floor(rnd() * 4),
    c: rnd()
  }));

  let verts = [];
  function push(x, y, c) { verts.push(x, y, c[0], c[1], c[2], c[3]); }
  function tri(x1, y1, x2, y2, x3, y3, c) { push(x1, y1, c); push(x2, y2, c); push(x3, y3, c); }
  function rect(x, y, w, h, c) {
    const x2 = x + w;
    const y2 = y + h;
    tri(x, y, x2, y, x, y2, c);
    tri(x2, y, x2, y2, x, y2, c);
  }
  function poly(points, c) {
    for (let i = 1; i < points.length - 1; i++) {
      tri(points[0][0], points[0][1], points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], c);
    }
  }
  function ellipse(cx, cy, rx, ry, c, steps = 18) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TWO_PI;
      const b = ((i + 1) / steps) * TWO_PI;
      tri(cx, cy, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, cx + Math.cos(b) * rx, cy + Math.sin(b) * ry, c);
    }
  }

  function pine(x, base, h, c) {
    rect(x - 1, base - h * 0.25, 2, h * 0.25, col('#07100e', 0.9));
    tri(x, base - h, x - h * 0.24, base - h * 0.42, x + h * 0.24, base - h * 0.42, c);
    tri(x, base - h * 0.78, x - h * 0.32, base - h * 0.22, x + h * 0.32, base - h * 0.22, c);
    tri(x, base - h * 0.55, x - h * 0.38, base, x + h * 0.38, base, c);
  }

  function sword(x, y) {
    rect(x, y, 2, 45, col('#d6e1e3'));
    rect(x - 2, y + 23, 6, 2, col('#f0c46a'));
    rect(x - 1, y + 25, 4, 6, col('#7a4a24'));
    rect(x + 1, y + 2, 1, 38, col('#8799a4', 0.72));
  }

  function drawSky(t) {
    const top = col('#04110f');
    const mid = col('#0f312b');
    const low = col('#1c4940');
    for (let y = 0; y < 112; y += 4) {
      const f = y / 112;
      rect(0, y, W, 4, f < 0.55 ? mix(top, mid, f / 0.55) : mix(mid, low, (f - 0.55) / 0.45));
    }

    rect(0, 0, W, 4, col('#020807', 0.6));
    ellipse(188, 84, 78, 26, col('#f0703c', 0.05), 20);
    ellipse(178, 83, 46, 19, col('#ffcd75', 0.035), 20);

    for (const s of stars) {
      const tw = 0.55 + Math.sin(t * 1.7 + s.p) * 0.35;
      rect(s.x, s.y, s.s, s.s, col('#f4e9d0', Math.max(0.22, s.a * tw)));
    }

    // distant V-flock drifting top-left, like the reference photo
    for (let i = 0; i < 6; i++) {
      const bx = 30 + i * 12 + ((t * 5) % 52);
      const by = 22 + (i % 2) * 7 + Math.sin(t * 0.6 + i) * 1.2;
      const bc = col('#0c1c19', 0.55);
      rect(bx, by, 2, 1, bc); rect(bx + 2, by + 1, 2, 1, bc); rect(bx + 4, by, 2, 1, bc);
    }

    const cloudC = col('#071614', 0.24);
    rect((t * -1.8) % 390 - 70, 22, 46, 2, cloudC);
    rect((t * -1.8) % 390 - 53, 25, 64, 2, cloudC);
    rect((t * -1.2) % 420 + 105, 37, 72, 2, col('#0b211f', 0.20));
  }

  function drawMountains() {
    rect(0, 88, W, 45, col('#0a1c1e'));
    tri(0, 88, 34, 56, 72, 88, col('#12302f'));
    tri(43, 88, 83, 60, 123, 88, col('#12302f'));
    tri(136, 88, 187, 58, 238, 88, col('#102b2c'));
    tri(204, 88, 278, 45, 350, 88, col('#102b2c'));
    tri(170, 88, 205, 64, 244, 88, col('#163a38', 0.58));

    rect(0, 98, W, 25, col('#081819', 0.82));
    for (const p of farPines) pine(p.x, p.base, p.h, col('#071716', 0.88));
    rect(0, 117, W, 11, col('#061211', 0.74));
    for (const p of frontPines) pine(p.x, p.base, p.h, col('#04100f', 0.95));
  }

  function drawGround(t) {
    rect(0, 134, W, 46, col('#17110e'));
    rect(0, 134, W, 4, col('#536330'));
    rect(0, 138, W, 6, col('#342016'));
    rect(0, 144, W, 36, col('#20120f'));

    for (let x = 0; x < W; x += 8) {
      const off = ((x / 8) % 3) * 2;
      tri(x, 143 + off, x + 8, 143 + off, x + 2, 149 + off, col('#5a2d1b', 0.55));
      rect(x + 2, 155 + ((x / 8) % 4), 10, 2, col('#3a2016', 0.7));
    }

    for (const g of grass) {
      const c = g.c < 0.45 ? '#6d7035' : (g.c < 0.8 ? '#354a25' : '#8a7738');
      rect(g.x, g.y + Math.sin(t * 3 + g.x) * 0.35, g.w, 1, col(c, 0.82));
    }
  }

  function drawKnight(t) {
    const firePulse = 0.78 + Math.sin(t * 18) * 0.18;
    ellipse(83, 136, 33, 6, col('#040807', 0.72), 18);
    sword(103, 74);

    poly([[73, 96], [91, 101], [97, 132], [63, 134], [56, 119]], col('#111322'));
    rect(60, 119, 17, 18, col('#080b12'));
    rect(72, 103, 19, 23, col('#575e68'));
    rect(76, 105, 14, 5, col('#a4adb4'));
    rect(90, 108, 6, 17, col('#3e4653'));
    rect(94, 119, 18, 5, col('#767d84'));
    rect(109, 120, 9, 3, col('#c7cfd2'));

    rect(80, 86, 15, 13, col('#89939b'));
    rect(83, 82, 12, 6, col('#bac3c7'));
    rect(84, 91, 9, 3, col('#050707'));
    rect(89, 84, 8, 2, col('#f0c46a'));
    tri(93, 84, 100, 76, 96, 89, col('#efe2b4'));
    tri(82, 84, 75, 79, 82, 91, col('#d9d0ab'));
    rect(83, 98, 8, 6, col('#303846'));

    poly([[78, 126], [105, 129], [105, 136], [73, 134]], col('#4e5660'));
    rect(99, 133, 22, 4, col('#1b1f26'));
    poly([[69, 124], [56, 135], [78, 136]], col('#343b44'));
    rect(55, 135, 18, 4, col('#111318'));

    rect(91, 104, 2, 17, col('#ffb762', 0.14 + firePulse * 0.12));
    rect(105, 120, 8, 2, col('#ffcd75', 0.16 + firePulse * 0.16));
  }

  function drawDragon(t) {
    const breath = Math.sin(t * 1.3) * 1.2;
    const eye = 0.55 + Math.sin(t * 2.1) * 0.35;

    ellipse(240, 137, 60, 8, col('#030706', 0.72), 20);
    poly([[252, 126 + breath], [287, 123], [315, 112], [304, 130], [271, 136], [245, 134]], col('#5f1213'));
    tri(311, 112, 319, 105, 317, 121, col('#7f1716'));
    rect(278, 131, 24, 5, col('#3b0b0d'));

    ellipse(235, 122 + breath, 48, 17, col('#841818'), 22);
    ellipse(236, 128 + breath, 42, 10, col('#521012', 0.72), 18);
    poly([[210, 111 + breath], [238, 92 + breath], [269, 110 + breath], [249, 121 + breath]], col('#5d1013'));
    poly([[216, 109 + breath], [238, 99 + breath], [258, 110 + breath], [242, 116 + breath]], col('#311012', 0.42));

    for (let i = 0; i < 7; i++) {
      const x = 204 + i * 9;
      const h = 7 + (i % 2) * 3;
      tri(x, 108 + breath, x + 4, 100 + breath - h, x + 8, 110 + breath, col('#cf3c2f'));
    }

    poly([[164, 124], [175, 112 + breath], [199, 108 + breath], [212, 120 + breath], [199, 132 + breath], [174, 132]], col('#9c211f'));
    poly([[155, 124], [165, 117], [177, 119], [174, 129], [159, 129]], col('#8f1e1c'));
    rect(162, 125, 3, 2, col('#2b0707'));
    rect(183, 118 + breath, 4, 3, col('#ffcd75', 0.74 + eye * 0.24));
    rect(184, 119 + breath, 2, 1, col('#fff3b0', 0.9));
    tri(197, 111 + breath, 206, 94 + breath, 202, 115 + breath, col('#ffcd75'));
    tri(207, 116 + breath, 222, 101 + breath, 212, 121 + breath, col('#f0a85a'));

    rect(217, 132 + breath, 10, 10, col('#5c1011'));
    rect(222, 140 + breath, 16, 3, col('#2d0809'));
    rect(260, 130 + breath, 9, 9, col('#5c1011'));
    rect(265, 138 + breath, 17, 3, col('#2d0809'));
    rect(238, 116 + breath, 3, 3, col('#cf3c2f', 0.9));
  }

  function drawFire(t) {
    const f1 = Math.sin(t * 16.0) * 2.8 + Math.sin(t * 29.0) * 1.2;
    const f2 = Math.cos(t * 21.0) * 2.2;
    const x = 151 + Math.round(Math.sin(t * 17) * 1.5);

    const glow = 0.82 + Math.sin(t * 7.0) * 0.12 + Math.sin(t * 13.0) * 0.06;
    // warm light pooling on the ground around the fire (reference's signature look)
    ellipse(156, 141, 116 + f1 * 2, 17, col('#ff5a22', 0.09 * glow), 24);
    ellipse(156, 142, 78, 12, col('#ff7a3c', 0.13 * glow), 22);
    ellipse(157, 143, 44, 8, col('#ffb053', 0.17 * glow), 18);
    // airy glow above the flames
    ellipse(158, 126, 70 + f1 * 2, 30 + f2, col('#ef7d57', 0.11 * glow), 20);
    ellipse(160, 128, 40 + f2, 18, col('#ffcd75', 0.13 * glow), 18);
    rect(118, 133, 85, 3, col('#ff8a3d', 0.22 * glow));
    ellipse(159, 138, 38, 5, col('#090706', 0.75), 16);

    rect(135, 133, 48, 4, col('#5a2d1b'));
    rect(140, 130, 38, 4, col('#7a3d20'));
    rect(137, 132, 9, 3, col('#2d170d'));
    rect(174, 132, 9, 3, col('#2d170d'));

    tri(x, 131, x + 9, 100 - f1, x + 20, 131, col('#ef533d'));
    tri(x + 7, 132, x + 18, 106 - f2, x + 28, 132, col('#ff8a3d'));
    tri(x + 10, 132, x + 16, 115 - f1 * 0.5, x + 22, 132, col('#ffcd75'));
    tri(x + 15, 132, x + 19, 121 - f2, x + 24, 132, col('#fff3b0'));

    rect(124, 121, 65, 2, col('#8a6a3a'));
    ellipse(139, 122, 7, 4, col('#7a3b22'), 10);
    ellipse(172, 122, 7, 4, col('#7a3b22'), 10);
    rect(138, 121, 2, 1, col('#c98a4a'));
    rect(171, 121, 2, 1, col('#c98a4a'));

    for (const e of embers) {
      const p = (e.p + t * e.speed) % 1;
      const ex = e.x + Math.sin(t * 2 + e.p * 12) * 3 + e.drift * p;
      const ey = 123 - p * 46;
      const a = (1 - p) * 0.9;
      const s = p > 0.72 ? 1 : 2;
      rect(Math.round(ex), Math.round(ey), s, s, col(e.warm ? '#ffcd75' : '#ef7d57', a));
    }

    for (const sm of smoke) {
      const p = (sm.p + t * 0.035) % 1;
      const sx = sm.x + Math.sin(p * TWO_PI + sm.d) * 10 * p;
      const sy = sm.y - p * 38;
      rect(Math.round(sx), Math.round(sy), sm.w, 2, col('#0b1b19', (1 - p) * 0.22));
    }
  }

  function drawVignette() {
    rect(0, 0, W, 9, col('#020807', 0.55));
    rect(0, 0, 10, H, col('#020807', 0.34));
    rect(W - 10, 0, 10, H, col('#020807', 0.34));
    rect(0, H - 12, W, 12, col('#020807', 0.48));
  }

  function render(now) {
    const t = reduceMotion ? 0.8 : now * 0.001;
    verts = [];
    drawSky(t);
    drawMountains();
    drawGround(t);
    drawDragon(t);
    drawKnight(t);
    drawFire(t);
    drawVignette();

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 6);
  }

  let raf = 0;
  function loop(now) {
    render(now);
    raf = reduceMotion ? 0 : requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    render(0);
  } else {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!document.hidden && !raf) {
        raf = requestAnimationFrame(loop);
      }
    });
  }
})();
